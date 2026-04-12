import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash, compare } from 'bcryptjs';

import type {
  AuthResponse,
  CaptchaChallenge,
  EmailAvailabilityResponse,
  ForgotPasswordInput,
  LoginInput,
  PasswordResetRequestResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
  SignupInput,
  SignupStartInput,
  SignupStartResponse,
  VerifySignupInput,
} from '@accessibility-platform/contracts';

import { AppConfigService } from '../config/app-config.service';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { CaptchaService } from './captcha.service';
import { EmailService } from './email.service';
import { JwtKeyService } from './jwt-key.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly database: DatabaseService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly jwtKeyService: JwtKeyService,
    private readonly captchaService: CaptchaService,
    private readonly emailService: EmailService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResponse> {
    const passwordHash = await hash(input.password, 10);
    const user = await this.usersService.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });

    return this.issueToken(user.id);
  }

  async getCaptcha(): Promise<CaptchaChallenge> {
    return this.captchaService.createChallenge();
  }

  async checkEmailAvailability(email: string): Promise<EmailAvailabilityResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    return {
      email: normalizedEmail,
      exists: Boolean(user),
      available: !user,
    };
  }

  async startSignup(input: SignupStartInput): Promise<SignupStartResponse> {
    const email = input.email.trim().toLowerCase();

    if (email !== input.confirmEmail.trim().toLowerCase()) {
      throw new BadRequestException('Os emails informados nao conferem.');
    }

    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('As senhas informadas nao conferem.');
    }

    await this.captchaService.verifyChallenge(input.captchaId, input.captchaAnswer);

    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already registered.');
    }

    const requestId = randomUUID();
    const code = this.createCode();
    const expiresAt = new Date(Date.now() + this.config.signupCodeTtlMs).toISOString();
    const passwordHash = await hash(input.password, 10);

    await this.database.pool.query(
      `update accesschat.email_verification_requests
       set consumed_at = now()
       where email = $1
         and consumed_at is null`,
      [email],
    );

    await this.database.pool.query(
      `insert into accesschat.email_verification_requests (
         id,
         email,
         display_name,
         password_hash,
         code_hash,
         expires_at
       ) values ($1, $2, $3, $4, $5, $6)`,
      [
        requestId,
        email,
        input.displayName.trim(),
        passwordHash,
        this.hashValue(code),
        expiresAt,
      ],
    );

    const deliveryMode = await this.emailService.send({
      to: email,
      subject: 'Seu codigo de verificacao do Access Chat',
      text: `Use o codigo ${code} para concluir seu cadastro. Ele expira em 1 minuto.`,
      html: `<p>Use o codigo <strong>${code}</strong> para concluir seu cadastro no Access Chat.</p><p>Ele expira em 1 minuto.</p>`,
    });

    return {
      verificationRequestId: requestId,
      email,
      expiresAt,
      deliveryMode,
    };
  }

  async verifySignup(input: VerifySignupInput): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
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
       where id = $1
         and email = $2
       limit 1`,
      [input.verificationRequestId, email],
    );

    const request = result.rows[0];

    if (!request || request.consumed_at) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (new Date(request.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (request.attempts >= 5) {
      throw new BadRequestException('Numero maximo de tentativas excedido.');
    }

    if (!this.matches(input.code.trim(), request.code_hash)) {
      await this.database.pool.query(
        `update accesschat.email_verification_requests
         set attempts = attempts + 1
         where id = $1`,
        [request.id],
      );
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already registered.');
    }

    const user = await this.usersService.create({
      email,
      displayName: request.display_name,
      passwordHash: request.password_hash,
      emailVerifiedAt: new Date().toISOString(),
    });

    await this.database.pool.query(
      `update accesschat.email_verification_requests
       set consumed_at = now()
       where id = $1`,
      [request.id],
    );

    return this.issueToken(user.id);
  }

  async googleAuth(code: string, redirectUri: string): Promise<AuthResponse> {
    if (!this.config.googleClientId || !this.config.googleClientSecret) {
      throw new UnauthorizedException(
        'Google OAuth não está configurado no servidor (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes).',
      );
    }

    // Troca o authorization code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = (await tokenRes.json().catch(() => null)) as { error_description?: string } | null;
      throw new UnauthorizedException(err?.error_description || 'Falha ao trocar código do Google.');
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    // Busca informações do usuário
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Não foi possível obter dados do usuário do Google.');
    }

    const userInfo = (await userRes.json()) as {
      email: string;
      verified_email: boolean;
      name?: string;
    };

    if (!userInfo.verified_email) {
      throw new UnauthorizedException('O email do Google não está verificado.');
    }

    const email = userInfo.email.trim().toLowerCase();
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      const displayName = userInfo.name || email.split('@')[0];
      const passwordHash = await hash(randomUUID(), 10);
      user = await this.usersService.create({
        email,
        displayName,
        passwordHash,
        emailVerifiedAt: new Date().toISOString(),
      });
    }

    return this.issueToken(user.id);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.issueToken(user.id);
  }

  async requestPasswordReset(
    input: ForgotPasswordInput,
  ): Promise<PasswordResetRequestResponse> {
    const email = input.email.trim().toLowerCase();
    await this.captchaService.verifyChallenge(input.captchaId, input.captchaAnswer);

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        status: 'accepted',
        expiresAt: null,
      };
    }

    const requestId = randomUUID();
    const code = this.createCode();
    const expiresAt = new Date(Date.now() + this.config.passwordResetCodeTtlMs).toISOString();

    await this.database.pool.query(
      `update accesschat.password_reset_requests
       set consumed_at = now()
       where email = $1
         and consumed_at is null`,
      [email],
    );

    await this.database.pool.query(
      `insert into accesschat.password_reset_requests (
         id,
         user_id,
         email,
         code_hash,
         expires_at
       ) values ($1, $2, $3, $4, $5)`,
      [requestId, user.id, email, this.hashValue(code), expiresAt],
    );

    await this.emailService.send({
      to: email,
      subject: 'Seu codigo para redefinir a senha do Access Chat',
      text: `Use o codigo ${code} para redefinir sua senha. Ele expira em 10 minutos.`,
      html: `<p>Use o codigo <strong>${code}</strong> para redefinir sua senha no Access Chat.</p><p>Ele expira em 10 minutos.</p>`,
    });

    return {
      status: 'accepted',
      expiresAt,
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    const email = input.email.trim().toLowerCase();

    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('As senhas informadas nao conferem.');
    }

    const result = await this.database.pool.query<{
      id: string;
      code_hash: string;
      expires_at: string;
      consumed_at: string | null;
      attempts: number;
    }>(
      `select id, code_hash, expires_at, consumed_at, attempts
       from accesschat.password_reset_requests
       where email = $1
         and consumed_at is null
       order by created_at desc
       limit 1`,
      [email],
    );

    const request = result.rows[0];

    if (!request) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (new Date(request.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (request.attempts >= 5) {
      throw new BadRequestException('Numero maximo de tentativas excedido.');
    }

    if (!this.matches(input.code.trim(), request.code_hash)) {
      await this.database.pool.query(
        `update accesschat.password_reset_requests
         set attempts = attempts + 1
         where id = $1`,
        [request.id],
      );
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    const passwordHash = await hash(input.password, 10);
    await this.usersService.updatePasswordByEmail(email, passwordHash);

    await this.database.pool.query(
      `update accesschat.password_reset_requests
       set consumed_at = now()
       where email = $1
         and consumed_at is null`,
      [email],
    );

    return {
      status: 'password_updated',
    };
  }

  private async issueToken(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    }, this.jwtKeyService.signOptions);

    return {
      accessToken,
      user: this.usersService.toAuthUser(user),
    };
  }

  private createCode(): string {
    return String(randomInt(100000, 1000000));
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
