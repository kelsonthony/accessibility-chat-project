import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config/app-config.service';

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: AppConfigService) {}

  async send(input: MailInput): Promise<'email-api' | 'console'> {
    if (!this.config.emailApiKey || this.config.emailDeliveryMode === 'console') {
      this.logger.warn(`[EMAIL CONSOLE] To=${input.to} | ${input.subject}\n${input.text}`);
      return 'console';
    }

    try {
      const response = await fetch(this.config.emailApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to }] }],
          from: { email: this.config.emailFromAddress, name: this.config.emailFromName },
          subject: input.subject,
          content: [
            { type: 'text/plain', value: input.text },
            { type: 'text/html', value: input.html },
          ],
        }),
      });

      if (!response.ok) {
        const payload = await response.text();
        this.logger.error(`Email API ${response.status}: ${payload}`);

        if (this.config.emailFailoverToConsole) {
          this.logger.warn(`[EMAIL FAILOVER] ${input.to}: ${input.text}`);
          return 'console';
        }

        throw new Error('Não foi possível enviar o e-mail de verificação.');
      }
    } catch (error) {
      if (this.config.emailFailoverToConsole) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`[EMAIL FAILOVER] ${input.to}: ${msg}\n${input.text}`);
        return 'console';
      }
      throw error;
    }

    return 'email-api';
  }
}
