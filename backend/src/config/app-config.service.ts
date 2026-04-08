import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  get jwtSecret(): string {
    return process.env.JWT_SECRET || 'change-me';
  }

  get backendPort(): number {
    return Number(process.env.BACKEND_PORT || 3001);
  }

  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/handtalk_challenge'
    );
  }
}

