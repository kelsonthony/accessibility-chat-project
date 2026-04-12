import { Injectable, NestMiddleware } from '@nestjs/common';
import { register, Histogram } from 'prom-client';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  use(req: Record<string, unknown>, res: Record<string, unknown>, next: () => void): void {
    const start = Date.now();
    const httpReq = req as { method: string; path: string; route?: { path: string } };
    const httpRes = res as { statusCode: number; on: (event: string, cb: () => void) => void };

    httpRes.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = httpReq.route?.path ?? httpReq.path ?? 'unknown';

      try {
        const histogram = register.getSingleMetric(
          'accesschat_http_request_duration_seconds',
        ) as Histogram<string> | undefined;

        histogram?.observe(
          {
            method: httpReq.method,
            route,
            status_code: String(httpRes.statusCode),
          },
          duration,
        );
      } catch {
        // metric not yet registered — ignore
      }
    });

    next();
  }
}
