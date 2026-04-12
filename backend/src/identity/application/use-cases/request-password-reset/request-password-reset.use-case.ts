import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import type { ForgotPasswordInput, PasswordResetRequestResponse } from '@accessibility-platform/contracts';

import { AppConfigService } from '../../../../config/app-config.service';
import { EmailService } from '../../../../messaging/infra/providers/email.provider';
import { CaptchaExpiredException, CaptchaInvalidException } from '../../../domain/exceptions';
import { CAPTCHA_REPOSITORY, type ICaptchaRepository } from '../../../domain/repositories/captcha.repository.interface';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from '../../../domain/repositories/verification-request.repository.interface';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: IPasswordResetRepository,
    @Inject(CAPTCHA_REPOSITORY) private readonly captchaRepo: ICaptchaRepository,
    private readonly config: AppConfigService,
    private readonly emailService: EmailService,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<PasswordResetRequestResponse> {
    await this.verifyCaptcha(input.captchaId, input.captchaAnswer);

    const email = Email.create(input.email);
    const user = await this.userRepo.findByEmail(email);

    if (!user) return { status: 'accepted', expiresAt: null };

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + this.config.passwordResetCodeTtlMs);

    await this.resetRepo.consumePending(email.value);
    await this.resetRepo.create({
      id: randomUUID(),
      userId: user.id.value,
      email: email.value,
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt,
    });

    await this.emailService.send({
      to: email.value,
      subject: 'Seu código para redefinir a senha do Access Chat',
      text: `Use o código ${code} para redefinir sua senha. Ele expira em 10 minutos.`,
      html: `<p>Use o código <strong>${code}</strong> para redefinir sua senha no Access Chat.</p>`,
    });

    return { status: 'accepted', expiresAt: expiresAt.toISOString() };
  }

  private async verifyCaptcha(captchaId: string, answer: string): Promise<void> {
    const challenge = await this.captchaRepo.findById(captchaId);
    if (!challenge || challenge.consumedAt) throw new CaptchaInvalidException();
    if (challenge.expiresAt < new Date()) throw new CaptchaExpiredException();

    const incoming = Buffer.from(createHash('sha256').update(answer.trim()).digest('hex'));
    const expected = Buffer.from(challenge.answerHash);
    if (!(incoming.length === expected.length && timingSafeEqual(incoming, expected))) {
      throw new CaptchaInvalidException();
    }

    await this.captchaRepo.consume(captchaId);
  }
}
