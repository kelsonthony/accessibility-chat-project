import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import type { UserEntity } from '../../../users/user.entity';
import { CollectEventsUseCase } from '../use-cases/collect-events/collect-events.use-case';
import { QueryEventsUseCase } from '../use-cases/query-events/query-events.use-case';
import { CollectTelemetryDto } from '../../../telemetry/dto/collect-telemetry.dto';
import { DataQueryDto } from '../../../telemetry/dto/data-query.dto';

@ApiTags('telemetry')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller()
export class TelemetryController {
  constructor(
    private readonly collectEvents: CollectEventsUseCase,
    private readonly queryEvents: QueryEventsUseCase,
  ) {}

  @ApiOperation({ summary: 'Ingere um batch de eventos de telemetria comportamental' })
  @Post('collect')
  collect(@Body() dto: CollectTelemetryDto, @CurrentUser() user: UserEntity) {
    return this.collectEvents.execute(user.id, dto.events);
  }

  @ApiOperation({ summary: 'Lista eventos de telemetria com filtros e paginação' })
  @Get('data')
  query(@Query() filters: DataQueryDto, @CurrentUser() user: UserEntity) {
    return this.queryEvents.execute({ ...filters, userId: user.id });
  }
}
