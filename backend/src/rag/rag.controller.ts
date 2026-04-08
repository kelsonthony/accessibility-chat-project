import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import type { UserEntity } from '../users/user.entity';
import { AskQuestionDto } from './dto/ask-question.dto';
import { RagService } from './rag.service';

@Controller()
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @UseGuards(AuthGuard)
  @Post('ask')
  ask(@Body() input: AskQuestionDto, @CurrentUser() user: UserEntity) {
    return this.ragService.answer(user.id, input);
  }
}

