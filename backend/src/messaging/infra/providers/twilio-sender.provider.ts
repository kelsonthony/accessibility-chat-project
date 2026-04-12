import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service';
import { WhatsappNotConfiguredException } from '../../domain/exceptions';

@Injectable()
export class TwilioSenderProvider {
  private readonly logger = new Logger(TwilioSenderProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async send(to: string, body: string): Promise<void> {
    if (!this.config.whatsappAccountSid || !this.config.whatsappAuthToken || !this.config.whatsappFromNumber) {
      throw new WhatsappNotConfiguredException();
    }

    const url = `${this.config.whatsappApiBaseUrl}/2010-04-01/Accounts/${this.config.whatsappAccountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.config.whatsappAccountSid}:${this.config.whatsappAuthToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ From: this.config.whatsappFromNumber, To: to, Body: body }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio API returned ${response.status}: ${errorBody}`);
    }

    this.logger.log(`WhatsApp message sent to ${to}.`);
  }
}
