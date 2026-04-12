import { ValueObject } from '../../../@shared/domain/value-object.base';

export class UserId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): UserId {
    return new UserId(value);
  }
}
