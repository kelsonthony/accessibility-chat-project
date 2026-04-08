import { Injectable, Logger } from '@nestjs/common';

import type { SupportedLanguage } from '@accessibility-platform/contracts';

import { AppConfigService } from '../config/app-config.service';
import { buildPrompt } from './llm-prompt.util';
import type { RagCandidate } from './rag-ranking.util';

export type LlmGenerationResult = {
  answer: string;
  model: string;
  provider: 'openai-compatible';
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly config: AppConfigService;

  constructor(config: AppConfigService) {
    this.config = config;
  }

  isConfigured() {
    return Boolean(this.config.llmApiKey && this.config.llmModel);
  }

  async generateGroundedAnswer(
    question: string,
    language: SupportedLanguage,
    rows: RagCandidate[],
  ): Promise<LlmGenerationResult | null> {
    if (!this.isConfigured() || rows.length === 0) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.llmTimeoutMs);

    try {
      const response = await fetch(this.config.llmApiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.config.llmModel,
          temperature: 0.2,
          messages: buildPrompt(question, language, rows, this.config.llmPromptVersion),
        }),
      });

      if (!response.ok) {
        this.logger.warn(`LLM provider returned ${response.status}. Falling back to local grounded response.`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        return null;
      }

      return {
        answer: content,
        model: payload.model || this.config.llmModel,
        provider: 'openai-compatible',
      };
    } catch (error) {
      this.logger.warn('LLM provider unavailable. Falling back to local grounded response.');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
