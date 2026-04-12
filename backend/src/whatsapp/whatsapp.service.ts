import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type { SupportedLanguage } from '@accessibility-platform/contracts';

import { EmailService } from '../auth/email.service';
import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { RagService } from '../rag/rag.service';
import type { UserEntity } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { buildWhatsappReply, extractIncomingTextMessage } from './whatsapp.util';

type WhatsappAuthState = 'awaiting_name' | 'awaiting_email' | 'awaiting_code' | 'authenticated';

type WhatsappSession = {
  phoneNumber: string;
  userId?: string;
  profileName?: string;
  displayName?: string;
  email?: string;
  authState: WhatsappAuthState;
  verificationRequestId?: string;
  preferredLanguage?: SupportedLanguage;
  isNew?: boolean;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly database: DatabaseService,
    private readonly usersService: UsersService,
    private readonly ragService: RagService,
    private readonly emailService: EmailService,
  ) {}

  async handleWebhook(payload: Record<string, string | undefined>, webhookToken?: string) {
    if (this.config.whatsappWebhookAuthToken && webhookToken !== this.config.whatsappWebhookAuthToken) {
      this.logger.warn('Rejected WhatsApp webhook with invalid auth token.');
      return;
    }

    const message = extractIncomingTextMessage(payload);

    if (!message) {
      this.logger.debug('Ignoring non-message WhatsApp webhook payload.');
      return;
    }

    await this.handleIncomingMessage(message, payload);
  }

  async handleStatusCallback(payload: Record<string, string | undefined>) {
    const messageSid = payload.MessageSid?.trim();
    const messageStatus = payload.MessageStatus?.trim();

    if (!messageSid || !messageStatus) {
      this.logger.debug('Ignoring incomplete WhatsApp status callback payload.');
      return;
    }

    await this.database.pool.query(
      `insert into accesschat.whatsapp_status_events (
         id,
         message_sid,
         message_status,
         to_number,
         from_number,
         channel_status,
         error_code,
         error_message,
         raw_payload
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        randomUUID(),
        messageSid,
        messageStatus,
        payload.To || null,
        payload.From || null,
        payload.ChannelStatusMessage || null,
        payload.ErrorCode || null,
        payload.ErrorMessage || null,
        JSON.stringify(payload),
      ],
    );

    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      this.logger.warn(
        `WhatsApp status ${messageStatus} for ${messageSid}. error=${payload.ErrorCode || 'n/a'} ${payload.ErrorMessage || ''}`.trim(),
      );
      return;
    }

    this.logger.log(`WhatsApp status ${messageStatus} recorded for ${messageSid}.`);
  }

  private async handleIncomingMessage(
    message: NonNullable<ReturnType<typeof extractIncomingTextMessage>>,
    payload: Record<string, string | undefined>,
  ) {
    const inserted = await this.database.pool.query<{ message_id: string }>(
      `insert into accesschat.whatsapp_inbound_messages (
         message_id,
         phone_number,
         profile_name,
         text_body,
         payload
       ) values ($1, $2, $3, $4, $5::jsonb)
       on conflict (message_id) do nothing
       returning message_id`,
      [
        message.messageId,
        message.from,
        message.profileName || null,
        message.text,
        JSON.stringify(payload),
      ],
    );

    if (inserted.rowCount === 0) {
      this.logger.debug(`Skipping duplicate WhatsApp message ${message.messageId}.`);
      return;
    }

    try {
      const session = await this.getOrCreateSession(message.from, message.profileName);
      const reply = await this.processConversationTurn(session, message.text);

      await this.sendTextMessage(message.from, reply);

      await this.database.pool.query(
        `update accesschat.whatsapp_inbound_messages
         set response_text = $2,
             processed_at = now()
         where message_id = $1`,
        [message.messageId, reply],
      );
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown WhatsApp processing error.';

      await this.database.pool.query(
        `update accesschat.whatsapp_inbound_messages
         set error_text = $2
         where message_id = $1`,
        [message.messageId, messageText],
      );

      this.logger.error(`Failed to process WhatsApp message ${message.messageId}: ${messageText}`);
      throw error;
    }
  }

  private async getOrCreateSession(phoneNumber: string, profileName?: string): Promise<WhatsappSession> {
    const contactResult = await this.database.pool.query<{ user_id: string }>(
      `select user_id, profile_name, email, auth_state, verification_request_id, preferred_language
       from accesschat.whatsapp_contacts
       where phone_number = $1
       limit 1`,
      [phoneNumber],
    );

    const row = contactResult.rows[0] as
      | {
          user_id?: string;
          profile_name?: string | null;
          email?: string | null;
          auth_state?: string;
          verification_request_id?: string | null;
          preferred_language?: string | null;
        }
      | undefined;

    if (row) {
      await this.database.pool.query(
        `update accesschat.whatsapp_contacts
         set profile_name = coalesce($2, profile_name),
             last_message_at = now()
         where phone_number = $1`,
        [phoneNumber, sanitizeDisplayName(profileName)],
      );

      return {
        phoneNumber,
        userId: row.user_id,
        profileName: row.profile_name || sanitizeDisplayName(profileName),
        email: row.email || undefined,
        authState: normalizeAuthState(row.auth_state),
        verificationRequestId: row.verification_request_id || undefined,
        preferredLanguage: normalizeLanguage(row.preferred_language),
        isNew: false,
      };
    }

    await this.database.pool.query(
      `insert into accesschat.whatsapp_contacts (
         phone_number,
         profile_name
       ) values ($1, $2)
       on conflict (phone_number) do update
       set profile_name = coalesce(excluded.profile_name, accesschat.whatsapp_contacts.profile_name),
           last_message_at = now()`,
      [phoneNumber, sanitizeDisplayName(profileName)],
    );

    return {
      phoneNumber,
      profileName: sanitizeDisplayName(profileName),
      authState: 'awaiting_name',
      isNew: true,
    };
  }

  private async processConversationTurn(session: WhatsappSession, incomingText: string): Promise<string> {
    const text = incomingText.trim();
    const normalizedText = normalizeCommand(text);

    // Check for language change command
    const languageCommand = parseLanguageCommand(normalizedText);
    if (languageCommand) {
      await this.updateSession(session.phoneNumber, {
        authState: session.authState,
        preferredLanguage: languageCommand,
      });

      const messages = {
        pt: 'Idioma alterado para Português. Agora responderei suas perguntas em português.',
        en: 'Language changed to English. I will now answer your questions in English.',
        es: 'Idioma cambiado a Español. Ahora responderé tus preguntas en español.',
      };

      return messages[languageCommand];
    }

    if (session.isNew) {
      return 'Ola. Eu sou o assistente de acessibilidade no WhatsApp. Para autenticar seu acesso, me diga seu nome.\n\nVoce pode escolher o idioma enviando: /idioma pt, /idioma en ou /idioma es';
    }

    if (session.authState === 'authenticated' && session.userId) {
      if (isGreeting(normalizedText)) {
        const name = session.profileName ? `, ${session.profileName.split(' ')[0]}` : '';
        const greetings: Record<string, string> = {
          pt: `Ola${name}! Como posso ajudar com acessibilidade hoje? Pode me fazer uma pergunta sobre WCAG, LBI, ARIA ou qualquer tema de acessibilidade digital.`,
          en: `Hello${name}! How can I help with accessibility today? Feel free to ask about WCAG, ADA, ARIA, or any digital accessibility topic.`,
          es: `Hola${name}! Como puedo ayudarte con accesibilidad hoy? Puedes preguntarme sobre WCAG, ARIA o cualquier tema de accesibilidad digital.`,
        };
        return greetings[session.preferredLanguage || 'pt'];
      }

      const answer = await this.ragService.answer(session.userId, {
        question: text,
        language: session.preferredLanguage,
      });

      if (answer.mode === 'fallback') {
        const noMatch: Record<string, string> = {
          pt: `Nao encontrei uma resposta especifica para "${text.slice(0, 60)}". Tente uma pergunta mais detalhada sobre acessibilidade digital, como: "O que e WCAG 2.2?" ou "Como implementar ARIA em formularios?"`,
          en: `I couldn't find a specific answer for "${text.slice(0, 60)}". Try a more detailed accessibility question, e.g. "What is WCAG 2.2?" or "How do I add ARIA to forms?"`,
          es: `No encontre una respuesta especifica para "${text.slice(0, 60)}". Intenta una pregunta mas detallada, como: "Que es WCAG 2.2?" o "Como usar ARIA en formularios?"`,
        };
        return noMatch[answer.language || session.preferredLanguage || 'pt'];
      }

      return buildWhatsappReply(answer.answer);
    }

    if (session.authState === 'awaiting_name') {
      await this.updateSession(session.phoneNumber, {
        profileName: sanitizeDisplayName(text),
        authState: 'awaiting_email',
      });
      return `Pra continuar no chat de acessibilidade, me diga seu email.`;
    }

    if (session.authState === 'awaiting_email') {
      const email = normalizeEmail(text);

      if (!email) {
        return 'Envie um email valido para eu continuar sua autenticacao.';
      }

      let requestId: string;

      try {
        requestId = await this.startEmailVerification(
          session.phoneNumber,
          session.profileName || 'Usuario WhatsApp',
          email,
        );
      } catch (error) {
        return error instanceof Error
          ? error.message
          : 'Nao consegui iniciar sua autenticacao por email agora.';
      }

      await this.updateSession(session.phoneNumber, {
        email,
        authState: 'awaiting_code',
        verificationRequestId: requestId,
      });
      return `Enviei um codigo para ${email}. Responda aqui no WhatsApp com o codigo de 6 digitos para autenticar. Se nao recebeu, responda "reenviar".`;
    }

    if (session.authState === 'awaiting_code') {
      const requestId = session.verificationRequestId;
      const email = session.email;

      if (!requestId || !email) {
        await this.updateSession(session.phoneNumber, {
          authState: 'awaiting_email',
        });
        return 'Preciso confirmar seu email novamente. Me envie seu email para continuar.';
      }

      if (isChangeEmailCommand(normalizedText)) {
        await this.updateSession(session.phoneNumber, {
          authState: 'awaiting_email',
          verificationRequestId: null,
        });
        return 'Sem problema. Me envie o novo email e eu mando outro codigo para ele.';
      }

      if (isResendCodeCommand(normalizedText)) {
        let newRequestId: string;

        try {
          newRequestId = await this.startEmailVerification(
            session.phoneNumber,
            session.profileName || 'Usuario WhatsApp',
            email,
          );
        } catch (error) {
          return error instanceof Error
            ? error.message
            : 'Nao consegui reenviar o codigo agora.';
        }

        await this.updateSession(session.phoneNumber, {
          email,
          authState: 'awaiting_code',
          verificationRequestId: newRequestId,
        });

        return `Reenviei o codigo para ${email}. Se quiser trocar o email, responda "trocar email".`;
      }

      const replacementEmail = normalizeEmail(text);

      if (replacementEmail) {
        let newRequestId: string;

        try {
          newRequestId = await this.startEmailVerification(
            session.phoneNumber,
            session.profileName || 'Usuario WhatsApp',
            replacementEmail,
          );
        } catch (error) {
          return error instanceof Error
            ? error.message
            : 'Nao consegui atualizar o email agora.';
        }

        await this.updateSession(session.phoneNumber, {
          email: replacementEmail,
          authState: 'awaiting_code',
          verificationRequestId: newRequestId,
        });

        return `Atualizei o email para ${replacementEmail} e enviei um novo codigo.`;
      }

      if (!/^\d{6}$/.test(text)) {
        return 'Envie o codigo de 6 digitos que voce recebeu por email. Se nao recebeu, responda "reenviar". Se quiser mudar, responda "trocar email".';
      }

      let user: UserEntity;

      try {
        user = await this.verifyEmailCode({
          requestId,
          email,
          code: text,
          displayName: session.profileName || 'Usuario WhatsApp',
        });
      } catch (error) {
        return error instanceof Error
          ? error.message
          : 'Nao consegui validar o codigo agora. Tente novamente.';
      }

      await this.updateSession(session.phoneNumber, {
        userId: user.id,
        authState: 'authenticated',
        email: user.email,
        verificationRequestId: null,
      });

      return `Autenticacao concluida. Agora voce pode conversar comigo sobre acessibilidade. Pode mandar sua pergunta.`;
    }

    await this.updateSession(session.phoneNumber, {
      authState: 'awaiting_name',
    });
    return 'Vamos recomecar. Me diga seu nome para iniciar a autenticacao no WhatsApp.';
  }

  private async startEmailVerification(phoneNumber: string, displayName: string, email: string): Promise<string> {
    const existingUser = await this.usersService.findByEmail(email);

    if (!existingUser) {
      throw new Error('Esse email nao esta cadastrado no Access Chat. Cadastre-se primeiro no app web ou envie outro email.');
    }

    const requestId = randomUUID();
    const code = this.createCode();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    await this.database.pool.query(
      `update accesschat.whatsapp_auth_requests
       set consumed_at = now()
       where phone_number = $1
         and consumed_at is null`,
      [phoneNumber],
    );

    await this.database.pool.query(
      `insert into accesschat.whatsapp_auth_requests (
         id,
         phone_number,
         email,
         display_name,
         code_hash,
         expires_at
       ) values ($1, $2, $3, $4, $5, $6)`,
      [requestId, phoneNumber, email, displayName, this.hashValue(code), expiresAt],
    );

    await this.emailService.send({
      to: email,
      subject: 'Codigo MFA do Access Chat via WhatsApp',
      text: `Use o codigo ${code} para autenticar seu acesso ao Access Chat pelo WhatsApp. Se voce nao solicitou, ignore esta mensagem.`,
      html: `<p>Use o codigo <strong>${code}</strong> para autenticar seu acesso ao Access Chat pelo WhatsApp.</p><p>Se voce nao solicitou, ignore esta mensagem.</p>`,
    });

    return requestId;
  }

  private async verifyEmailCode(input: {
    requestId: string;
    email: string;
    code: string;
    displayName: string;
  }): Promise<UserEntity> {
    const result = await this.database.pool.query<{
      id: string;
      email: string;
      display_name: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      attempts: number;
    }>(
      `select id, email, display_name, code_hash, expires_at, consumed_at, attempts
       from accesschat.whatsapp_auth_requests
       where id = $1
         and email = $2
       limit 1`,
      [input.requestId, input.email],
    );

    const request = result.rows[0];

    if (!request || request.consumed_at) {
      throw new Error('Codigo invalido ou expirado. Envie seu email novamente para gerar outro codigo.');
    }

    if (new Date(request.expires_at).getTime() < Date.now()) {
      throw new Error('Codigo expirado. Envie seu email novamente para receber outro codigo.');
    }

    if (request.attempts >= 5) {
      throw new Error('Numero maximo de tentativas excedido. Envie seu email novamente.');
    }

    if (!this.matches(input.code, request.code_hash)) {
      await this.database.pool.query(
        `update accesschat.whatsapp_auth_requests
         set attempts = attempts + 1
         where id = $1`,
        [request.id],
      );
      throw new Error('Codigo invalido. Confira o email e tente novamente.');
    }

    await this.database.pool.query(
      `update accesschat.whatsapp_auth_requests
       set consumed_at = now()
       where id = $1`,
      [request.id],
    );

    const existingUser = await this.usersService.findByEmail(input.email);

    if (existingUser) {
      return existingUser;
    }

    throw new Error('Esse email nao esta cadastrado no Access Chat. Cadastre-se no app web e tente novamente.');
  }

  private async updateSession(phoneNumber: string, input: {
    userId?: string | null;
    profileName?: string;
    email?: string;
    authState: WhatsappAuthState;
    verificationRequestId?: string | null;
    preferredLanguage?: SupportedLanguage;
  }) {
    await this.database.pool.query(
      `update accesschat.whatsapp_contacts
       set user_id = coalesce($2, user_id),
           profile_name = coalesce($3, profile_name),
           email = coalesce($4, email),
           auth_state = $5,
           verification_request_id = $6,
           preferred_language = coalesce($7, preferred_language),
           last_message_at = now()
       where phone_number = $1`,
      [
        phoneNumber,
        input.userId ?? null,
        input.profileName ?? null,
        input.email ?? null,
        input.authState,
        input.verificationRequestId ?? null,
        input.preferredLanguage ?? null,
      ],
    );
  }

  private async sendTextMessage(to: string, body: string) {
    if (!this.config.whatsappAccountSid || !this.config.whatsappAuthToken || !this.config.whatsappFromNumber) {
      throw new Error('Twilio WhatsApp is not configured.');
    }

    const url = `${this.config.whatsappApiBaseUrl}/2010-04-01/Accounts/${this.config.whatsappAccountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.config.whatsappAccountSid}:${this.config.whatsappAuthToken}`).toString('base64');
    const form = new URLSearchParams({
      From: this.config.whatsappFromNumber,
      To: to,
      Body: body,
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio WhatsApp API returned ${response.status}: ${errorBody}`);
    }
  }

  private createCode(): string {
    return String(randomInt(100000, 999999));
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private matches(value: string, expectedHash: string): boolean {
    const incoming = Buffer.from(this.hashValue(value));
    const expected = Buffer.from(expectedHash);
    return incoming.length === expected.length && timingSafeEqual(incoming, expected);
  }
}

function sanitizeDisplayName(profileName?: string) {
  return profileName?.trim().replace(/\s+/g, ' ').slice(0, 120) || undefined;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeCommand(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function isChangeEmailCommand(value: string): boolean {
  return [
    'trocar-email',
    'trocar-de-email',
    'outro-email',
    'mudar-email',
    'alterar-email',
  ].includes(value);
}

function isResendCodeCommand(value: string): boolean {
  return [
    'reenviar',
    'reenviar-codigo',
    'nao-recebi',
    'nao-recebi-o-codigo',
    'enviar-novamente',
  ].includes(value);
}

function normalizeAuthState(value?: string): WhatsappAuthState {
  if (value === 'awaiting_email' || value === 'awaiting_code' || value === 'authenticated') {
    return value;
  }

  return 'awaiting_name';
}

function parseLanguageCommand(normalizedText: string): SupportedLanguage | null {
  // Match commands like: /idioma pt, /language en, /lang es, idioma português, etc
  const ptPattern = /^\/?(idioma|language|lang)\s*(pt|portugues|portuguese|português|br|brazil)$/i;
  const enPattern = /^\/?(idioma|language|lang)\s*(en|english|ingles|inglês|us|usa)$/i;
  const esPattern = /^\/?(idioma|language|lang)\s*(es|espanol|español|spanish|espanhol)$/i;

  if (ptPattern.test(normalizedText)) {
    return 'pt';
  }
  if (enPattern.test(normalizedText)) {
    return 'en';
  }
  if (esPattern.test(normalizedText)) {
    return 'es';
  }

  return null;
}

function normalizeLanguage(value?: string | null): SupportedLanguage | undefined {
  if (value === 'pt' || value === 'en' || value === 'es') {
    return value;
  }
  return undefined;
}

function isGreeting(normalizedText: string): boolean {
  const greetings = [
    'oi', 'ola', 'hey', 'hi', 'hello', 'hola',
    'bom-dia', 'boa-tarde', 'boa-noite',
    'good-morning', 'good-afternoon', 'good-evening', 'good-night',
    'buenos-dias', 'buenas-tardes', 'buenas-noches',
    'tudo-bem', 'tudo-bom', 'como-vai', 'e-ai', 'e-aí',
    'oi-oi', 'ola-ola',
  ];
  return greetings.includes(normalizedText) || normalizedText.length < 3;
}
