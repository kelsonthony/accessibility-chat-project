import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

import type { TelemetryEventType } from '@accessibility-platform/contracts';

const telemetryEventTypes = [
  'session_started',
  'session_ended',
  'login_succeeded',
  'login_failed',
  'signup_succeeded',
  'signup_failed',
  'message_started',
  'message_sent',
  'message_cleared',
  'message_edited',
  'answer_received',
  'answer_regenerated',
  'source_citation_clicked',
  'typing_pause_detected',
  'repeated_backspace_burst',
  'message_abandoned',
  'repeated_question_rephrase',
  'validation_error_seen',
  'keyboard_navigation_detected',
  'focus_loss_detected',
  'high_contrast_mode_enabled',
  'language_changed',
  'assistive_pattern_detected',
  'accessibility_help_opened',
  'request_latency_observed',
  'batch_flush_success',
  'batch_flush_failed',
  'websocket_disconnected',
  'retry_triggered',
] as const;

export class DataQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsEnum(telemetryEventTypes)
  eventType?: TelemetryEventType;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}

