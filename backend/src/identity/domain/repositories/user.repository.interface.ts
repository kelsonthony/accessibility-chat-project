import type { User } from '../aggregates/user.aggregate';
import type { Email } from '../value-objects/email.vo';
import type { UserId } from '../value-objects/user-id.vo';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: User): Promise<void>;
  updatePassword(email: Email, newPasswordHash: string): Promise<void>;
}
