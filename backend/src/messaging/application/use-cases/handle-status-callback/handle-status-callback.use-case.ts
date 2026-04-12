import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { WHATSAPP_CONTACT_REPOSITORY, type IWhatsappContactRepository } from '../../../domain/repositories/whatsapp-contact.repository.interface';

@Injectable()
export class HandleStatusCallbackUseCase {
  private readonly logger = new Logger(HandleStatusCallbackUseCase.name);

  constructor(
    @Inject(WHATSAPP_CONTACT_REPOSITORY) private readonly contactRepo: IWhatsappContactRepository,
  ) {}

  async execute(payload: Record<string, string | undefined>): Promise<void> {
    const messageSid = payload.MessageSid?.trim();
    const messageStatus = payload.MessageStatus?.trim();

    if (!messageSid || !messageStatus) {
      this.logger.debug('Ignoring incomplete WhatsApp status callback payload.');
      return;
    }

    await this.contactRepo.saveStatusEvent({
      id: randomUUID(),
      messageSid,
      messageStatus,
      to: payload.To,
      from: payload.From,
      channelStatus: payload.ChannelStatusMessage,
      errorCode: payload.ErrorCode,
      errorMessage: payload.ErrorMessage,
      payload,
    });

    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      this.logger.warn(
        `WhatsApp ${messageStatus} for ${messageSid}. error=${payload.ErrorCode ?? 'n/a'} ${payload.ErrorMessage ?? ''}`.trim(),
      );
      return;
    }

    this.logger.log(`WhatsApp status ${messageStatus} recorded for ${messageSid}.`);
  }
}
