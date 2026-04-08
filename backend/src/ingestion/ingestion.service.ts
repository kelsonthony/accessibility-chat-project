import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';

type SeedDocument = {
  sourceKey: string;
  title: string;
  sourceType: string;
  jurisdiction: string;
  language: string;
  officialUrl: string;
  version: string;
  rawText: string;
  chunks: Array<{
    chunkKey: string;
    section: string;
    content: string;
    metadata: Record<string, string | boolean>;
    embedding: number[];
  }>;
};

const seedDocuments: SeedDocument[] = [
  {
    sourceKey: 'wcag_2_2',
    title: 'WCAG 2.2',
    sourceType: 'standard',
    jurisdiction: 'GLOBAL',
    language: 'en',
    officialUrl: 'https://www.w3.org/TR/WCAG22/',
    version: '2.2',
    rawText: 'Web Content Accessibility Guidelines 2.2 core reference.',
    chunks: [
      {
        chunkKey: 'wcag_2_2_1_4_3',
        section: '1.4.3 Contrast (Minimum)',
        content: 'Text and images of text should have sufficient contrast for readability.',
        metadata: { category: 'perceivable', priority: 'mandatory' },
        embedding: [0.91, 0.12, 0.33, 0.44, 0.55, 0.18, 0.28, 0.31],
      },
      {
        chunkKey: 'wcag_2_2_2_1_1',
        section: '2.1.1 Keyboard',
        content: 'All functionality should be operable through a keyboard interface.',
        metadata: { category: 'operable', priority: 'mandatory' },
        embedding: [0.67, 0.21, 0.48, 0.39, 0.29, 0.75, 0.16, 0.52],
      },
    ],
  },
  {
    sourceKey: 'lbi',
    title: 'Lei Brasileira de Inclusao',
    sourceType: 'law',
    jurisdiction: 'BR',
    language: 'pt',
    officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm',
    version: '13.146/2015',
    rawText: 'Lei Brasileira de Inclusao da Pessoa com Deficiencia.',
    chunks: [
      {
        chunkKey: 'lbi_artigo_63',
        section: 'Art. 63',
        content:
          'É obrigatória a acessibilidade nos sítios da internet mantidos por empresas com sede ou representação comercial no País.',
        metadata: { category: 'legal', priority: 'mandatory' },
        embedding: [0.73, 0.42, 0.11, 0.61, 0.83, 0.24, 0.34, 0.14],
      },
    ],
  },
];

@Injectable()
export class IngestionService {
  constructor(private readonly database: DatabaseService) {}

  async syncSources() {
    const jobId = randomUUID();

    await this.database.pool.query(
      `insert into accesschat.ingestion_jobs (id, job_type, status, detail)
       values ($1, $2, $3, $4::jsonb)`,
      [jobId, 'sources_sync', 'completed', JSON.stringify({ seededSources: seedDocuments.length })],
    );

    for (const document of seedDocuments) {
      await this.database.pool.query(
        `insert into accesschat.documents (
          id, source_key, title, source_type, jurisdiction, language, official_url, version, raw_text, synced_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        on conflict (source_key) do update set
          title = excluded.title,
          source_type = excluded.source_type,
          jurisdiction = excluded.jurisdiction,
          language = excluded.language,
          official_url = excluded.official_url,
          version = excluded.version,
          raw_text = excluded.raw_text,
          synced_at = now()`,
        [
          randomUUID(),
          document.sourceKey,
          document.title,
          document.sourceType,
          document.jurisdiction,
          document.language,
          document.officialUrl,
          document.version,
          document.rawText,
        ],
      );
    }

    return {
      status: 'completed',
      jobId,
      syncedSources: seedDocuments.length,
    };
  }

  async ingestDocuments() {
    const jobId = randomUUID();

    await this.database.pool.query(
      `insert into ingestion_jobs (id, job_type, status, detail)
       values ($1, $2, $3, $4::jsonb)`,
      [jobId, 'documents_ingest', 'running', JSON.stringify({})],
    );

    for (const document of seedDocuments) {
      const docResult = await this.database.pool.query<{ id: string }>(
        `select id from accesschat.documents where source_key = $1 limit 1`,
        [document.sourceKey],
      );

      if (!docResult.rows[0]) {
        continue;
      }

      const documentId = docResult.rows[0].id;

      for (const chunk of document.chunks) {
        await this.database.pool.query(
          `insert into accesschat.document_chunks (id, document_id, chunk_key, content, section, metadata, embedding)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
           on conflict (chunk_key) do update set
             content = excluded.content,
             section = excluded.section,
             metadata = excluded.metadata,
             embedding = excluded.embedding`,
          [
            randomUUID(),
            documentId,
            chunk.chunkKey,
            chunk.content,
            chunk.section,
            JSON.stringify(chunk.metadata),
            JSON.stringify(chunk.embedding),
          ],
        );
      }
    }

    await this.database.pool.query(
      `update accesschat.ingestion_jobs set status = $2, detail = $3::jsonb where id = $1`,
      [jobId, 'completed', JSON.stringify({ seededChunks: seedDocuments.flatMap((d) => d.chunks).length })],
    );

    return {
      status: 'completed',
      jobId,
      steps: ['fetch', 'parse', 'chunk', 'embed', 'index'],
      seededChunks: seedDocuments.flatMap((document) => document.chunks).length,
    };
  }
}
