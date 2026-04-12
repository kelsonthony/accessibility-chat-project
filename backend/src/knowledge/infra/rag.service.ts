/**
 * Re-exports RagService from the use-case layer for backwards compatibility
 * with modules that inject it (chat gateway, messaging).
 */
export { AskQuestionUseCase as RagService } from '../application/use-cases/ask-question/ask-question.use-case';
