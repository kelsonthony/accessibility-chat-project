import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import type { UserEntity } from '../users/user.entity';
import { CollectTelemetryDto } from './dto/collect-telemetry.dto';
import { DataQueryDto } from './dto/data-query.dto';
import { TelemetryService } from './telemetry.service';

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @UseGuards(AuthGuard)
  @Post('collect')
  collect(@Body() input: CollectTelemetryDto, @CurrentUser() user: UserEntity) {
    return this.telemetryService.collect(user.id, input.events);
  }

  @UseGuards(AuthGuard)
  @Get('data')
  data(@Query() query: DataQueryDto) {
    return this.telemetryService.query(query);
  }
}

