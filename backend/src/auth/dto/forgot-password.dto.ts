import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  captchaId!: string;

  @IsString()
  @MinLength(1)
  captchaAnswer!: string;
}
