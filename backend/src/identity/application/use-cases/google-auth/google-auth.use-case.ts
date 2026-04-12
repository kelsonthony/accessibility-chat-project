import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import type { AuthResponse } from '@accessibility-platform/contracts';

import { AppConfigService } from '../../../../config/app-config.service';
import { JwtKeyService } from '../../../../auth/jwt-key.service';
import {
  GoogleOAuthFailedException,
  GoogleOAuthNotConfiguredException,
} from '../../../domain/exceptions';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/aggregates/user.aggregate';
import { Email } from '../../../domain/value-objects/email.vo';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { PASSWORD_SERVICE, type IPasswordService } from '../../../infra/providers/password.provider';
import { UserMapper } from '../../mappers/user.mapper';

@Injectable()
export class GoogleAuthUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: IPasswordService,
    private readonly config: AppConfigService,
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
  ) {}

  async execute(code: string, redirectUri: string): Promise<AuthResponse> {
    if (!this.config.googleClientId || !this.config.googleClientSecret) {
      throw new GoogleOAuthNotConfiguredException();
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = (await tokenRes.json().catch(() => null)) as { error_description?: string } | null;
      throw new GoogleOAuthFailedException(err?.error_description);
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) throw new GoogleOAuthFailedException('Não foi possível obter dados do usuário do Google.');

    const userInfo = (await userRes.json()) as {
      email: string;
      verified_email: boolean;
      name?: string;
    };

    if (!userInfo.verified_email) throw new GoogleOAuthFailedException('O e-mail do Google não está verificado.');

    const email = Email.create(userInfo.email);
    let user = await this.userRepo.findByEmail(email);

    if (!user) {
      const displayName = userInfo.name ?? email.value.split('@')[0];
      const passwordHash = await this.passwordService.hash(randomUUID());

      user = User.create({
        id: UserId.create(randomUUID()),
        email,
        displayName,
        passwordHash: HashedPassword.fromHash(passwordHash),
        emailVerifiedAt: new Date(),
      });

      await this.userRepo.save(user);
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id.value, email: user.email.value },
      this.jwtKeyService.signOptions,
    );

    return { accessToken, user: UserMapper.toAuthUser(user) };
  }
}
