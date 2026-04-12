import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import type { UserEntity } from '../users/user.entity';
import { CollectTelemetryDto } from './dto/collect-telemetry.dto';
import { DataQueryDto } from './dto/data-query.dto';
import { TelemetryService } from './telemetry.service';

@ApiTags('telemetry')
@ApiBearerAuth('access-token')
@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @ApiOperation({ summary: 'Ingere lote de eventos de telemetria (até 50 por requisição)' })
  @UseGuards(AuthGuard)
  @Post('collect')
  collect(@Body() input: CollectTelemetryDto, @CurrentUser() user: UserEntity) {
    return this.telemetryService.collect(user.id, input.events);
  }

  @ApiOperation({ summary: 'Lista eventos coletados com filtros e paginação' })
  @UseGuards(AuthGuard)
  @Get('data')
  data(@Query() query: DataQueryDto) {
    return this.telemetryService.query(query);
  }
}

