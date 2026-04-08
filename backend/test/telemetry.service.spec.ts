import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTelemetryFilters } from '../src/telemetry/telemetry-sql.ts';

test('buildTelemetryFilters maps query DTO to SQL clauses', () => {
  const filtered = buildTelemetryFilters({
    sessionId: 'session-1',
    eventType: 'message_sent',
  });

  assert.deepEqual(filtered.clauses, ['1 = 1', 'session_id = $1', 'event_type = $2']);
  assert.deepEqual(filtered.values, ['session-1', 'message_sent']);
});
