import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HandleInboundMessageUseCase } from '../use-cases/handle-inbound-message/handle-inbound-message.use-case';
import { HandleStatusCallbackUseCase } from '../use-cases/handle-status-callback/handle-status-callback.use-case';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly handleInbound: HandleInboundMessageUseCase,
    private readonly handleStatusCallback: HandleStatusCallbackUseCase,
  ) {}

  @ApiOperation({ summary: 'Recebe mensagens inbound do WhatsApp (Twilio webhook)' })
  @HttpCode(200)
  @Post('webhook')
  async receive(
    @Body() payload: Record<string, string | undefined>,
    @Headers('x-whatsapp-webhook-token') webhookToken?: string,
  ) {
    await this.handleInbound.execute(payload, webhookToken);
    return 'OK';
  }

  @ApiOperation({ summary: 'Recebe callbacks de status de mensagem do WhatsApp' })
  @HttpCode(200)
  @Post('status')
  async status(@Body() payload: Record<string, string | undefined>) {
    await this.handleStatusCallback.execute(payload);
    return 'OK';
  }
}
