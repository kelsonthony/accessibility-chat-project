import { AggregateRoot } from '../../../@shared/domain/aggregate-root.base';
import { UserCreatedEvent } from '../events/user-created.event';
import type { Email } from '../value-objects/email.vo';
import type { HashedPassword } from '../value-objects/hashed-password.vo';
import type { UserId } from '../value-objects/user-id.vo';

export interface UserProps {
  id: UserId;
  email: Email;
  displayName: string;
  passwordHash: HashedPassword;
  createdAt: Date;
  emailVerifiedAt?: Date;
}

export class User extends AggregateRoot<UserId> {
  private _email: Email;
  private _displayName: string;
  private _passwordHash: HashedPassword;
  readonly createdAt: Date;
  readonly emailVerifiedAt?: Date;

  private constructor(props: UserProps) {
    super(props.id);
    this._email = props.email;
    this._displayName = props.displayName;
    this._passwordHash = props.passwordHash;
    this.createdAt = props.createdAt;
    this.emailVerifiedAt = props.emailVerifiedAt;
  }

  static create(props: Omit<UserProps, 'createdAt'>): User {
    const user = new User({ ...props, createdAt: new Date() });
    user.addEvent(new UserCreatedEvent(props.id.value, props.email.value));
    return user;
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  get email(): Email {
    return this._email;
  }

  get displayName(): string {
    return this._displayName;
  }

  get passwordHash(): HashedPassword {
    return this._passwordHash;
  }

  updatePassword(newHash: HashedPassword): void {
    this._passwordHash = newHash;
  }
}
