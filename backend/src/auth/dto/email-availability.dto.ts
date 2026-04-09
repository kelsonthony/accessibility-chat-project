import { IsEmail } from 'class-validator';

export class EmailAvailabilityDto {
  @IsEmail()
  email!: string;
}
