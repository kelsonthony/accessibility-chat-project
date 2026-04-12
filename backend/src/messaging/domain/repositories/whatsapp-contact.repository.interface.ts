import type { SupportedLanguage } from '@accessibility-platform/contracts';

export const WHATSAPP_CONTACT_REPOSITORY = Symbol('IWhatsappContactRepository');

export type WhatsappAuthState = 'awaiting_name' | 'awaiting_email' | 'awaiting_code' | 'authenticated';

export interface WhatsappContactRow {
  phoneNumber: string;
  userId?: string;
  profileName?: string;
  email?: string;
  authState: WhatsappAuthState;
  verificationRequestId?: string;
  preferredLanguage?: SupportedLanguage;
  isNew: boolean;
}

export interface IWhatsappContactRepository {
  findOrCreate(phoneNumber: string, profileName?: string): Promise<WhatsappContactRow>;
  update(
    phoneNumber: string,
    fields: Partial<Omit<WhatsappContactRow, 'phoneNumber' | 'isNew'>>,
  ): Promise<void>;
  saveInboundMessage(params: {
    messageId: string;
    phoneNumber: string;
    profileName?: string;
    textBody: string;
    payload: Record<string, string | undefined>;
  }): Promise<boolean>;
  updateInboundMessageResult(messageId: string, responseText: string): Promise<void>;
  updateInboundMessageError(messageId: string, errorText: string): Promise<void>;
  saveStatusEvent(params: {
    id: string;
    messageSid: string;
    messageStatus: string;
    to?: string;
    from?: string;
    channelStatus?: string;
    errorCode?: string;
    errorMessage?: string;
    payload: Record<string, string | undefined>;
  }): Promise<void>;
  saveAuthRequest(params: {
    id: string;
    phoneNumber: string;
    email: string;
    displayName: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumePendingAuthRequests(phoneNumber: string): Promise<void>;
  findAuthRequest(id: string, email: string): Promise<{
    id: string;
    codeHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    attempts: number;
  } | null>;
  consumeAuthRequest(id: string): Promise<void>;
  incrementAuthRequestAttempts(id: string): Promise<void>;
}
