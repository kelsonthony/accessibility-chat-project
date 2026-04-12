export const CAPTCHA_REPOSITORY = Symbol('ICaptchaRepository');

export interface CaptchaChallenge {
  id: string;
  prompt: string;
  answerHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface ICaptchaRepository {
  save(challenge: CaptchaChallenge): Promise<void>;
  findById(id: string): Promise<CaptchaChallenge | null>;
  consume(id: string): Promise<void>;
}
