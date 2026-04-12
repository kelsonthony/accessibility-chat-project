import { Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

import type { ResetPasswordInput, ResetPasswordResponse } from '@accessibility-platform/contracts';

import {
  InvalidVerificationCodeException,
  MaxAttemptsExceededException,
  PasswordsDoNotMatchException,
  VerificationCodeExpiredException,
} from '../../../domain/exceptions';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from '../../../domain/repositories/verification-request.repository.interface';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';
import { PASSWORD_SERVICE, type IPasswordService } from '../../../infra/providers/password.provider';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: IPasswordResetRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: IPasswordService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    if (input.password !== input.confirmPassword) throw new PasswordsDoNotMatchException();

    const email = Email.create(input.email);
    const request = await this.resetRepo.findLatestActive(email.value);

    if (!request) throw new InvalidVerificationCodeException();
    if (request.expiresAt < new Date()) throw new VerificationCodeExpiredException();
    if (request.attempts >= 5) throw new MaxAttemptsExceededException();

    const incoming = Buffer.from(createHash('sha256').update(input.code.trim()).digest('hex'));
    const expected = Buffer.from(request.codeHash);
    const valid = incoming.length === expected.length && timingSafeEqual(incoming, expected);

    if (!valid) {
      await this.resetRepo.incrementAttempts(request.id);
      throw new InvalidVerificationCodeException();
    }

    const newHash = await this.passwordService.hash(input.password);
    await this.userRepo.updatePassword(email, newHash);
    await this.resetRepo.consumePending(email.value);

    return { status: 'password_updated' };
  }
}
