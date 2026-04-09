import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

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
      this.logger.warn(`Email fallback enabled for ${input.to}: ${input.subject}\n${input.text}`);
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
          from: {
            email: this.config.emailFromAddress,
            name: this.config.emailFromName,
          },
          subject: input.subject,
          content: [
            { type: 'text/plain', value: input.text },
            { type: 'text/html', value: input.html },
          ],
        }),
      });

      if (!response.ok) {
        const payload = await response.text();
        this.logger.error(`Email API request failed with status ${response.status}: ${payload}`);

        if (this.config.emailFailoverToConsole) {
          this.logger.warn(
            `Email API unavailable for ${input.to}. Falling back to console delivery.\n${input.text}`,
          );
          return 'console';
        }

        throw new Error('Nao foi possivel enviar o email de verificacao.');
      }
    } catch (error) {
      if (this.config.emailFailoverToConsole) {
        const message = error instanceof Error ? error.message : 'Unknown email API error';
        this.logger.warn(
          `Email API request failed for ${input.to}. Falling back to console delivery: ${message}\n${input.text}`,
        );
        return 'console';
      }

      throw error;
    }

    return 'email-api';
  }
}
