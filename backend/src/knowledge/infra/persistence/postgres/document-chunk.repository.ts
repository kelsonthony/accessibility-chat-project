import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../../database/database.service';
import type { DocumentChunkRow, IDocumentChunkRepository } from '../../../domain/repositories/document.repository.interface';

@Injectable()
export class PostgresDocumentChunkRepository implements IDocumentChunkRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByTerms(terms: string[], jurisdictions: string[]): Promise<DocumentChunkRow[]> {
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
      `select dc.id, d.title, dc.section, d.source_key, d.language, d.jurisdiction, d.official_url, dc.content
       from accesschat.document_chunks dc
       inner join accesschat.documents d on d.id = dc.document_id
       where (d.jurisdiction = any($2::text[]) or d.jurisdiction = 'GLOBAL')
         and (
           lower(dc.content) like any($1::text[])
           or lower(dc.section) like any($1::text[])
           or lower(d.title) like any($1::text[])
           or lower(d.source_key) like any($1::text[])
         )
       order by
         case when lower(d.source_key) = any($3::text[]) then 1 else 2 end,
         case when lower(d.title) like any($1::text[]) then 1 else 2 end
       limit 120`,
      [terms.map((t) => `%${t}%`), jurisdictions, terms],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      section: row.section,
      source_key: row.source_key,
      language: row.language,
      jurisdiction: row.jurisdiction,
      official_url: row.official_url,
      content: row.content,
    }));
  }

  async upsertChunk(params: {
    id: string;
    documentId: string;
    chunkKey: string;
    content: string;
    section: string;
    metadata: Record<string, unknown>;
    embedding: unknown;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.document_chunks (id, document_id, chunk_key, content, section, metadata, embedding)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       on conflict (chunk_key) do update set
         content = excluded.content, section = excluded.section,
         metadata = excluded.metadata, embedding = excluded.embedding`,
      [params.id, params.documentId, params.chunkKey, params.content, params.section,
       JSON.stringify(params.metadata), JSON.stringify(params.embedding)],
    );
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.database.pool.query(
      `delete from accesschat.document_chunks where document_id = $1`,
      [documentId],
    );
  }
}
