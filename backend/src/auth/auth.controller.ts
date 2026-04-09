import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { EmailAvailabilityDto } from './dto/email-availability.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupStartDto } from './dto/signup-start.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('auth/captcha')
  getCaptcha() {
    return this.authService.getCaptcha();
  }

  @Get('auth/email-availability')
  checkEmailAvailability(@Query() query: EmailAvailabilityDto) {
    return this.authService.checkEmailAvailability(query.email);
  }

  @Post('signup')
  signup(@Body() input: SignupDto) {
    return this.authService.signup(input);
  }

  @Post('signup/start')
  startSignup(@Body() input: SignupStartDto) {
    return this.authService.startSignup(input);
  }

  @Post('signup/verify')
  verifySignup(@Body() input: VerifySignupDto) {
    return this.authService.verifySignup(input);
  }

  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Post('password/forgot')
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(input);
  }

  @Post('password/reset')
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(input);
  }
}
