import { DomainException } from '../../../@shared/domain/domain-exception.base';
import { ValueObject } from '../../../@shared/domain/value-object.base';

export class InvalidEmailException extends DomainException {
  readonly code = 'INVALID_EMAIL';
  constructor() {
    super('O email informado não é válido.');
  }
}

export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new InvalidEmailException();
    }
    return new Email(normalized);
  }

  static fromPersistence(value: string): Email {
    return new Email(value);
  }
}
