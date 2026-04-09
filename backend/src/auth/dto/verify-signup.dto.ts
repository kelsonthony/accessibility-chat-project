import { IsEmail, IsString, IsUUID, Length } from 'class-validator';

export class VerifySignupDto {
  @IsUUID()
  verificationRequestId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
