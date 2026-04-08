import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [RagController],
  providers: [RagService],
})
export class RagModule {}
