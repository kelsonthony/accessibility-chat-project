import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './common/health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { DatabaseModule } from './database/database.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RagModule } from './rag/rag.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ChatModule,
    HealthModule,
    UsersModule,
    TelemetryModule,
    RagModule,
    IngestionModule,
    DocumentsModule,
    WhatsappModule,
  ],
})
export class AppModule {}
