import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../../../database/database.service';
import type {
  ITelemetryEventRepository,
  TelemetryEventRecord,
  TelemetryQueryFilters,
} from '../../../domain/repositories/telemetry-event.repository.interface';

@Injectable()
export class PostgresTelemetryEventRepository implements ITelemetryEventRepository {
  constructor(private readonly database: DatabaseService) {}

  async saveMany(userId: string, events: Array<{
    sessionId: string;
    eventType: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }>): Promise<number> {
    const client = await this.database.pool.connect();
    try {
      await client.query('begin');
      for (const event of events) {
        await client.query(
          `insert into accesschat.telemetry_events (id, user_id, session_id, event_type, timestamp, metadata)
           values ($1,$2,$3,$4,$5,$6::jsonb)`,
          [randomUUID(), userId, event.sessionId, event.eventType, event.timestamp, JSON.stringify(event.metadata)],
        );
      }
      await client.query('commit');
      return events.length;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async query(filters: TelemetryQueryFilters): Promise<{ total: number; items: TelemetryEventRecord[] }> {
    const clauses: string[] = ['1=1'];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.userId) { clauses.push(`user_id = $${idx++}`); values.push(filters.userId); }
    if (filters.sessionId) { clauses.push(`session_id = $${idx++}`); values.push(filters.sessionId); }
    if (filters.eventType) { clauses.push(`event_type = $${idx++}`); values.push(filters.eventType); }
    if (filters.from) { clauses.push(`timestamp >= $${idx++}`); values.push(filters.from); }
    if (filters.to) { clauses.push(`timestamp <= $${idx++}`); values.push(filters.to); }

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
       limit ${filters.limit ?? 100}`,
      values,
    );

    return {
      total: result.rows.length,
      items: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id ?? '',
        sessionId: row.session_id,
        eventType: row.event_type,
        timestamp: row.timestamp,
        metadata: row.metadata,
      })),
    };
  }

  async count(): Promise<number> {
    const result = await this.database.pool.query<{ total: string }>(
      `select cast(count(*) as text) as total from accesschat.telemetry_events`,
    );
    return Number(result.rows[0]?.total ?? 0);
  }
}
