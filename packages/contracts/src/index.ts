export type SupportedLanguage = 'pt' | 'en' | 'es';
export type Jurisdiction = 'GLOBAL' | 'BR' | 'US' | 'EU';

export type KnowledgeSource =
  | 'WCAG'
  | 'UNDERSTANDING_WCAG'
  | 'LBI'
  | 'HAND_TALK'
  | 'ADA'
  | 'SECTION_508'
  | 'UN_CRPD'
  | 'EAA'
  | 'EN_301_549';

export type TelemetryEventType =
  | 'session_started'
  | 'session_ended'
  | 'login_succeeded'
  | 'login_failed'
  | 'signup_succeeded'
  | 'signup_failed'
  | 'message_started'
  | 'message_sent'
  | 'message_cleared'
  | 'message_edited'
  | 'answer_received'
  | 'answer_regenerated'
  | 'source_citation_clicked'
  | 'typing_pause_detected'
  | 'repeated_backspace_burst'
  | 'message_abandoned'
  | 'repeated_question_rephrase'
  | 'validation_error_seen'
  | 'keyboard_navigation_detected'
  | 'focus_loss_detected'
  | 'high_contrast_mode_enabled'
  | 'language_changed'
  | 'assistive_pattern_detected'
  | 'accessibility_help_opened'
  | 'request_latency_observed'
  | 'batch_flush_success'
  | 'batch_flush_failed'
  | 'websocket_disconnected'
  | 'retry_triggered';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RagSourceReference {
  id: string;
  title: string;
  section: string;
  source: KnowledgeSource;
  language: SupportedLanguage;
  officialUrl: string;
}

export interface AskQuestionInput {
  question: string;
  language?: SupportedLanguage;
  jurisdictions?: Jurisdiction[];
}

export interface AskQuestionResponse {
  answer: string;
  confidence: number;
  language: SupportedLanguage;
  mode: 'fallback' | 'rag';
  sources: RagSourceReference[];
}

export interface TelemetryEventInput {
  userId?: string;
  sessionId: string;
  eventType: TelemetryEventType;
  timestamp: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CollectTelemetryInput {
  events: TelemetryEventInput[];
}

export interface TelemetryDataItem extends TelemetryEventInput {
  id: string;
}

export interface TelemetryDataResponse {
  total: number;
  items: TelemetryDataItem[];
}
