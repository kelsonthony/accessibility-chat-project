import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../../database/database.service';
import { User } from '../.././../domain/aggregates/user.aggregate';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';
import { HashedPassword } from '../../../domain/value-objects/hashed-password.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
  email_verified_at: string | null;
};

@Injectable()
export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: UserId): Promise<User | null> {
    const result = await this.database.pool.query<UserRow>(
      `select id, email, display_name, password_hash, created_at, email_verified_at
       from accesschat.users
       where id = $1
       limit 1`,
      [id.value],
    );
    return result.rows[0] ? this.toAggregate(result.rows[0]) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const result = await this.database.pool.query<UserRow>(
      `select id, email, display_name, password_hash, created_at, email_verified_at
       from accesschat.users
       where email = $1
       limit 1`,
      [email.value],
    );
    return result.rows[0] ? this.toAggregate(result.rows[0]) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const result = await this.database.pool.query<{ exists: boolean }>(
      `select exists(select 1 from accesschat.users where email = $1) as exists`,
      [email.value],
    );
    return result.rows[0]?.exists ?? false;
  }

  async save(user: User): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.users (id, email, display_name, password_hash, created_at, email_verified_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set
         email = excluded.email,
         display_name = excluded.display_name,
         password_hash = excluded.password_hash`,
      [
        user.id.value,
        user.email.value,
        user.displayName,
        user.passwordHash.value,
        user.createdAt.toISOString(),
        user.emailVerifiedAt?.toISOString() ?? user.createdAt.toISOString(),
      ],
    );
  }

  async updatePassword(email: Email, newPasswordHash: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.users set password_hash = $2 where email = $1`,
      [email.value, newPasswordHash],
    );
  }

  private toAggregate(row: UserRow): User {
    return User.fromPersistence({
      id: UserId.create(row.id),
      email: Email.fromPersistence(row.email),
      displayName: row.display_name,
      passwordHash: HashedPassword.fromHash(row.password_hash),
      createdAt: new Date(row.created_at),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : undefined,
    });
  }
}
