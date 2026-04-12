import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { IdentityModule } from '../../identity/infra/identity.module';
import { TELEMETRY_EVENT_REPOSITORY } from '../domain/repositories/telemetry-event.repository.interface';
import { TelemetryController } from '../application/controllers/telemetry.controller';
import { CollectEventsUseCase } from '../application/use-cases/collect-events/collect-events.use-case';
import { QueryEventsUseCase } from '../application/use-cases/query-events/query-events.use-case';
import { PostgresTelemetryEventRepository } from './persistence/postgres/telemetry-event.repository';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [TelemetryController],
  providers: [
    { provide: TELEMETRY_EVENT_REPOSITORY, useClass: PostgresTelemetryEventRepository },
    CollectEventsUseCase,
    QueryEventsUseCase,
  ],
})
export class AnalyticsModule {}
