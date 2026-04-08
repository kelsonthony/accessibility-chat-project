import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

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

export class TelemetryEventDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  sessionId!: string;

  @IsEnum(telemetryEventTypes)
  eventType!: TelemetryEventType;

  @IsISO8601()
  timestamp!: string;

  @IsObject()
  metadata!: Record<string, string | number | boolean | null>;
}

export class CollectTelemetryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventDto)
  events!: TelemetryEventDto[];
}

