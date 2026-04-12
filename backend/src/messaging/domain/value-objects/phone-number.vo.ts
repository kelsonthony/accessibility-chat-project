import { ValueObject } from '../../../@shared/domain/value-object.base';
import { PhoneNumberInvalidException } from '../exceptions';

export class PhoneNumber extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): PhoneNumber {
    const normalized = raw.trim();
    if (!normalized) throw new PhoneNumberInvalidException();
    return new PhoneNumber(normalized);
  }

  static fromPersistence(value: string): PhoneNumber {
    return new PhoneNumber(value);
  }
}
