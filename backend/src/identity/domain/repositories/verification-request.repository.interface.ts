export const VERIFICATION_REQUEST_REPOSITORY = Symbol('IVerificationRequestRepository');

export interface VerificationRequest {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

export interface IVerificationRequestRepository {
  create(params: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findById(id: string, email: string): Promise<VerificationRequest | null>;
  consumePending(email: string): Promise<void>;
  consume(id: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
}

export const PASSWORD_RESET_REPOSITORY = Symbol('IPasswordResetRepository');

export interface PasswordResetRequest {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

export interface IPasswordResetRepository {
  create(params: {
    id: string;
    userId: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findLatestActive(email: string): Promise<PasswordResetRequest | null>;
  consumePending(email: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
}
