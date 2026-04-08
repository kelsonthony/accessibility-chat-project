import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import { fetchSourceDocument } from './html-ingestion.util';
import { sourceDefinitions } from './source-definitions';

@Injectable()
export class IngestionService {
  constructor(private readonly database: DatabaseService) {}

  async syncSources() {
    const jobId = randomUUID();
    const results = [];

    for (const source of sourceDefinitions) {
      const fetched = await fetchSourceDocument(source);
      results.push({
        sourceKey: source.sourceKey,
        usedFallback: fetched.usedFallback,
        chunkCount: fetched.chunks.length,
      });

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
          source.sourceKey,
          source.title,
          source.sourceType,
          source.jurisdiction,
          source.language,
          source.officialUrl,
          source.version,
          fetched.rawText,
        ],
      );
    }

    await this.database.pool.query(
      `insert into accesschat.ingestion_jobs (id, job_type, status, detail)
       values ($1, $2, $3, $4::jsonb)`,
      [
        jobId,
        'sources_sync',
        'completed',
        JSON.stringify({
          syncedSources: results.length,
          fetchedFromOfficialSource: results.filter((result) => !result.usedFallback).length,
          usedFallback: results.filter((result) => result.usedFallback).length,
          results,
        }),
      ],
    );

    return {
      status: 'completed',
      jobId,
      syncedSources: results.length,
      officialSources: results.filter((result) => !result.usedFallback).length,
      fallbackSources: results.filter((result) => result.usedFallback).length,
    };
  }

  async ingestDocuments() {
    const jobId = randomUUID();

    await this.database.pool.query(
      `insert into accesschat.ingestion_jobs (id, job_type, status, detail)
       values ($1, $2, $3, $4::jsonb)`,
      [jobId, 'documents_ingest', 'running', JSON.stringify({})],
    );

    let ingestedChunks = 0;
    const results: Array<{ sourceKey: string; chunkCount: number; usedFallback: boolean }> = [];

    for (const source of sourceDefinitions) {
      const document = await fetchSourceDocument(source);
      const docResult = await this.database.pool.query<{ id: string }>(
        `select id from accesschat.documents where source_key = $1 limit 1`,
        [source.sourceKey],
      );

      if (!docResult.rows[0]) {
        continue;
      }

      const documentId = docResult.rows[0].id;

      await this.database.pool.query(`delete from accesschat.document_chunks where document_id = $1`, [documentId]);

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

      ingestedChunks += document.chunks.length;
      results.push({
        sourceKey: source.sourceKey,
        chunkCount: document.chunks.length,
        usedFallback: document.usedFallback,
      });
    }

    await this.database.pool.query(
      `update accesschat.ingestion_jobs set status = $2, detail = $3::jsonb where id = $1`,
      [
        jobId,
        'completed',
        JSON.stringify({
          ingestedChunks,
          officialSources: results.filter((result) => !result.usedFallback).length,
          fallbackSources: results.filter((result) => result.usedFallback).length,
          results,
        }),
      ],
    );

    return {
      status: 'completed',
      jobId,
      steps: ['fetch_official_html', 'normalize_html', 'chunk_document', 'store_chunks'],
      seededChunks: ingestedChunks,
      officialSources: results.filter((result) => !result.usedFallback).length,
      fallbackSources: results.filter((result) => result.usedFallback).length,
    };
  }
}
