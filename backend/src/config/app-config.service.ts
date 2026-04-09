import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  get jwtSecret(): string {
    return process.env.JWT_SECRET || 'change-me';
  }

  get backendPort(): number {
    return Number(process.env.BACKEND_PORT || 3001);
  }

  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/handtalk_challenge'
    );
  }

  get llmApiUrl(): string {
    return process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
  }

  get llmApiKey(): string {
    return process.env.LLM_API_KEY || '';
  }

  get llmModel(): string {
    return process.env.LLM_MODEL || '';
  }

  get llmTimeoutMs(): number {
    return Number(process.env.LLM_TIMEOUT_MS || 15000);
  }

  get llmPromptVersion(): string {
    return process.env.LLM_PROMPT_VERSION || 'v1-grounded-sources';
  }

  get emailApiUrl(): string {
    return process.env.EMAIL_API_URL || 'https://api.sendgrid.com/v3/mail/send';
  }

  get emailApiKey(): string {
    return process.env.EMAIL_API_KEY || '';
  }

  get emailFromAddress(): string {
    return process.env.EMAIL_FROM_ADDRESS || 'no-reply@accesschat.dev';
  }

  get emailFromName(): string {
    return process.env.EMAIL_FROM_NAME || 'Access Chat';
  }

  get emailDeliveryMode(): 'email-api' | 'console' {
    if (process.env.EMAIL_DELIVERY_MODE === 'console') {
      return 'console';
    }

    return this.emailApiKey ? 'email-api' : 'console';
  }

  get signupCodeTtlMs(): number {
    return Number(process.env.SIGNUP_CODE_TTL_MS || 60000);
  }

  get passwordResetCodeTtlMs(): number {
    return Number(process.env.PASSWORD_RESET_CODE_TTL_MS || 600000);
  }

  get captchaTtlMs(): number {
    return Number(process.env.CAPTCHA_TTL_MS || 300000);
  }

  get emailFailoverToConsole(): boolean {
    return process.env.EMAIL_FAILOVER_TO_CONSOLE !== 'false';
  }
}
