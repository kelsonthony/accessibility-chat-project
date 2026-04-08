import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { AuthUser } from '@accessibility-platform/contracts';

import { DatabaseService } from '../database/database.service';
import type { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async create(params: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    const normalizedEmail = params.email.trim().toLowerCase();

    if (await this.findByEmail(normalizedEmail)) {
      throw new ConflictException('Email already registered.');
    }

    const user: UserEntity = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName: params.displayName.trim(),
      passwordHash: params.passwordHash,
      createdAt: new Date().toISOString(),
    };

    await this.database.pool.query(
      `insert into accesschat.users (id, email, display_name, password_hash, created_at)
       values ($1, $2, $3, $4, $5)`,
      [user.id, user.email, user.displayName, user.passwordHash, user.createdAt],
    );

    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await this.database.pool.query<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      created_at: string;
    }>(
      `select id, email, display_name, password_hash, created_at
       from accesschat.users
       where email = $1
       limit 1`,
      [normalizedEmail],
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          passwordHash: row.password_hash,
          createdAt: row.created_at,
        }
      : undefined;
  }

  async findById(id: string): Promise<UserEntity | undefined> {
    const result = await this.database.pool.query<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      created_at: string;
    }>(
      `select id, email, display_name, password_hash, created_at
       from accesschat.users
       where id = $1
       limit 1`,
      [id],
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          passwordHash: row.password_hash,
          createdAt: row.created_at,
        }
      : undefined;
  }

  toAuthUser(user: UserEntity): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
