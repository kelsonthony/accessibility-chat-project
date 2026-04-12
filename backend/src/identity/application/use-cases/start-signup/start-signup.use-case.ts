import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { randomInt } from 'node:crypto';

import type { SignupStartInput, SignupStartResponse } from '@accessibility-platform/contracts';

import { AppConfigService } from '../../../../config/app-config.service';
import { EmailService } from '../../../../messaging/infra/providers/email.provider';
import {
  CaptchaExpiredException,
  CaptchaInvalidException,
  DuplicateEmailException,
  EmailsDoNotMatchException,
  PasswordsDoNotMatchException,
} from '../../../domain/exceptions';
import { CAPTCHA_REPOSITORY, type ICaptchaRepository } from '../../../domain/repositories/captcha.repository.interface';
import { USER_REPOSITORY, type IUserRepository } from '../../../domain/repositories/user.repository.interface';
import {
  VERIFICATION_REQUEST_REPOSITORY,
  type IVerificationRequestRepository,
} from '../../../domain/repositories/verification-request.repository.interface';
import { Email } from '../../../domain/value-objects/email.vo';
import { PASSWORD_SERVICE, type IPasswordService } from '../../../infra/providers/password.provider';

@Injectable()
export class StartSignupUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(VERIFICATION_REQUEST_REPOSITORY) private readonly verificationRepo: IVerificationRequestRepository,
    @Inject(CAPTCHA_REPOSITORY) private readonly captchaRepo: ICaptchaRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: IPasswordService,
    private readonly config: AppConfigService,
    private readonly emailService: EmailService,
  ) {}

  async execute(input: SignupStartInput): Promise<SignupStartResponse> {
    const email = Email.create(input.email);

    if (email.value !== input.confirmEmail.trim().toLowerCase()) {
      throw new EmailsDoNotMatchException();
    }

    if (input.password !== input.confirmPassword) {
      throw new PasswordsDoNotMatchException();
    }

    await this.verifyCaptcha(input.captchaId, input.captchaAnswer);

    if (await this.userRepo.existsByEmail(email)) {
      throw new DuplicateEmailException();
    }

    const code = String(randomInt(100000, 1000000));
    const requestId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.signupCodeTtlMs);
    const passwordHash = await this.passwordService.hash(input.password);

    await this.verificationRepo.consumePending(email.value);
    await this.verificationRepo.create({
      id: requestId,
      email: email.value,
      displayName: input.displayName.trim(),
      passwordHash,
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt,
    });

    const deliveryMode = await this.emailService.send({
      to: email.value,
      subject: 'Seu código de verificação do Access Chat',
      text: `Use o código ${code} para concluir seu cadastro. Ele expira em 10 minutos.`,
      html: `<p>Use o código <strong>${code}</strong> para concluir seu cadastro no Access Chat.</p>`,
    });

    return { verificationRequestId: requestId, email: email.value, expiresAt: expiresAt.toISOString(), deliveryMode };
  }

  private async verifyCaptcha(captchaId: string, answer: string): Promise<void> {
    const challenge = await this.captchaRepo.findById(captchaId);

    if (!challenge || challenge.consumedAt) throw new CaptchaInvalidException();
    if (challenge.expiresAt < new Date()) throw new CaptchaExpiredException();

    const incoming = Buffer.from(createHash('sha256').update(answer.trim()).digest('hex'));
    const expected = Buffer.from(challenge.answerHash);
    const valid = incoming.length === expected.length && timingSafeEqual(incoming, expected);

    if (!valid) throw new CaptchaInvalidException();

    await this.captchaRepo.consume(captchaId);
  }
}
