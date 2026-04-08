import { Injectable } from '@nestjs/common';

import type { AskQuestionInput, AskQuestionResponse } from '@accessibility-platform/contracts';

import { DatabaseService } from '../database/database.service';
import { buildFallbackAnswer, detectLanguage } from './rag-response';

@Injectable()
export class RagService {
  constructor(private readonly database: DatabaseService) {}

  async answer(_userId: string, input: AskQuestionInput): Promise<AskQuestionResponse> {
    const language = input.language || detectLanguage(input.question);
    const terms = tokenize(input.question);
    const jurisdictions = input.jurisdictions?.length ? input.jurisdictions : ['GLOBAL'];

    if (terms.length === 0) {
      return buildFallbackAnswer({
        ...input,
        language,
      });
    }

    const result = await this.database.pool.query<{
      id: string;
      title: string;
      section: string;
      source_key: string;
      language: string;
      official_url: string;
      content: string;
      rank: string;
    }>(
      `
      select
        dc.id,
        d.title,
        dc.section,
        d.source_key,
        d.language,
        d.official_url,
        dc.content,
        cast(sum(
          case
            when lower(dc.content) like any($1::text[]) then 2
            when lower(dc.section) like any($1::text[]) then 3
            when lower(d.title) like any($1::text[]) then 4
            else 0
          end
        ) as text) as rank
      from document_chunks dc
      inner join documents d on d.id = dc.document_id
      where d.jurisdiction = any($2::text[]) or d.jurisdiction = 'GLOBAL'
      group by dc.id, d.title, dc.section, d.source_key, d.language, d.official_url, dc.content
      having sum(
        case
          when lower(dc.content) like any($1::text[]) then 2
          when lower(dc.section) like any($1::text[]) then 3
          when lower(d.title) like any($1::text[]) then 4
          else 0
        end
      ) > 0
      order by sum(
        case
          when lower(dc.content) like any($1::text[]) then 2
          when lower(dc.section) like any($1::text[]) then 3
          when lower(d.title) like any($1::text[]) then 4
          else 0
        end
      ) desc, dc.section asc
      limit 3
      `,
      [terms.map((term) => `%${term}%`), jurisdictions],
    );

    if (result.rows.length === 0) {
      return buildFallbackAnswer({
        ...input,
        language,
      });
    }

    return {
      answer: composeGroundedAnswer(language, result.rows),
      confidence: 0.76,
      language,
      mode: 'rag',
      sources: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        section: row.section,
        source: mapSourceKey(row.source_key),
        language: normalizeLanguage(row.language),
        officialUrl: row.official_url,
      })),
    };
  }
}

function tokenize(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/gi, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3)
    .slice(0, 8);
}

function composeGroundedAnswer(
  language: AskQuestionResponse['language'],
  rows: Array<{ title: string; section: string; content: string }>,
) {
  const excerpts = rows.map((row) => `${row.title} ${row.section}: ${row.content}`);

  if (language === 'en') {
    return `Grounded answer assembled from ingested accessibility sources.\n\n${excerpts.join('\n')}`;
  }

  if (language === 'es') {
    return `Respuesta fundamentada con fuentes de accesibilidad ya ingeridas.\n\n${excerpts.join('\n')}`;
  }

  return `Resposta fundamentada com fontes de acessibilidade já ingeridas.\n\n${excerpts.join('\n')}`;
}

function mapSourceKey(sourceKey: string) {
  if (sourceKey === 'lbi') {
    return 'LBI' as const;
  }

  if (sourceKey === 'wcag_2_2') {
    return 'WCAG' as const;
  }

  return 'WCAG' as const;
}

function normalizeLanguage(language: string) {
  if (language === 'pt' || language === 'en' || language === 'es') {
    return language;
  }

  return 'en';
}
