import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './common/health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { DatabaseModule } from './database/database.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RagModule } from './rag/rag.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'change-me',
      signOptions: { expiresIn: '1h' },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    TelemetryModule,
    RagModule,
    IngestionModule,
    DocumentsModule,
  ],
})
export class AppModule {}
