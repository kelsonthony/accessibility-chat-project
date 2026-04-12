import { Module, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Histogram, register } from 'prom-client';

import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
})
export class MetricsModule implements OnModuleInit {
  onModuleInit() {
    register.clear();
    collectDefaultMetrics({ prefix: 'accesschat_' });

    // HTTP request duration histogram
    new Histogram({
      name: 'accesschat_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });
  }
}
