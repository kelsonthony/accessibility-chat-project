import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { LlmService } from './llm.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [AuthModule, UsersModule, DatabaseModule],
  controllers: [RagController],
  providers: [RagService, LlmService],
})
export class RagModule {}
