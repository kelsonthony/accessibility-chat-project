import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RagModule } from '../rag/rag.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, UsersModule, RagModule],
  providers: [ChatGateway],
})
export class ChatModule {}
