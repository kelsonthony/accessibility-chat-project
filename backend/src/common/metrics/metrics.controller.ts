import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { register } from 'prom-client';

@ApiTags('health')
@Controller('metrics')
export class MetricsController {
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
