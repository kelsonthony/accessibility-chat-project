import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type { SupportedLanguage } from '@accessibility-platform/contracts';

import { AppConfigService } from '../../../../config/app-config.service';
import { EmailService } from '../../../infra/providers/email.provider';
import { TwilioSenderProvider } from '../../../infra/providers/twilio-sender.provider';
import { WHATSAPP_CONTACT_REPOSITORY, type IWhatsappContactRepository } from '../../../domain/repositories/whatsapp-contact.repository.interface';
import { USER_REPOSITORY, type IUserRepository } from '../../../../identity/domain/repositories/user.repository.interface';
import { Email } from '../../../../identity/domain/value-objects/email.vo';
import { AskQuestionUseCase } from '../../../../knowledge/application/use-cases/ask-question/ask-question.use-case';

interface IncomingMessage {
  messageId: string;
  from: string;
  text: string;
  profileName?: string;
}

@Injectable()
export class HandleInboundMessageUseCase {
  private readonly logger = new Logger(HandleInboundMessageUseCase.name);

  constructor(
    @Inject(WHATSAPP_CONTACT_REPOSITORY) private readonly contactRepo: IWhatsappContactRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly ragService: AskQuestionUseCase,
    private readonly emailService: EmailService,
    private readonly twilioSender: TwilioSenderProvider,
    private readonly config: AppConfigService,
  ) {}

  async execute(payload: Record<string, string | undefined>, webhookToken?: string): Promise<void> {
    if (this.config.whatsappWebhookAuthToken && webhookToken !== this.config.whatsappWebhookAuthToken) {
      this.logger.warn('Rejected WhatsApp webhook with invalid auth token.');
      return;
    }

    const message = extractMessage(payload);
    if (!message) {
      this.logger.debug('Ignoring non-message WhatsApp webhook payload.');
      return;
    }

    const inserted = await this.contactRepo.saveInboundMessage({
      messageId: message.messageId,
      phoneNumber: message.from,
      profileName: message.profileName,
      textBody: message.text,
      payload,
    });

    if (!inserted) {
      this.logger.debug(`Skipping duplicate WhatsApp message ${message.messageId}.`);
      return;
    }

    try {
      const session = await this.contactRepo.findOrCreate(message.from, message.profileName);
      const reply = await this.processConversationTurn(session, message.text);

      await this.twilioSender.send(message.from, reply);
      await this.contactRepo.updateInboundMessageResult(message.messageId, reply);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Unknown error';
      await this.contactRepo.updateInboundMessageError(message.messageId, errorText);
      this.logger.error(`Failed to process WhatsApp message ${message.messageId}: ${errorText}`);
      throw error;
    }
  }

