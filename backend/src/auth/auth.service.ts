import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';

import type { AuthResponse, LoginInput, SignupInput } from '@accessibility-platform/contracts';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResponse> {
    const passwordHash = await hash(input.password, 10);
    const user = await this.usersService.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });

    return this.issueToken(user.id);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.issueToken(user.id);
  }

  private async issueToken(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: this.usersService.toAuthUser(user),
    };
  }
}
