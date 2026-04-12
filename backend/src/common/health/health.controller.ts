import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Retorna status do serviço' })
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'handtalk-challenge-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