  private async processConversationTurn(
    session: Awaited<ReturnType<IWhatsappContactRepository['findOrCreate']>>,
    incomingText: string,
  ): Promise<string> {
    const text = incomingText.trim();
    const normalized = normalizeCommand(text);

    const langCommand = parseLanguageCommand(normalized);
    if (langCommand) {
      await this.contactRepo.update(session.phoneNumber, {
        authState: session.authState,
        preferredLanguage: langCommand,
      });
      const msgs = {
        pt: 'Idioma alterado para Português.',
        en: 'Language changed to English.',
        es: 'Idioma cambiado a Español.',
      };
      return msgs[langCommand];
    }

    if (session.isNew) {
      return 'Ola. Eu sou o assistente de acessibilidade no WhatsApp. Para autenticar seu acesso, me diga seu nome.\n\nVoce pode escolher o idioma enviando: /idioma pt, /idioma en ou /idioma es';
    }

    if (session.authState === 'authenticated' && session.userId) {
      if (isGreeting(normalized)) {
        const name = session.profileName ? `, ${session.profileName.split(' ')[0]}` : '';
        const greetings = {
          pt: `Ola${name}! Como posso ajudar com acessibilidade hoje?`,
          en: `Hello${name}! How can I help with accessibility today?`,
          es: `Hola${name}! Como puedo ayudarte con accesibilidad hoy?`,
        };
        return greetings[session.preferredLanguage ?? 'pt'];
      }

      const answer = await this.ragService.answer(session.userId, {
        question: text,
        language: session.preferredLanguage,
      });

      if (answer.mode === 'fallback') {
        const noMatch = {
          pt: `Nao encontrei uma resposta especifica para "${text.slice(0, 60)}". Tente perguntar sobre WCAG, LBI, ADA ou ARIA.`,
          en: `I couldn't find a specific answer for "${text.slice(0, 60)}". Try asking about WCAG, ADA, or ARIA.`,
          es: `No encontre respuesta especifica para "${text.slice(0, 60)}". Intenta preguntar sobre WCAG o ARIA.`,
        };
        return noMatch[answer.language ?? session.preferredLanguage ?? 'pt'];
      }

      return formatWhatsappReply(answer.answer);
    }

    if (session.authState === 'awaiting_name') {
      await this.contactRepo.update(session.phoneNumber, {
        profileName: sanitize(text),
        authState: 'awaiting_email',
      });
      return 'Para continuar no chat de acessibilidade, me diga seu email.';
    }

    if (session.authState === 'awaiting_email') {
      const email = normalizeEmail(text);
      if (!email) return 'Envie um email valido para eu continuar sua autenticacao.';

      let requestId: string;
      try {
        requestId = await this.startEmailVerification(session.phoneNumber, session.profileName ?? 'Usuario WhatsApp', email);
      } catch (error) {
        return error instanceof Error ? error.message : 'Nao consegui iniciar sua autenticacao por email agora.';
      }

      await this.contactRepo.update(session.phoneNumber, {
        email,
        authState: 'awaiting_code',
        verificationRequestId: requestId,
      });
      return `Enviei um codigo para ${email}. Responda com o codigo de 6 digitos para autenticar. Se nao recebeu, responda "reenviar".`;
    }

    if (session.authState === 'awaiting_code') {
      return this.handleAwaitingCode(session, text, normalized);
    }

    await this.contactRepo.update(session.phoneNumber, { authState: 'awaiting_name' });
    return 'Vamos recomecar. Me diga seu nome para iniciar a autenticacao no WhatsApp.';
  }

  private async handleAwaitingCode(
    session: Awaited<ReturnType<IWhatsappContactRepository['findOrCreate']>>,
    text: string,
    normalized: string,
  ): Promise<string> {
    const { verificationRequestId: requestId, email } = session;

    if (!requestId || !email) {
      await this.contactRepo.update(session.phoneNumber, { authState: 'awaiting_email' });
      return 'Preciso confirmar seu email novamente. Me envie seu email para continuar.';
    }

    if (isChangeEmailCommand(normalized)) {
      await this.contactRepo.update(session.phoneNumber, { authState: 'awaiting_email', verificationRequestId: undefined });
      return 'Sem problema. Me envie o novo email e eu mando outro codigo para ele.';
    }

    if (isResendCodeCommand(normalized)) {
      let newRequestId: string;
      try {
        newRequestId = await this.startEmailVerification(session.phoneNumber, session.profileName ?? 'Usuario WhatsApp', email);
      } catch (error) {
        return error instanceof Error ? error.message : 'Nao consegui reenviar o codigo agora.';
      }
      await this.contactRepo.update(session.phoneNumber, { email, authState: 'awaiting_code', verificationRequestId: newRequestId });
      return `Reenviei o codigo para ${email}. Se quiser trocar o email, responda "trocar email".`;
    }

    const replacementEmail = normalizeEmail(text);
    if (replacementEmail) {
      let newRequestId: string;
      try {
        newRequestId = await this.startEmailVerification(session.phoneNumber, session.profileName ?? 'Usuario WhatsApp', replacementEmail);
      } catch (error) {
        return error instanceof Error ? error.message : 'Nao consegui atualizar o email agora.';
      }
      await this.contactRepo.update(session.phoneNumber, { email: replacementEmail, authState: 'awaiting_code', verificationRequestId: newRequestId });
      return `Atualizei o email para ${replacementEmail} e enviei um novo codigo.`;
    }

    if (!/^\d{6}$/.test(text)) {
      return 'Envie o codigo de 6 digitos que voce recebeu por email. Se nao recebeu, responda "reenviar".';
    }

    try {
      const user = await this.verifyEmailCode({ requestId, email, code: text });
      await this.contactRepo.update(session.phoneNumber, {
        userId: user.id,
        authState: 'authenticated',
        email: user.email,
        verificationRequestId: undefined,
      });
      return 'Autenticacao concluida. Agora voce pode conversar comigo sobre acessibilidade. Pode mandar sua pergunta.';
    } catch (error) {
      return error instanceof Error ? error.message : 'Nao consegui validar o codigo agora. Tente novamente.';
    }
  }

