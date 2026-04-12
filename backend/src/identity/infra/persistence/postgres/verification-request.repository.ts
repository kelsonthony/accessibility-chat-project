import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../../database/database.service';
import type {
  IPasswordResetRepository,
  IVerificationRequestRepository,
  PasswordResetRequest,
  VerificationRequest,
} from '../../../domain/repositories/verification-request.repository.interface';

@Injectable()
export class PostgresVerificationRequestRepository implements IVerificationRequestRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(params: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.email_verification_requests
         (id, email, display_name, password_hash, code_hash, expires_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [params.id, params.email, params.displayName, params.passwordHash, params.codeHash, params.expiresAt.toISOString()],
    );
  }

  async findById(id: string, email: string): Promise<VerificationRequest | null> {
    const result = await this.database.pool.query<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      attempts: number;
    }>(
      `select id, email, display_name, password_hash, code_hash, expires_at, consumed_at, attempts
       from accesschat.email_verification_requests
       where id = $1 and email = $2
       limit 1`,
      [id, email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      codeHash: row.code_hash,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
      attempts: row.attempts,
    };
  }

  async consumePending(email: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.email_verification_requests
       set consumed_at = now()
       where email = $1 and consumed_at is null`,
      [email],
    );
  }

  async consume(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.email_verification_requests set consumed_at = now() where id = $1`,
      [id],
    );
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.email_verification_requests set attempts = attempts + 1 where id = $1`,
      [id],
    );
  }
}

@Injectable()
export class PostgresPasswordResetRepository implements IPasswordResetRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(params: {
    id: string;
    userId: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.password_reset_requests (id, user_id, email, code_hash, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [params.id, params.userId, params.email, params.codeHash, params.expiresAt.toISOString()],
    );
  }

  async findLatestActive(email: string): Promise<PasswordResetRequest | null> {
    const result = await this.database.pool.query<{
      id: string;
      user_id: string;
      email: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      attempts: number;
    }>(
      `select id, user_id, email, code_hash, expires_at, consumed_at, attempts
       from accesschat.password_reset_requests
       where email = $1 and consumed_at is null
       order by created_at desc
       limit 1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      codeHash: row.code_hash,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
      attempts: row.attempts,
    };
  }

  async consumePending(email: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.password_reset_requests set consumed_at = now() where email = $1 and consumed_at is null`,
      [email],
    );
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.password_reset_requests set attempts = attempts + 1 where id = $1`,
      [id],
    );
  }
}
