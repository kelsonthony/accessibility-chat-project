import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthGuard } from '../../common/guards/auth.guard';
import { DatabaseModule } from '../../database/database.module';
import { EmailModule } from '../../messaging/infra/email.module';
import { CAPTCHA_REPOSITORY } from '../domain/repositories/captcha.repository.interface';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.interface';
import {
  PASSWORD_RESET_REPOSITORY,
  VERIFICATION_REQUEST_REPOSITORY,
} from '../domain/repositories/verification-request.repository.interface';
import { IdentityController } from '../application/controllers/auth.controller';
import { AuthenticateUseCase } from '../application/use-cases/authenticate/authenticate.use-case';
import { CheckEmailAvailabilityUseCase } from '../application/use-cases/check-email-availability/check-email-availability.use-case';
import { GetCaptchaUseCase } from '../application/use-cases/get-captcha/get-captcha.use-case';
import { GoogleAuthUseCase } from '../application/use-cases/google-auth/google-auth.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password/reset-password.use-case';
import { StartSignupUseCase } from '../application/use-cases/start-signup/start-signup.use-case';
import { VerifySignupUseCase } from '../application/use-cases/verify-signup/verify-signup.use-case';
import { PostgresCaptchaRepository } from './persistence/postgres/captcha.repository';
import { PostgresUserRepository } from './persistence/postgres/user.repository';
import {
  PostgresPasswordResetRepository,
  PostgresVerificationRequestRepository,
} from './persistence/postgres/verification-request.repository';
import { BcryptPasswordProvider, PASSWORD_SERVICE } from './providers/password.provider';
import { JwtKeyService } from '../../auth/jwt-key.service';
import { resolveJwtSecurityConfig } from '../../auth/jwt-key.util';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const cfg = resolveJwtSecurityConfig();
        return cfg.mode === 'asymmetric'
          ? { privateKey: cfg.privateKey, publicKey: cfg.publicKey, signOptions: { algorithm: 'RS256' as const, expiresIn: '1h', keyid: cfg.keyId } }
          : { secret: cfg.secret, signOptions: { algorithm: 'HS256' as const, expiresIn: '1h', keyid: cfg.keyId } };
      },
    }),
  ],
  controllers: [IdentityController],
  providers: [
    // Infrastructure bindings
    JwtKeyService,
    AuthGuard,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
    { provide: VERIFICATION_REQUEST_REPOSITORY, useClass: PostgresVerificationRequestRepository },
    { provide: PASSWORD_RESET_REPOSITORY, useClass: PostgresPasswordResetRepository },
    { provide: CAPTCHA_REPOSITORY, useClass: PostgresCaptchaRepository },
    { provide: PASSWORD_SERVICE, useClass: BcryptPasswordProvider },
    // Use Cases
    AuthenticateUseCase,
    CheckEmailAvailabilityUseCase,
    GetCaptchaUseCase,
    GoogleAuthUseCase,
    StartSignupUseCase,
    VerifySignupUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
  exports: [
    USER_REPOSITORY,
    JwtKeyService,
    AuthGuard,
    JwtModule,
  ],
})
export class IdentityModule {}