  private async startEmailVerification(phoneNumber: string, displayName: string, email: string): Promise<string> {
    const user = await this.userRepo.findByEmail(Email.fromPersistence(email));
    if (!user) throw new Error('Esse email nao esta cadastrado no Access Chat. Cadastre-se primeiro no app web.');

    const requestId = randomUUID();
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    await this.contactRepo.consumePendingAuthRequests(phoneNumber);
    await this.contactRepo.saveAuthRequest({
      id: requestId,
      phoneNumber,
      email,
      displayName,
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt,
    });

    await this.emailService.send({
      to: email,
      subject: 'Codigo MFA do Access Chat via WhatsApp',
      text: `Use o codigo ${code} para autenticar seu acesso ao Access Chat pelo WhatsApp.`,
      html: `<p>Use o codigo <strong>${code}</strong> para autenticar seu acesso ao Access Chat pelo WhatsApp.</p>`,
    });

    return requestId;
  }

  private async verifyEmailCode(input: { requestId: string; email: string; code: string }): Promise<{ id: string; email: string }> {
    const request = await this.contactRepo.findAuthRequest(input.requestId, input.email);

    if (!request || request.consumedAt) throw new Error('Codigo invalido ou expirado. Envie seu email novamente para gerar outro.');
    if (request.expiresAt < new Date()) throw new Error('Codigo expirado. Envie seu email novamente para receber outro.');
    if (request.attempts >= 5) throw new Error('Numero maximo de tentativas excedido. Envie seu email novamente.');

    const incoming = Buffer.from(createHash('sha256').update(input.code).digest('hex'));
    const expected = Buffer.from(request.codeHash);
    if (!(incoming.length === expected.length && timingSafeEqual(incoming, expected))) {
      await this.contactRepo.incrementAuthRequestAttempts(request.id);
      throw new Error('Codigo invalido. Confira o email e tente novamente.');
    }

    await this.contactRepo.consumeAuthRequest(request.id);

    const user = await this.userRepo.findByEmail(Email.fromPersistence(input.email));
    if (!user) throw new Error('Esse email nao esta cadastrado no Access Chat.');

    return { id: user.id.value, email: user.email.value };
  }
}

function extractMessage(payload: Record<string, string | undefined>): IncomingMessage | null {
  const messageId = payload.MessageSid?.trim();
  const from = payload.From?.trim();
  const text = payload.Body?.trim();
  if (!messageId || !from || !text) return null;
  return { messageId, from, text, profileName: payload.ProfileName?.trim() };
}

function sanitize(name?: string): string | undefined {
  return name?.trim().replace(/\s+/g, ' ').slice(0, 120) || undefined;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeCommand(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
}

function isGreeting(normalized: string): boolean {
  return ['oi', 'ola', 'hey', 'hi', 'hello', 'hola', 'bom-dia', 'boa-tarde', 'boa-noite'].includes(normalized) || normalized.length < 3;
}

function isChangeEmailCommand(v: string): boolean {
  return ['trocar-email', 'trocar-de-email', 'outro-email', 'mudar-email', 'alterar-email'].includes(v);
}

function isResendCodeCommand(v: string): boolean {
  return ['reenviar', 'reenviar-codigo', 'nao-recebi', 'enviar-novamente'].includes(v);
}

function parseLanguageCommand(normalized: string): SupportedLanguage | null {
  if (/^\/?(idioma|language|lang)\s*(pt|portugues|portuguese|br)$/i.test(normalized)) return 'pt';
  if (/^\/?(idioma|language|lang)\s*(en|english|ingles|us)$/i.test(normalized)) return 'en';
  if (/^\/?(idioma|language|lang)\s*(es|espanol|spanish)$/i.test(normalized)) return 'es';
  return null;
}

function formatWhatsappReply(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '*$1*').replace(/#{1,3}\s+/g, '').trim().slice(0, 1600);
}
