import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AnalyticsModule } from './analytics/infra/analytics.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './common/health/health.module';
import { HttpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import { MetricsModule } from './common/metrics/metrics.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { IdentityModule } from './identity/infra/identity.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { KnowledgeModule } from './knowledge/infra/knowledge.module';
import { MessagingModule } from './messaging/infra/messaging.module';
import { RagModule } from './rag/rag.module';

/**
 * AppModule wires the four bounded contexts following DDD:
 *
 *   identity   → authentication, users, captcha, VOs, domain exceptions
 *   knowledge  → RAG pipeline, documents, ingestion, LLM
 *   messaging  → WhatsApp webhook, email delivery
 *   analytics  → behavioral telemetry events
 *
 * Cross-cutting: DatabaseModule, HealthModule, MetricsModule, ChatModule
 *
 * Legacy modules (RagModule, IngestionModule, DocumentsModule) are kept
 * to preserve existing HTTP routes while the migration is in progress.
 */
@Module({
  imports: [
    // Infrastructure
    DatabaseModule,
    HealthModule,
    MetricsModule,
    // Bounded contexts
    IdentityModule,
    KnowledgeModule,
    MessagingModule,
    AnalyticsModule,
    // Chat WebSocket gateway
    ChatModule,
    // Legacy routes (controllers not yet migrated to context folders)
    RagModule,
    IngestionModule,
    DocumentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
