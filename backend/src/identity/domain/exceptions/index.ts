import { DomainException } from '../../../@shared/domain/domain-exception.base';

export class UserNotFoundException extends DomainException {
  readonly code = 'USER_NOT_FOUND';
  constructor() {
    super('Usuário não encontrado.');
  }
}

export class InvalidCredentialsException extends DomainException {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Credenciais inválidas.');
  }
}

export class DuplicateEmailException extends DomainException {
  readonly code = 'DUPLICATE_EMAIL';
  constructor() {
    super('Este e-mail já está cadastrado.');
  }
}

export class InvalidVerificationCodeException extends DomainException {
  readonly code = 'INVALID_VERIFICATION_CODE';
  constructor() {
    super('Código inválido ou expirado.');
  }
}

export class VerificationCodeExpiredException extends DomainException {
  readonly code = 'VERIFICATION_CODE_EXPIRED';
  constructor() {
    super('Código expirado. Solicite um novo código.');
  }
}

export class MaxAttemptsExceededException extends DomainException {
  readonly code = 'MAX_ATTEMPTS_EXCEEDED';
  constructor() {
    super('Número máximo de tentativas excedido.');
  }
}

export class CaptchaInvalidException extends DomainException {
  readonly code = 'CAPTCHA_INVALID';
  constructor() {
    super('Captcha inválido ou expirado.');
  }
}

export class CaptchaExpiredException extends DomainException {
  readonly code = 'CAPTCHA_EXPIRED';
  constructor() {
    super('Captcha expirado. Gere um novo desafio.');
  }
}

export class PasswordsDoNotMatchException extends DomainException {
  readonly code = 'PASSWORDS_DO_NOT_MATCH';
  constructor() {
    super('As senhas informadas não conferem.');
  }
}

export class EmailsDoNotMatchException extends DomainException {
  readonly code = 'EMAILS_DO_NOT_MATCH';
  constructor() {
    super('Os e-mails informados não conferem.');
  }
}

export class GoogleOAuthNotConfiguredException extends DomainException {
  readonly code = 'GOOGLE_OAUTH_NOT_CONFIGURED';
  constructor() {
    super('Google OAuth não está configurado no servidor.');
  }
}

export class GoogleOAuthFailedException extends DomainException {
  readonly code = 'GOOGLE_OAUTH_FAILED';
  constructor(reason?: string) {
    super(reason ?? 'Falha ao autenticar com o Google.');
  }
}
