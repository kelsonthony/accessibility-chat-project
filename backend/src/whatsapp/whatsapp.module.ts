import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RagModule } from '../rag/rag.module';
import { UsersModule } from '../users/users.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [UsersModule, RagModule, AuthModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
