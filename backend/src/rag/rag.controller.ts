import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import type { UserEntity } from '../users/user.entity';
import { AskQuestionDto } from './dto/ask-question.dto';
import { RagService } from './rag.service';

@ApiTags('rag')
@ApiBearerAuth('access-token')
@Controller()
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @ApiOperation({ summary: 'Faz uma pergunta ao assistente de acessibilidade via pipeline RAG' })
  @UseGuards(AuthGuard)
  @Post('ask')
  ask(@Body() input: AskQuestionDto, @CurrentUser() user: UserEntity) {
    return this.ragService.answer(user.id, input);
  }
}

