import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { WhatsappService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @ApiOperation({ summary: 'Recebe mensagens inbound do WhatsApp (Meta Cloud API webhook)' })
  @HttpCode(200)
  @Post('webhook')
  async receive(
    @Body() payload: Record<string, string | undefined>,
    @Headers('x-whatsapp-webhook-token') webhookToken?: string,
  ) {
    await this.whatsappService.handleWebhook(payload, webhookToken);
    return 'OK';
  }

  @ApiOperation({ summary: 'Recebe callbacks de status de mensagem do WhatsApp' })
  @HttpCode(200)
  @Post('status')
  async status(@Body() payload: Record<string, string | undefined>) {
    await this.whatsappService.handleStatusCallback(payload);
    return 'OK';
  }
}
