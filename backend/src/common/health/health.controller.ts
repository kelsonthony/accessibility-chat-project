import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'handtalk-challenge-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

