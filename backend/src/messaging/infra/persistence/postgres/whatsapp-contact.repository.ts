import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../../../database/database.service';
import type {
  IWhatsappContactRepository,
  WhatsappAuthState,
  WhatsappContactRow,
} from '../../../domain/repositories/whatsapp-contact.repository.interface';

@Injectable()
export class PostgresWhatsappContactRepository implements IWhatsappContactRepository {
  constructor(private readonly database: DatabaseService) {}

  async findOrCreate(phoneNumber: string, profileName?: string): Promise<WhatsappContactRow> {
    const result = await this.database.pool.query<{
      user_id?: string;
      profile_name?: string;
      email?: string;
      auth_state?: string;
      verification_request_id?: string;
      preferred_language?: string;
    }>(
      `select user_id, profile_name, email, auth_state, verification_request_id, preferred_language
       from accesschat.whatsapp_contacts
       where phone_number = $1
       limit 1`,
      [phoneNumber],
    );

    const row = result.rows[0];

    if (row) {
      await this.database.pool.query(
        `update accesschat.whatsapp_contacts
         set profile_name = coalesce($2, profile_name), last_message_at = now()
         where phone_number = $1`,
        [phoneNumber, sanitize(profileName)],
      );

      return {
        phoneNumber,
        userId: row.user_id,
        profileName: row.profile_name ?? sanitize(profileName),
        email: row.email ?? undefined,
        authState: normalizeAuthState(row.auth_state),
        verificationRequestId: row.verification_request_id ?? undefined,
        preferredLanguage: normalizeLanguage(row.preferred_language),
        isNew: false,
      };
    }

    await this.database.pool.query(
      `insert into accesschat.whatsapp_contacts (phone_number, profile_name)
       values ($1, $2)
       on conflict (phone_number) do update
       set profile_name = coalesce(excluded.profile_name, accesschat.whatsapp_contacts.profile_name),
           last_message_at = now()`,
      [phoneNumber, sanitize(profileName)],
    );

    return {
      phoneNumber,
      profileName: sanitize(profileName),
      authState: 'awaiting_name',
      isNew: true,
    };
  }

  async update(phoneNumber: string, fields: Partial<Omit<WhatsappContactRow, 'phoneNumber' | 'isNew'>>): Promise<void> {
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
        fields.userId ?? null,
        fields.profileName ?? null,
        fields.email ?? null,
        fields.authState ?? 'awaiting_name',
        fields.verificationRequestId ?? null,
        fields.preferredLanguage ?? null,
      ],
    );
  }

  async saveInboundMessage(params: {
    messageId: string;
    phoneNumber: string;
    profileName?: string;
    textBody: string;
    payload: Record<string, string | undefined>;
  }): Promise<boolean> {
    const result = await this.database.pool.query<{ message_id: string }>(
      `insert into accesschat.whatsapp_inbound_messages
         (message_id, phone_number, profile_name, text_body, payload)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (message_id) do nothing
       returning message_id`,
      [params.messageId, params.phoneNumber, params.profileName ?? null, params.textBody, JSON.stringify(params.payload)],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateInboundMessageResult(messageId: string, responseText: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.whatsapp_inbound_messages
       set response_text = $2, processed_at = now()
       where message_id = $1`,
      [messageId, responseText],
    );
  }

  async updateInboundMessageError(messageId: string, errorText: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.whatsapp_inbound_messages set error_text = $2 where message_id = $1`,
      [messageId, errorText],
    );
  }

  async saveStatusEvent(params: {
    id: string;
    messageSid: string;
    messageStatus: string;
    to?: string;
    from?: string;
    channelStatus?: string;
    errorCode?: string;
    errorMessage?: string;
    payload: Record<string, string | undefined>;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.whatsapp_status_events
         (id, message_sid, message_status, to_number, from_number, channel_status, error_code, error_message, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        params.id,
        params.messageSid,
        params.messageStatus,
        params.to ?? null,
        params.from ?? null,
        params.channelStatus ?? null,
        params.errorCode ?? null,
        params.errorMessage ?? null,
        JSON.stringify(params.payload),
      ],
    );
  }

  async saveAuthRequest(params: {
    id: string;
    phoneNumber: string;
    email: string;
    displayName: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.whatsapp_auth_requests
         (id, phone_number, email, display_name, code_hash, expires_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [params.id, params.phoneNumber, params.email, params.displayName, params.codeHash, params.expiresAt.toISOString()],
    );
  }

  async consumePendingAuthRequests(phoneNumber: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.whatsapp_auth_requests
       set consumed_at = now()
       where phone_number = $1 and consumed_at is null`,
      [phoneNumber],
    );
  }

  async findAuthRequest(id: string, email: string): Promise<{
    id: string;
    codeHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    attempts: number;
  } | null> {
    const result = await this.database.pool.query<{
      id: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      attempts: number;
    }>(
      `select id, code_hash, expires_at, consumed_at, attempts
       from accesschat.whatsapp_auth_requests
       where id = $1 and email = $2
       limit 1`,
      [id, email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      codeHash: row.code_hash,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
      attempts: row.attempts,
    };
  }

  async consumeAuthRequest(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.whatsapp_auth_requests set consumed_at = now() where id = $1`,
      [id],
    );
  }

  async incrementAuthRequestAttempts(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.whatsapp_auth_requests set attempts = attempts + 1 where id = $1`,
      [id],
    );
  }
}

function sanitize(name?: string): string | undefined {
  return name?.trim().replace(/\s+/g, ' ').slice(0, 120) || undefined;
}

function normalizeAuthState(value?: string): WhatsappAuthState {
  if (value === 'awaiting_email' || value === 'awaiting_code' || value === 'authenticated') return value;
  return 'awaiting_name';
}

function normalizeLanguage(value?: string | null): 'pt' | 'en' | 'es' | undefined {
  if (value === 'pt' || value === 'en' || value === 'es') return value;
  return undefined;
}
