import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { IdentityModule } from '../../identity/infra/identity.module';
import { LlmService } from '../../rag/llm.service';
import { DOCUMENT_CHUNK_REPOSITORY } from '../domain/repositories/document.repository.interface';
import { AskQuestionUseCase } from '../application/use-cases/ask-question/ask-question.use-case';
import { PostgresDocumentChunkRepository } from './persistence/postgres/document-chunk.repository';

// Re-export RagService alias for chat gateway and messaging
export { AskQuestionUseCase as RagService } from '../application/use-cases/ask-question/ask-question.use-case';

@Module({
  imports: [DatabaseModule, IdentityModule],
  providers: [
    LlmService,
    { provide: DOCUMENT_CHUNK_REPOSITORY, useClass: PostgresDocumentChunkRepository },
    AskQuestionUseCase,
  ],
  exports: [AskQuestionUseCase, LlmService],
})
export class KnowledgeModule {}
