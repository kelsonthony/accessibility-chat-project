import { ValueObject } from '../../../@shared/domain/value-object.base';

export class HashedPassword extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static fromHash(hash: string): HashedPassword {
    return new HashedPassword(hash);
  }
}
