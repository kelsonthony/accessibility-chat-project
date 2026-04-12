import { Inject, Injectable } from '@nestjs/common';

import {
  TELEMETRY_EVENT_REPOSITORY,
  type ITelemetryEventRepository,
  type TelemetryQueryFilters,
} from '../../../domain/repositories/telemetry-event.repository.interface';

@Injectable()
export class QueryEventsUseCase {
  constructor(
    @Inject(TELEMETRY_EVENT_REPOSITORY) private readonly eventRepo: ITelemetryEventRepository,
  ) {}

  async execute(filters: TelemetryQueryFilters) {
    return this.eventRepo.query(filters);
  }
}
