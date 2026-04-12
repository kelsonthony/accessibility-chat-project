import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { IdentityModule } from '../../identity/infra/identity.module';
import { KnowledgeModule } from '../../knowledge/infra/knowledge.module';
import { WHATSAPP_CONTACT_REPOSITORY } from '../domain/repositories/whatsapp-contact.repository.interface';
import { WhatsappController } from '../application/controllers/whatsapp.controller';
import { HandleInboundMessageUseCase } from '../application/use-cases/handle-inbound-message/handle-inbound-message.use-case';
import { HandleStatusCallbackUseCase } from '../application/use-cases/handle-status-callback/handle-status-callback.use-case';
import { PostgresWhatsappContactRepository } from './persistence/postgres/whatsapp-contact.repository';
import { EmailModule } from './email.module';
import { TwilioSenderProvider } from './providers/twilio-sender.provider';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    IdentityModule,    // provides USER_REPOSITORY and JwtModule
    KnowledgeModule,   // provides AskQuestionUseCase (as RagService)
  ],
  controllers: [WhatsappController],
  providers: [
    TwilioSenderProvider,
    { provide: WHATSAPP_CONTACT_REPOSITORY, useClass: PostgresWhatsappContactRepository },
    HandleInboundMessageUseCase,
    HandleStatusCallbackUseCase,
  ],
  exports: [EmailModule, WHATSAPP_CONTACT_REPOSITORY],
})
export class MessagingModule {}
