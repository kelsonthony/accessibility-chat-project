import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [UsersModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, AuthGuard],
  exports: [TelemetryService],
})
export class TelemetryModule {}

