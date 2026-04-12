import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env'), override: false });

async function bootstrap() {
  const { urlencoded } = require('express') as { urlencoded: (options: { extended: boolean }) => unknown };
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  app.useWebSocketAdapter(new WsAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(urlencoded({ extended: false }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AccessChat API')
    .setDescription(
      'Backend centralizado para autenticação, telemetria comportamental, RAG de acessibilidade e integração WhatsApp.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Autenticação, signup e recuperação de senha')
    .addTag('telemetry', 'Ingestão e consulta de eventos de telemetria')
    .addTag('rag', 'Perguntas ao assistente de acessibilidade via RAG')
    .addTag('documents', 'Fontes e chunks de conhecimento')
    .addTag('whatsapp', 'Webhook e mensagens WhatsApp')
    .addTag('health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3001);
}

void bootstrap();
