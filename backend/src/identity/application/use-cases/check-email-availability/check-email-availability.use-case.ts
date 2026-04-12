import { Inject, Injectable } from '@nestjs/common';

import type { EmailAvailabilityResponse } from '@accessibility-platform/contracts';

import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';

@Injectable()
export class CheckEmailAvailabilityUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(rawEmail: string): Promise<EmailAvailabilityResponse> {
    const email = Email.create(rawEmail);
    const exists = await this.userRepo.existsByEmail(email);
    return { email: email.value, exists, available: !exists };
  }
}
