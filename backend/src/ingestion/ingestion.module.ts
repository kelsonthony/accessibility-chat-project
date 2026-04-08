import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [UsersModule],
  controllers: [IngestionController],
  providers: [IngestionService, AuthGuard],
  exports: [IngestionService],
})
export class IngestionModule {}
