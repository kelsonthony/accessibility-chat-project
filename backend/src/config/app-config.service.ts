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
}
