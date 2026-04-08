import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [UsersModule],
  controllers: [RagController],
  providers: [RagService, AuthGuard],
})
export class RagModule {}

