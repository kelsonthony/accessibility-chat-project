'use client';

import { useEffect, useState } from 'react';

import type {
  CaptchaChallenge,
  ForgotPasswordInput,
  PasswordResetRequestResponse,
  ResetPasswordInput,
  SignupStartInput,
  SignupStartResponse,
  VerifySignupInput,
} from '@accessibility-platform/contracts';

import { AuthParticleField } from './auth-particle-field';

type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

interface AuthPanelProps {
  captcha: CaptchaChallenge | null;
  captchaError: string | null;
  onRefreshCaptcha: () => Promise<void>;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onStartSignup: (input: SignupStartInput) => Promise<SignupStartResponse>;
  onVerifySignup: (input: VerifySignupInput) => Promise<void>;
  onForgotPassword: (input: ForgotPasswordInput) => Promise<PasswordResetRequestResponse>;
  onResetPassword: (input: ResetPasswordInput) => Promise<void>;
  onGoogleAuth: () => Promise<void>;
  isPending: boolean;
  error: string | null;
  successMessage: string | null;
}

export function AuthPanel({
  captcha,
  captchaError,
  onRefreshCaptcha,
  onLogin,
  onStartSignup,
  onVerifySignup,
  onForgotPassword,
  onResetPassword,
  onGoogleAuth,
  isPending,
  error,
  successMessage,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [verificationRequestId, setVerificationRequestId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState(false);

  const emailsMatch =
    email.trim().length > 0 &&
    confirmEmail.trim().length > 0 &&
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const emailMismatch =
    confirmEmail.trim().length > 0 &&
    email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase();
  const passwordChecks = {
    minLength: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordStrong = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if ((mode === 'signup' || mode === 'forgot') && !captcha) {
      void onRefreshCaptcha();
    }
  }, [captcha, mode, onRefreshCaptcha]);

  const heading = {
    login: 'Seja bem-vindo',
    signup: 'Criar conta',
    verify: 'Verifique seu email',
    forgot: 'Recuperar senha',
    reset: 'Nova senha',
  }[mode];

  const subtitle = {
    login: 'Chat sobre conteudo de acessibilidade.',
    signup: 'Confirme seu email antes de entrar no chat.',
    verify: 'Digite o codigo enviado para concluir o cadastro.',
    forgot: 'Receba um codigo temporario para redefinir a senha.',
    reset: 'Defina a nova senha com o codigo recebido por email.',
  }[mode];

  const submitDisabled =
    isPending ||
    (mode === 'signup' &&
      (!captcha ||
        !emailsMatch ||
        !passwordStrong ||
        !passwordsMatch ||
        captchaAnswer.trim().length === 0)) ||
    (mode === 'verify' && code.trim().length !== 6) ||
    (mode === 'forgot' && (!captcha || captchaAnswer.trim().length === 0 || email.trim().length === 0)) ||
    (mode === 'reset' && (!passwordStrong || !passwordsMatch || code.trim().length !== 6));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === 'login') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setLoginEmailError(true);
        return;
      }
      setLoginEmailError(false);
      await onLogin({ email, password });
      return;
    }

    if (mode === 'signup') {
      if (!captcha) {
        return;
      }

      const response = await onStartSignup({
        displayName,
        email,
        confirmEmail,
        password,
        confirmPassword,
        captchaId: captcha?.captchaId || '',
        captchaAnswer,
      });
      setVerificationRequestId(response.verificationRequestId);
      setCode('');
      setCaptchaAnswer('');
      setMode('verify');
      return;
    }

    if (mode === 'verify') {
      await onVerifySignup({
        verificationRequestId,
        email,
        code,
      });
      return;
    }

    if (mode === 'forgot') {
      if (!captcha) {
        return;
      }

      await onForgotPassword({
        email,
        captchaId: captcha?.captchaId || '',
        captchaAnswer,
      });
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setCaptchaAnswer('');
      setMode('reset');
      return;
    }

    await onResetPassword({
      email,
      code,
      password,
      confirmPassword,
    });
    setMode('login');
    setCode('');
  }

  return (
    <section className="auth-shell" aria-labelledby="auth-title">
      <AuthParticleField />
      <div className="auth-card">
        <div className="section-heading">
          <h2 id="auth-title">{heading}</h2>
          <p className="auth-subtitle">{subtitle}</p>
        </div>

        {mode === 'login' || mode === 'signup' ? (
          <div className="segmented-control" role="group" aria-label="Modo de autenticação">
            {([
              ['login', 'Entrar'],
              ['signup', 'Criar conta'],
            ] as const).map(([option, label]) => (
              <button
                key={option}
                type="button"
                className="segment"
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <form className="stack" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' ? (
            <div className="field">
              <label htmlFor="field-display-name">Nome</label>
              <input
                id="field-display-name"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          ) : null}

          {mode !== 'verify' ? (
            <div className="field">
              <label htmlFor="field-email">Email</label>
              <input
                id="field-email"
                type="email"
                autoComplete="email"
                aria-invalid={(emailMismatch || loginEmailError) || undefined}
                aria-describedby={mode === 'signup' ? 'hint-email' : undefined}
                value={email}
                onChange={(event) => { setEmail(event.target.value); setLoginEmailError(false); }}
              />
            </div>
          ) : null}

          {mode === 'signup' ? (
            <>
              <div className="field">
                <label htmlFor="field-confirm-email">Confirmar email</label>
                <input
                  id="field-confirm-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={emailMismatch || undefined}
                  aria-describedby="hint-email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                />
              </div>
              <p
                id="hint-email"
                className={`field-hint ${emailsMatch ? 'ok' : emailMismatch ? 'error' : ''}`}
                aria-live="polite"
              >
                {emailsMatch
                  ? 'Os emails conferem.'
                  : emailMismatch
                    ? 'Os emails são diferentes.'
                    : 'Confirme o mesmo email para continuar.'}
              </p>
            </>
          ) : null}

          {mode === 'login' || mode === 'signup' || mode === 'reset' ? (
            <>
              <div className="field">
                <label htmlFor="field-password">Senha</label>
                <div className="password-input-wrap">
                  <input
                    id="field-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-describedby={mode !== 'login' ? 'hint-password' : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
              {mode === 'signup' || mode === 'reset' ? (
                <div id="hint-password" className="password-rules" aria-live="polite">
                  <p className="field-hint">
                    A senha precisa ter no mínimo 12 caracteres, letras maiúsculas e minúsculas,
                    números e caractere especial.
                  </p>
                  <ul className="password-checklist" aria-label="Requisitos de senha">
                    <li
                      className={passwordChecks.minLength ? 'ok' : ''}
                      aria-label={`12 caracteres ou mais: ${passwordChecks.minLength ? 'atendido' : 'pendente'}`}
                    >
                      12 caracteres ou mais
                    </li>
                    <li
                      className={passwordChecks.upper ? 'ok' : ''}
                      aria-label={`Uma letra maiúscula: ${passwordChecks.upper ? 'atendido' : 'pendente'}`}
                    >
                      Uma letra maiúscula
                    </li>
                    <li
                      className={passwordChecks.lower ? 'ok' : ''}
                      aria-label={`Uma letra minúscula: ${passwordChecks.lower ? 'atendido' : 'pendente'}`}
                    >
                      Uma letra minúscula
                    </li>
                    <li
                      className={passwordChecks.number ? 'ok' : ''}
                      aria-label={`Um número: ${passwordChecks.number ? 'atendido' : 'pendente'}`}
                    >
                      Um número
                    </li>
                    <li
                      className={passwordChecks.special ? 'ok' : ''}
                      aria-label={`Um caractere especial: ${passwordChecks.special ? 'atendido' : 'pendente'}`}
                    >
                      Um caractere especial
                    </li>
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'signup' || mode === 'reset' ? (
            <>
              <div className="field">
                <label htmlFor="field-confirm-password">Confirmar senha</label>
                <div className="password-input-wrap">
                  <input
                    id="field-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={passwordMismatch || undefined}
                    aria-describedby="hint-confirm-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
              <p
                id="hint-confirm-password"
                className={`field-hint ${
                  passwordsMatch ? 'ok' : passwordMismatch || (confirmPassword && !passwordStrong) ? 'error' : ''
                }`}
                aria-live="polite"
              >
                {passwordsMatch && passwordStrong
                  ? 'As senhas conferem.'
                  : passwordMismatch
                    ? 'As senhas são diferentes.'
                    : confirmPassword && !passwordStrong
                      ? 'A senha ainda não atende aos requisitos mínimos.'
                      : 'Confirme a mesma senha para continuar.'}
              </p>
            </>
          ) : null}

          {mode === 'verify' || mode === 'reset' ? (
            <div className="field">
              <label htmlFor="field-code">Código de verificação</label>
              <input
                id="field-code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                aria-describedby="hint-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <p id="hint-code" className="field-hint">
                Digite o código de 6 dígitos enviado para seu email.
              </p>
            </div>
          ) : null}

          {mode === 'signup' || mode === 'forgot' ? (
            <div className="captcha-card" role="group" aria-label="Verificação de segurança">
              <div className="captcha-header">
                <strong aria-live="polite">{captcha?.prompt || captchaError || 'Carregando captcha...'}</strong>
                <button
                  type="button"
                  className="ghost-button captcha-refresh"
                  aria-label="Atualizar desafio do captcha"
                  onClick={() => void onRefreshCaptcha()}
                >
                  Atualizar
                </button>
              </div>
              <div className="field">
                <label htmlFor="field-captcha">Resposta do captcha</label>
                <input
                  id="field-captcha"
                  inputMode="numeric"
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <button type="submit" className="primary-button auth-submit" disabled={submitDisabled}>
            {isPending
              ? 'Processando...'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'signup'
                  ? 'Enviar codigo'
                  : mode === 'verify'
                    ? 'Confirmar cadastro'
                    : mode === 'forgot'
                      ? 'Enviar codigo'
                      : 'Redefinir senha'}
          </button>
        </form>

        {mode === 'login' ? (
          <>
            <div className="auth-meta-actions">
              <button type="button" className="link-button" onClick={() => setMode('forgot')}>
                Esqueci minha senha
              </button>
            </div>

            <div className="auth-divider" aria-hidden="true">
              <span />
              <small>ou</small>
              <span />
            </div>

            <div className="social-auth">
              <button
                type="button"
                className="social-button"
                onClick={() => void onGoogleAuth()}
                disabled={isPending}
              >
                <span className="social-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation">
                    <path
                      d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.51Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.23-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.57A9.99 9.99 0 0 0 12 22Z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.41 13.89A5.98 5.98 0 0 1 6.1 12c0-.66.11-1.31.31-1.89V7.54H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.46l3.33-2.57Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.98c1.47 0 2.79.5 3.82 1.48l2.86-2.86C16.95 2.98 14.7 2 12 2A9.99 9.99 0 0 0 3.08 7.54l3.33 2.57c.79-2.36 2.99-4.13 5.59-4.13Z"
                      fill="#EA4335"
                    />
                  </svg>
                </span>
                Continuar com Google
              </button>
            </div>
          </>
        ) : (
          <div className="auth-meta-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => setMode(mode === 'verify' ? 'signup' : 'login')}
            >
              {mode === 'verify' ? 'Voltar para editar cadastro' : 'Voltar para login'}
            </button>
          </div>
        )}

        {loginEmailError && mode === 'login' ? (
          <p className="feedback error" role="alert">
            E-mail inválido.
          </p>
        ) : null}

        {error ? (
          <p className="feedback error" role="alert">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="feedback success" role="status">
            {successMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
