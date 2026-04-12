import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

export const PASSWORD_SERVICE = Symbol('IPasswordService');

export interface IPasswordService {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

@Injectable()
export class BcryptPasswordProvider implements IPasswordService {
  async hash(plain: string): Promise<string> {
    return hash(plain, 10);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}
