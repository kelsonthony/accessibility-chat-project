import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';

import type { AuthResponse, VerifySignupInput } from '@accessibility-platform/contracts';

import { JwtKeyService } from '../../../../auth/jwt-key.service';
import {
  DuplicateEmailException,
  InvalidVerificationCodeException,
  MaxAttemptsExceededException,
  VerificationCodeExpiredException,
} from '../../../domain/exceptions';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import {
  VERIFICATION_REQUEST_REPOSITORY,
  type IVerificationRequestRepository,
} from '../../../domain/repositories/verification-request.repository.interface';
import { User } from '../../../domain/aggregates/user.aggregate';
import { Email } from '../../../domain/value-objects/email.vo';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserMapper } from '../../mappers/user.mapper';
import { randomUUID } from 'node:crypto';

@Injectable()
export class VerifySignupUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(VERIFICATION_REQUEST_REPOSITORY) private readonly verificationRepo: IVerificationRequestRepository,
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
  ) {}

  async execute(input: VerifySignupInput): Promise<AuthResponse> {
    const email = Email.create(input.email);
    const request = await this.verificationRepo.findById(input.verificationRequestId, email.value);

    if (!request || request.consumedAt) throw new InvalidVerificationCodeException();
    if (request.expiresAt < new Date()) throw new VerificationCodeExpiredException();
    if (request.attempts >= 5) throw new MaxAttemptsExceededException();

    const incoming = Buffer.from(createHash('sha256').update(input.code.trim()).digest('hex'));
    const expected = Buffer.from(request.codeHash);
    const valid = incoming.length === expected.length && timingSafeEqual(incoming, expected);

    if (!valid) {
      await this.verificationRepo.incrementAttempts(request.id);
      throw new InvalidVerificationCodeException();
    }

    if (await this.userRepo.existsByEmail(email)) throw new DuplicateEmailException();

    const user = User.create({
      id: UserId.create(randomUUID()),
      email,
      displayName: request.displayName,
      passwordHash: HashedPassword.fromHash(request.passwordHash),
      emailVerifiedAt: new Date(),
    });

    await this.userRepo.save(user);
    await this.verificationRepo.consume(request.id);

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id.value, email: user.email.value },
      this.jwtKeyService.signOptions,
    );

    return { accessToken, user: UserMapper.toAuthUser(user) };
  }
}
