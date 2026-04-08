import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly database: DatabaseService) {}

  async list() {
    const result = await this.database.pool.query<{
      id: string;
      source_key: string;
      title: string;
      source_type: string;
      jurisdiction: string;
      language: string;
      official_url: string;
      version: string | null;
      synced_at: string;
      chunk_count: string;
    }>(`
      select
        d.id,
        d.source_key,
        d.title,
        d.source_type,
        d.jurisdiction,
        d.language,
        d.official_url,
        d.version,
        d.synced_at,
        cast(count(dc.id) as text) as chunk_count
      from accesschat.documents d
      left join accesschat.document_chunks dc on dc.document_id = d.id
      group by d.id
      order by d.synced_at desc
    `);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        sourceKey: row.source_key,
        title: row.title,
        sourceType: row.source_type,
        jurisdiction: row.jurisdiction,
        language: row.language,
        officialUrl: row.official_url,
        version: row.version,
        syncedAt: row.synced_at,
        chunkCount: Number(row.chunk_count),
      })),
      status: result.rows.length > 0 ? 'ready' : 'empty',
    };
  }
}
