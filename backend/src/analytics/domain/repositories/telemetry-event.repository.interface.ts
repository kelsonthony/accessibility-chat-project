export const TELEMETRY_EVENT_REPOSITORY = Symbol('ITelemetryEventRepository');

export interface TelemetryEventRecord {
  id: string;
  userId: string;
  sessionId: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface TelemetryQueryFilters {
  userId?: string;
  sessionId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ITelemetryEventRepository {
  saveMany(userId: string, events: Array<{
    sessionId: string;
    eventType: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }>): Promise<number>;
  query(filters: TelemetryQueryFilters): Promise<{ total: number; items: TelemetryEventRecord[] }>;
  count(): Promise<number>;
}
