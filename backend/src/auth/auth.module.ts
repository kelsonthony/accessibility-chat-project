import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthGuard } from '../common/guards/auth.guard';
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
  providers: [AuthService, JwtKeyService, AuthGuard, CaptchaService, EmailService],
  exports: [AuthService, JwtKeyService, AuthGuard, CaptchaService, EmailService],
})
export class AuthModule {}
