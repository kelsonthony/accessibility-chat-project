import type { DataQueryDto } from './dto/data-query.dto';

export function buildTelemetryFilters(filters: DataQueryDto) {
  const clauses = ['1 = 1'];
  const values: Array<string> = [];

  if (filters.userId) {
    values.push(filters.userId);
    clauses.push(`user_id = $${values.length}`);
  }

  if (filters.sessionId) {
    values.push(filters.sessionId);
    clauses.push(`session_id = $${values.length}`);
  }

  if (filters.eventType) {
    values.push(filters.eventType);
    clauses.push(`event_type = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    clauses.push(`timestamp >= $${values.length}`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    clauses.push(`timestamp <= $${values.length}`);
  }

  return { clauses, values };
}

