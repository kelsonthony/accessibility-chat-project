import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { TelemetryEventInput } from '@accessibility-platform/contracts';

import { DatabaseService } from '../database/database.service';
import type { DataQueryDto } from './dto/data-query.dto';
import { buildTelemetryFilters } from './telemetry-sql';

@Injectable()
export class TelemetryService {
  constructor(private readonly database: DatabaseService) {}

  async collect(userId: string, events: TelemetryEventInput[]) {
    const client = await this.database.pool.connect();

    try {
      await client.query('begin');

      for (const event of events) {
        await client.query(
          `insert into accesschat.telemetry_events (
            id, user_id, session_id, event_type, timestamp, metadata
          ) values ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            randomUUID(),
            userId,
            event.sessionId,
            event.eventType,
            event.timestamp,
            JSON.stringify(event.metadata),
          ],
        );
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const countResult = await this.database.pool.query<{ total: string }>(
      `select cast(count(*) as text) as total from accesschat.telemetry_events`,
    );

    return {
      accepted: true,
      batchSize: events.length,
      totalStored: Number(countResult.rows[0]?.total || 0),
      mode: 'postgres-batch-write',
    };
  }

  async query(filters: DataQueryDto) {
    const { clauses, values } = buildTelemetryFilters(filters);

    const result = await this.database.pool.query<{
      id: string;
      user_id: string | null;
      session_id: string;
      event_type: string;
      timestamp: string;
      metadata: Record<string, string | number | boolean | null>;
    }>(
      `select id, user_id, session_id, event_type, timestamp, metadata
       from accesschat.telemetry_events
       where ${clauses.join(' and ')}
       order by timestamp desc
       limit 100`,
      values,
    );

    return {
      total: result.rows.length,
      items: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        eventType: row.event_type,
        timestamp: row.timestamp,
        metadata: row.metadata,
      })),
    };
  }
}
