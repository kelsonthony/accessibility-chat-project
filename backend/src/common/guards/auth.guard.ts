import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Inject } from '@nestjs/common';

import { JwtKeyService } from '../../auth/jwt-key.service';
import { USER_REPOSITORY, type IUserRepository } from '../../identity/domain/repositories/user.repository.interface';
import { UserId } from '../../identity/domain/value-objects/user-id.vo';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly jwtKeyService: JwtKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(
        token,
        this.jwtKeyService.verifyOptions,
      );
      const user = await this.userRepo.findById(UserId.create(payload.sub));

      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      // Expose a plain object compatible with legacy UserEntity for existing decorators
      request.user = {
        id: user.id.value,
        email: user.email.value,
        displayName: user.displayName,
        passwordHash: user.passwordHash.value,
        createdAt: user.createdAt.toISOString(),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
