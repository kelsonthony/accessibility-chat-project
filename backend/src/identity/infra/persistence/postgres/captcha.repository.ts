import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../../database/database.service';
import type { CaptchaChallenge, ICaptchaRepository } from '../../../domain/repositories/captcha.repository.interface';

@Injectable()
export class PostgresCaptchaRepository implements ICaptchaRepository {
  constructor(private readonly database: DatabaseService) {}

  async save(challenge: CaptchaChallenge): Promise<void> {
    await this.database.pool.query(
      `insert into accesschat.captcha_challenges (id, prompt, answer_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [challenge.id, challenge.prompt, challenge.answerHash, challenge.expiresAt.toISOString()],
    );
  }

  async findById(id: string): Promise<CaptchaChallenge | null> {
    const result = await this.database.pool.query<{
      id: string;
      prompt: string;
      answer_hash: string;
      expires_at: string;
      consumed_at: string | null;
    }>(
      `select id, prompt, answer_hash, expires_at, consumed_at
       from accesschat.captcha_challenges
       where id = $1
       limit 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      prompt: row.prompt,
      answerHash: row.answer_hash,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
    };
  }

  async consume(id: string): Promise<void> {
    await this.database.pool.query(
      `update accesschat.captcha_challenges set consumed_at = now() where id = $1`,
      [id],
    );
  }
}
