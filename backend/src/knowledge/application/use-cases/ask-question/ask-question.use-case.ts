import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';

import type { AskQuestionInput, AskQuestionResponse } from '@accessibility-platform/contracts';

import { DatabaseService } from '../../../../database/database.service';
import { DOCUMENT_CHUNK_REPOSITORY, type IDocumentChunkRepository } from '../../../domain/repositories/document.repository.interface';
import { buildFallbackAnswer, detectLanguage } from '../../../../rag/rag-response';
import { rankCandidates } from '../../../../rag/rag-ranking.util';
import { LlmService } from '../../../../rag/llm.service';

function tokenize(question: string): string[] {
  const importantAcronyms = ['ada', 'lbi', 'eu', 'us', 'br', 'un', 'en', 'eaa'];
  return question
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/gi, ' ')
    .split(/\s+/)
    .filter((term) => importantAcronyms.includes(term) || term.length >= 3)
    .slice(0, 12);
}

@Injectable()
export class AskQuestionUseCase {
  private readonly logger = new Logger(AskQuestionUseCase.name);

  constructor(
    @Inject(DOCUMENT_CHUNK_REPOSITORY) private readonly chunkRepo: IDocumentChunkRepository,
    private readonly database: DatabaseService,
    private readonly llm: LlmService,
  ) {}

  async answer(userId: string, input: AskQuestionInput): Promise<AskQuestionResponse> {
    const startedAt = Date.now();
    const language = input.language ?? detectLanguage(input.question);
    const terms = tokenize(input.question);
    const jurisdictions = input.jurisdictions?.length ? input.jurisdictions : ['GLOBAL'];

    if (terms.length === 0) {
      const fallback = buildFallbackAnswer({ ...input, language });
      await this.persistRun(userId, input.question, language, jurisdictions, 'fallback', 'fallback-local', [], startedAt);
      return fallback;
    }

    const rows = await this.chunkRepo.findByTerms(terms, jurisdictions);
    const rankedRows = rankCandidates(rows, terms, language, jurisdictions);

    if (rankedRows.length === 0) {
      const fallback = buildFallbackAnswer({ ...input, language });
      await this.persistRun(userId, input.question, language, jurisdictions, 'fallback', 'fallback-no-evidence', [], startedAt);
      return fallback;
    }

    const llmAnswer = await this.llm.generateGroundedAnswer(input.question, language, rankedRows);
    const answer = llmAnswer?.answer ?? composeGroundedAnswer(language, rankedRows);
    const responseOrigin = llmAnswer ? `llm:${llmAnswer.provider}` : 'grounded-local';

    await this.persistRun(userId, input.question, language, jurisdictions, 'rag', responseOrigin, rankedRows, startedAt, llmAnswer?.model);
    this.logger.log(`RAG answered in ${Date.now() - startedAt}ms, chunks=${rankedRows.length}, origin=${responseOrigin}`);

    return {
      answer,
      confidence: 0.82,
      language,
      mode: 'rag',
      sources: rankedRows.map((row) => ({
        id: row.id,
        title: row.title,
        section: row.section,
        source: mapSourceKey(row.source_key),
        language: normalizeLanguage(row.language),
        officialUrl: row.official_url,
      })),
    };
  }

  private async persistRun(
    userId: string,
    question: string,
    language: AskQuestionResponse['language'],
    jurisdictions: string[],
    mode: AskQuestionResponse['mode'],
    responseOrigin: string,
    rows: Array<{ id: string; title: string; section: string; official_url?: string; officialUrl?: string }>,
    startedAt: number,
    providerModel?: string,
  ) {
    await this.database.pool.query(
      `insert into accesschat.rag_query_runs
         (id, user_id, question_hash, language, jurisdictions, mode, response_origin, provider_model, retrieved_chunks, latency_ms, sources)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        randomUUID(), userId,
        createHash('sha256').update(question).digest('hex'),
        language, JSON.stringify(jurisdictions), mode, responseOrigin,
        providerModel ?? null, rows.length, Date.now() - startedAt,
        JSON.stringify(rows.map((r) => ({ id: r.id, title: r.title, section: r.section, officialUrl: r.official_url ?? r.officialUrl }))),
      ],
    );
  }
}

function composeGroundedAnswer(
  language: AskQuestionResponse['language'],
  rows: Array<{ title: string; section: string; content: string }>,
): string {
  const excerpts = rows.map((r) => `- ${r.title} ${r.section}: ${r.content.slice(0, 280)}`);
  if (language === 'en') return `Grounded answer from ingested sources.\n\n${excerpts.join('\n')}`;
  if (language === 'es') return `Respuesta fundamentada.\n\n${excerpts.join('\n')}`;
  return `Resposta fundamentada com fontes de acessibilidade.\n\n${excerpts.join('\n')}`;
}

function mapSourceKey(sourceKey: string): 'LBI' | 'HAND_TALK' | 'WCAG' | 'ADA' | 'SECTION_508' | 'EAA' | 'EN_301_549' | 'UN_CRPD' {
  const map: Record<string, 'LBI' | 'HAND_TALK' | 'WCAG' | 'ADA' | 'SECTION_508' | 'EAA' | 'EN_301_549' | 'UN_CRPD'> = {
    lbi: 'LBI', hand_talk: 'HAND_TALK', wcag_2_2: 'WCAG', ada: 'ADA',
    section_508: 'SECTION_508', eaa: 'EAA', en_301_549: 'EN_301_549', un_crpd: 'UN_CRPD',
  };
  return map[sourceKey] ?? 'WCAG';
}

function normalizeLanguage(language: string): 'pt' | 'en' | 'es' {
  if (language === 'pt' || language === 'en' || language === 'es') return language;
  return 'en';
}
