import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';

import type { CaptchaChallenge } from '@accessibility-platform/contracts';

import { AppConfigService } from '../../../../config/app-config.service';
import { CAPTCHA_REPOSITORY, type ICaptchaRepository } from '../../../domain/repositories/captcha.repository.interface';

@Injectable()
export class GetCaptchaUseCase {
  constructor(
    @Inject(CAPTCHA_REPOSITORY) private readonly captchaRepo: ICaptchaRepository,
    private readonly config: AppConfigService,
  ) {}

  async execute(): Promise<CaptchaChallenge> {
    const left = randomInt(2, 10);
    const right = randomInt(1, 10);
    const prompt = `Quanto é ${left} + ${right}?`;
    const answer = String(left + right);

    const challenge = {
      captchaId: randomUUID(),
      prompt,
      expiresAt: new Date(Date.now() + this.config.captchaTtlMs).toISOString(),
    };

    await this.captchaRepo.save({
      id: challenge.captchaId,
      prompt: challenge.prompt,
      answerHash: createHash('sha256').update(answer).digest('hex'),
      expiresAt: new Date(challenge.expiresAt),
      consumedAt: null,
    });

    return challenge;
  }
}
