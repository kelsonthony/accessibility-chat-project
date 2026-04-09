import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class SignupStartDto {
  @IsEmail()
  email!: string;

  @IsEmail()
  confirmEmail!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsUUID()
  captchaId!: string;

  @IsString()
  @MinLength(1)
  captchaAnswer!: string;
}
