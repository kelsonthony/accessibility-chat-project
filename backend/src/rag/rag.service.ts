import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';

import type { AskQuestionInput, AskQuestionResponse } from '@accessibility-platform/contracts';

import { DatabaseService } from '../database/database.service';
import { LlmService } from './llm.service';
import { buildFallbackAnswer, detectLanguage } from './rag-response';
import { rankCandidates } from './rag-ranking.util';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly llm: LlmService,
  ) {}

  async answer(_userId: string, input: AskQuestionInput): Promise<AskQuestionResponse> {
    const startedAt = Date.now();
    const language = input.language || detectLanguage(input.question);
    const terms = tokenize(input.question);
    const jurisdictions = input.jurisdictions?.length ? input.jurisdictions : ['GLOBAL'];

    if (terms.length === 0) {
      const fallback = buildFallbackAnswer({
        ...input,
        language,
      });

      await this.persistRun(_userId, input.question, language, jurisdictions, fallback.mode, 'fallback-local', [], startedAt);
      return fallback;
    }

    const result = await this.database.pool.query<{
      id: string;
      title: string;
      section: string;
      source_key: string;
      language: string;
      jurisdiction: string;
      official_url: string;
      content: string;
    }>(
      `
      select
        dc.id,
        d.title,
        dc.section,
        d.source_key,
        d.language,
        d.jurisdiction,
        d.official_url,
        dc.content
      from accesschat.document_chunks dc
      inner join accesschat.documents d on d.id = dc.document_id
      where (d.jurisdiction = any($2::text[]) or d.jurisdiction = 'GLOBAL')
      and (
        lower(dc.content) like any($1::text[])
        or lower(dc.section) like any($1::text[])
        or lower(d.title) like any($1::text[])
      )
      limit 120
      `,
      [terms.map((term) => `%${term}%`), jurisdictions],
    );

    const rankedRows = rankCandidates(result.rows, terms, language, jurisdictions);

    if (rankedRows.length === 0) {
      const fallback = buildFallbackAnswer({
        ...input,
        language,
      });

      await this.persistRun(_userId, input.question, language, jurisdictions, fallback.mode, 'fallback-no-evidence', [], startedAt);
      return fallback;
    }

    const llmAnswer = await this.llm.generateGroundedAnswer(input.question, language, rankedRows);
    const answer = llmAnswer?.answer || composeGroundedAnswer(language, rankedRows);
    const responseOrigin = llmAnswer ? `llm:${llmAnswer.provider}` : 'grounded-local';

    await this.persistRun(_userId, input.question, language, jurisdictions, 'rag', responseOrigin, rankedRows, startedAt, llmAnswer?.model);

    this.logger.log(
      `RAG answered in ${Date.now() - startedAt}ms with ${rankedRows.length} chunks, origin=${responseOrigin}, language=${language}`,
    );

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
    rows: Array<{ id: string; title: string; section: string; official_url?: string }>,
    startedAt: number,
    providerModel?: string,
  ) {
    const latencyMs = Date.now() - startedAt;
    const questionHash = createHash('sha256').update(question).digest('hex');

    await this.database.pool.query(
      `insert into accesschat.rag_query_runs (
        id, user_id, question_hash, language, jurisdictions, mode, response_origin,
        provider_model, retrieved_chunks, latency_ms, sources
      ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        randomUUID(),
        userId,
        questionHash,
        language,
        JSON.stringify(jurisdictions),
        mode,
        responseOrigin,
        providerModel || null,
        rows.length,
        latencyMs,
        JSON.stringify(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            section: row.section,
            officialUrl: row.official_url,
          })),
        ),
      ],
    );
  }
}

function tokenize(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/gi, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3)
    .slice(0, 12);
}

function composeGroundedAnswer(
  language: AskQuestionResponse['language'],
  rows: Array<{ title: string; section: string; content: string }>,
) {
  const excerpts = rows.map((row) => `- ${row.title} ${row.section}: ${summarizeExcerpt(row.content)}`);

  if (language === 'en') {
    return `Grounded answer assembled from ingested accessibility sources.\n\n${excerpts.join('\n')}`;
  }

  if (language === 'es') {
    return `Respuesta fundamentada con fuentes de accesibilidad ya ingeridas.\n\n${excerpts.join('\n')}`;
  }

  return `Resposta fundamentada com fontes de acessibilidade já ingeridas.\n\n${excerpts.join('\n')}`;
}

function summarizeExcerpt(content: string) {
  const cleaned = content
    .replace(/\s+/g, ' ')
    .replace(/\|\s*/g, ' ')
    .replace(/skip to [^.]+/gi, ' ')
    .replace(/an official website of the united states government/gi, ' ')
    .replace(/official websites use \.gov/gi, ' ')
    .replace(/secure \.gov websites use https/gi, ' ')
    .replace(/a \.gov website belongs to an official government organization in the united states/gi, ' ')
    .trim();

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
  return firstSentence.length > 280 ? `${firstSentence.slice(0, 277).trim()}...` : firstSentence;
}

function mapSourceKey(sourceKey: string) {
  if (sourceKey === 'lbi') {
    return 'LBI' as const;
  }

  if (sourceKey === 'hand_talk') {
    return 'HAND_TALK' as const;
  }

  if (sourceKey === 'wcag_2_2') {
    return 'WCAG' as const;
  }

  if (sourceKey === 'ada') {
    return 'ADA' as const;
  }

  if (sourceKey === 'section_508') {
    return 'SECTION_508' as const;
  }

  if (sourceKey === 'eaa') {
    return 'EAA' as const;
  }

  if (sourceKey === 'en_301_549') {
    return 'EN_301_549' as const;
  }

  if (sourceKey === 'un_crpd') {
    return 'UN_CRPD' as const;
  }

  return 'WCAG' as const;
}

function normalizeLanguage(language: string) {
  if (language === 'pt' || language === 'en' || language === 'es') {
    return language;
  }

  return 'en';
}
