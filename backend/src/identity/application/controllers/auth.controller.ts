import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { EmailAvailabilityDto } from '../../../auth/dto/email-availability.dto';
import { ForgotPasswordDto } from '../../../auth/dto/forgot-password.dto';
import { GoogleAuthDto } from '../../../auth/dto/google-auth.dto';
import { LoginDto } from '../../../auth/dto/login.dto';
import { ResetPasswordDto } from '../../../auth/dto/reset-password.dto';
import { SignupStartDto } from '../../../auth/dto/signup-start.dto';
import { VerifySignupDto } from '../../../auth/dto/verify-signup.dto';
import { AuthenticateUseCase } from '../use-cases/authenticate/authenticate.use-case';
import { CheckEmailAvailabilityUseCase } from '../use-cases/check-email-availability/check-email-availability.use-case';
import { GetCaptchaUseCase } from '../use-cases/get-captcha/get-captcha.use-case';
import { GoogleAuthUseCase } from '../use-cases/google-auth/google-auth.use-case';
import { RequestPasswordResetUseCase } from '../use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../use-cases/reset-password/reset-password.use-case';
import { StartSignupUseCase } from '../use-cases/start-signup/start-signup.use-case';
import { VerifySignupUseCase } from '../use-cases/verify-signup/verify-signup.use-case';

@ApiTags('auth')
@Controller()
export class IdentityController {
  constructor(
    private readonly getCaptchaUseCase: GetCaptchaUseCase,
    private readonly checkEmailAvailabilityUseCase: CheckEmailAvailabilityUseCase,
    private readonly startSignupUseCase: StartSignupUseCase,
    private readonly verifySignupUseCase: VerifySignupUseCase,
    private readonly authenticateUseCase: AuthenticateUseCase,
    private readonly googleAuthUseCase: GoogleAuthUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @ApiOperation({ summary: 'Gera um desafio CAPTCHA matemático' })
  @Get('auth/captcha')
  getCaptcha() {
    return this.getCaptchaUseCase.execute();
  }

  @ApiOperation({ summary: 'Verifica disponibilidade de e-mail' })
  @Get('auth/email-availability')
  checkEmailAvailability(@Query() query: EmailAvailabilityDto) {
    return this.checkEmailAvailabilityUseCase.execute(query.email);
  }

  @ApiOperation({ summary: 'Inicia signup em dois passos — envia código por e-mail' })
  @Post('signup/start')
  startSignup(@Body() input: SignupStartDto) {
    return this.startSignupUseCase.execute(input);
  }

  @ApiOperation({ summary: 'Confirma código e cria a conta — retorna JWT' })
  @Post('signup/verify')
  verifySignup(@Body() input: VerifySignupDto) {
    return this.verifySignupUseCase.execute(input);
  }

  @ApiOperation({ summary: 'Login via Google OAuth 2.0 (troca código por JWT)' })
  @Post('auth/google')
  googleAuth(@Body() input: GoogleAuthDto) {
    return this.googleAuthUseCase.execute(input.code, input.redirectUri);
  }

  @ApiOperation({ summary: 'Login com e-mail e senha — retorna JWT' })
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authenticateUseCase.execute(input);
  }

  @ApiOperation({ summary: 'Solicita reset de senha por e-mail' })
  @Post('password/forgot')
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.requestPasswordResetUseCase.execute(input);
  }

  @ApiOperation({ summary: 'Redefine senha usando o código recebido por e-mail' })
  @Post('password/reset')
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.resetPasswordUseCase.execute(input);
  }
}
