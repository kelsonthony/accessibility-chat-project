import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type { CaptchaChallenge } from '@accessibility-platform/contracts';

import { DatabaseService } from '../database/database.service';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class CaptchaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

  async createChallenge(): Promise<CaptchaChallenge> {
    const left = randomInt(2, 10);
    const right = randomInt(1, 10);
    const prompt = `Quanto é ${left} + ${right}?`;
    const answer = String(left + right);
    const challenge: CaptchaChallenge = {
      captchaId: randomUUID(),
      prompt,
      expiresAt: new Date(Date.now() + this.config.captchaTtlMs).toISOString(),
    };

    await this.database.pool.query(
      `insert into accesschat.captcha_challenges (id, prompt, answer_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [challenge.captchaId, challenge.prompt, this.hashValue(answer), challenge.expiresAt],
    );

    return challenge;
  }

  async verifyChallenge(captchaId: string, answer: string): Promise<void> {
    const result = await this.database.pool.query<{
      id: string;
      answer_hash: string;
      expires_at: string;
      consumed_at: string | null;
    }>(
      `select id, answer_hash, expires_at, consumed_at
       from accesschat.captcha_challenges
       where id = $1
       limit 1`,
      [captchaId],
    );

    const challenge = result.rows[0];

    if (!challenge || challenge.consumed_at) {
      throw new BadRequestException('Captcha invalido ou expirado.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Captcha expirado. Gere um novo desafio.');
    }

    if (!this.matches(answer.trim(), challenge.answer_hash)) {
      throw new BadRequestException('Captcha invalido ou expirado.');
    }

    await this.database.pool.query(
      `update accesschat.captcha_challenges
       set consumed_at = now()
       where id = $1`,
      [captchaId],
    );
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private matches(value: string, expectedHash: string): boolean {
    const incoming = Buffer.from(this.hashValue(value));
    const expected = Buffer.from(expectedHash);
    return incoming.length === expected.length && timingSafeEqual(incoming, expected);
  }
}
