import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthGuard } from '../common/guards/auth.guard';
import { USER_REPOSITORY } from '../identity/domain/repositories/user.repository.interface';
import { PostgresUserRepository } from '../identity/infra/persistence/postgres/user.repository';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { EmailService } from './email.service';
import { JwtKeyService } from './jwt-key.service';
import { resolveJwtSecurityConfig } from './jwt-key.util';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const jwtSecurityConfig = resolveJwtSecurityConfig();

        return jwtSecurityConfig.mode === 'asymmetric'
          ? {
              privateKey: jwtSecurityConfig.privateKey,
              publicKey: jwtSecurityConfig.publicKey,
              signOptions: {
                algorithm: 'RS256' as const,
                expiresIn: '1h',
                keyid: jwtSecurityConfig.keyId,
              },
            }
          : {
              secret: jwtSecurityConfig.secret,
              signOptions: {
                algorithm: 'HS256' as const,
                expiresIn: '1h',
                keyid: jwtSecurityConfig.keyId,
              },
            };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, JwtKeyService, AuthGuard, CaptchaService, EmailService,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
  ],
  exports: [AuthService, JwtKeyService, AuthGuard, CaptchaService, EmailService, USER_REPOSITORY],
})
export class AuthModule {}
