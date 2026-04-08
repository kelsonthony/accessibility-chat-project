import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { JwtModuleOptions, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { resolveJwtSecurityConfig } from './jwt-key.util';

type JwtMode = 'symmetric' | 'asymmetric';

@Injectable()
export class JwtKeyService {
  private readonly resolved = resolveJwtSecurityConfig();

  get moduleOptions(): JwtModuleOptions {
    if (this.resolved.mode === 'asymmetric') {
      return {
        global: true,
        privateKey: this.resolved.privateKey,
        publicKey: this.resolved.publicKey,
        signOptions: {
          algorithm: 'RS256',
          expiresIn: '1h',
          keyid: this.resolved.keyId,
        },
      };
    }

    return {
      global: true,
      secret: this.resolved.secret,
      signOptions: {
        algorithm: 'HS256',
        expiresIn: '1h',
        keyid: this.resolved.keyId,
      },
    };
  }

  get signOptions(): JwtSignOptions {
    return this.moduleOptions.signOptions || {};
  }

  get verifyOptions(): JwtVerifyOptions {
    if (this.resolved.mode === 'asymmetric') {
      return {
        algorithms: ['RS256'],
        publicKey: this.resolved.publicKey,
      };
    }

    return {
      algorithms: ['HS256'],
      secret: this.resolved.secret,
    };
  }

  get keyId(): string {
    return this.resolved.keyId;
  }

  verifyKeyMaterialPresent() {
    if (this.resolved.mode === 'asymmetric' && (!this.resolved.privateKey || !this.resolved.publicKey)) {
      throw new UnauthorizedException('JWT key material is not configured.');
    }
  }
}
