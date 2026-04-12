import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { EmailAvailabilityDto } from './dto/email-availability.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupStartDto } from './dto/signup-start.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Gera um desafio CAPTCHA matemático' })
  @Get('auth/captcha')
  getCaptcha() {
    return this.authService.getCaptcha();
  }

  @ApiOperation({ summary: 'Verifica disponibilidade de e-mail' })
  @Get('auth/email-availability')
  checkEmailAvailability(@Query() query: EmailAvailabilityDto) {
    return this.authService.checkEmailAvailability(query.email);
  }

  @ApiOperation({ summary: 'Cadastro simplificado (e-mail + senha, sem código)' })
  @Post('signup')
  signup(@Body() input: SignupDto) {
    return this.authService.signup(input);
  }

  @ApiOperation({ summary: 'Inicia signup em dois passos — envia código por e-mail' })
  @Post('signup/start')
  startSignup(@Body() input: SignupStartDto) {
    return this.authService.startSignup(input);
  }

  @ApiOperation({ summary: 'Confirma código e cria a conta — retorna JWT' })
  @Post('signup/verify')
  verifySignup(@Body() input: VerifySignupDto) {
    return this.authService.verifySignup(input);
  }

  @ApiOperation({ summary: 'Login via Google OAuth 2.0 (troca código por JWT)' })
  @Post('auth/google')
  googleAuth(@Body() input: GoogleAuthDto) {
    return this.authService.googleAuth(input.code, input.redirectUri);
  }

  @ApiOperation({ summary: 'Login com e-mail e senha — retorna JWT' })
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @ApiOperation({ summary: 'Solicita reset de senha por e-mail' })
  @Post('password/forgot')
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(input);
  }

  @ApiOperation({ summary: 'Redefine senha usando o código recebido por e-mail' })
  @Post('password/reset')
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(input);
  }
}
