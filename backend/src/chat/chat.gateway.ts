import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { IncomingMessage } from 'node:http';
import { Server, WebSocket } from 'ws';

import type { AskQuestionInput } from '@accessibility-platform/contracts';
import { JwtKeyService } from '../auth/jwt-key.service';
import { UsersService } from '../users/users.service';
import { RagService } from '../rag/rag.service';
import type { UserEntity } from '../users/user.entity';

type AuthenticatedSocket = WebSocket & { user?: UserEntity };

@WebSocketGateway({ path: '/chat' })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
    private readonly usersService: UsersService,
    private readonly ragService: RagService,
  ) {}

  async handleConnection(client: AuthenticatedSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const token = url.searchParams.get('token');

    if (!token) {
      client.close(4001, 'Missing token');
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        this.jwtKeyService.verifyOptions,
      );
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.close(4001, 'User not found');
        return;
      }

      client.user = user;
      this.logger.log({ event: 'ws_connected', userId: user.id });
    } catch {
      client.close(4001, 'Invalid or expired token');
    }
  }

  @SubscribeMessage('chat:ask')
  async handleAsk(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: AskQuestionInput,
  ) {
    if (!client.user) {
      return { event: 'chat:error', data: { message: 'Unauthorized' } };
    }

    this.logger.log({
      event: 'ws_ask',
      userId: client.user.id,
      language: data.language,
    });

    try {
      const response = await this.ragService.answer(client.user.id, data);
      return { event: 'chat:answer', data: response };
    } catch (error) {
      this.logger.error({
        event: 'ws_ask_error',
        userId: client.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { event: 'chat:error', data: { message: 'Failed to process question' } };
    }
  }
}
