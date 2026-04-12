import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthResponse, LoginInput } from '@accessibility-platform/contracts';

import { JwtKeyService } from '../../../../auth/jwt-key.service';
import { InvalidCredentialsException } from '../../../domain/exceptions';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';
import { PASSWORD_SERVICE, type IPasswordService } from '../../../infra/providers/password.provider';
import { UserMapper } from '../../mappers/user.mapper';

@Injectable()
export class AuthenticateUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: IPasswordService,
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
  ) {}

  async execute(input: LoginInput): Promise<AuthResponse> {
    const email = Email.create(input.email);
    const user = await this.userRepo.findByEmail(email);

    if (!user) throw new InvalidCredentialsException();

    const passwordMatches = await this.passwordService.compare(input.password, user.passwordHash.value);
    if (!passwordMatches) throw new InvalidCredentialsException();

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id.value, email: user.email.value },
      this.jwtKeyService.signOptions,
    );

    return { accessToken, user: UserMapper.toAuthUser(user) };
  }
}
