import { Inject, Injectable } from '@nestjs/common';

import type { TelemetryEventInput } from '@accessibility-platform/contracts';

import {
  TELEMETRY_EVENT_REPOSITORY,
  type ITelemetryEventRepository,
} from '../../../domain/repositories/telemetry-event.repository.interface';

@Injectable()
export class CollectEventsUseCase {
  constructor(
    @Inject(TELEMETRY_EVENT_REPOSITORY) private readonly eventRepo: ITelemetryEventRepository,
  ) {}

  async execute(userId: string, events: TelemetryEventInput[]) {
    await this.eventRepo.saveMany(userId, events);
    const totalStored = await this.eventRepo.count();

    return {
      accepted: true,
      batchSize: events.length,
      totalStored,
      mode: 'postgres-batch-write',
    };
  }
}
