'use client';

import { useState } from 'react';
import { AuthParticleField } from './auth-particle-field';

type AuthMode = 'login' | 'signup';

interface AuthPanelProps {
  onSubmit: (input: { email: string; password: string; displayName?: string; mode: AuthMode }) => void;
  onSocialAuth: (provider: 'google' | 'github') => void;
  isPending: boolean;
  error: string | null;
}

export function AuthPanel({ onSubmit, onSocialAuth, isPending, error }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('Accessibility Analyst');
  const [email, setEmail] = useState('evaluator@accesschat.dev');
  const [password, setPassword] = useState('StrongPass123');

  return (
    <section className="auth-shell" aria-labelledby="auth-title">
      <AuthParticleField />
      <div className="auth-card">
        <div className="section-heading">
          <h2 id="auth-title">{mode === 'signup' ? 'Criar conta' : 'Seja bem-vindo'}</h2>
          <p className="auth-subtitle">
            {mode === 'signup'
              ? 'Crie seu acesso para abrir o chat de acessibilidade.'
              : 'Chat sobre conteudo de acessibilidade.'}
          </p>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Authentication mode">
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

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ email, password, displayName, mode });
          }}
        >
          {mode === 'signup' ? (
            <label className="field">
              <span>Nome</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="primary-button auth-submit" disabled={isPending}>
            {isPending ? 'Processando...' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <div className="auth-divider" aria-hidden="true">
          <span />
          <small>ou</small>
          <span />
        </div>

        <div className="social-auth">
          <button
            type="button"
            className="social-button"
            onClick={() => onSocialAuth('google')}
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
          <button
            type="button"
            className="social-button"
            onClick={() => onSocialAuth('github')}
            disabled={isPending}
          >
            <span className="social-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation">
                <path
                  fill="currentColor"
                  d="M12 .5C5.65.5.5 5.74.5 12.22c0 5.18 3.3 9.57 7.88 11.12.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.52-1.36-1.28-1.72-1.28-1.72-1.05-.73.08-.72.08-.72 1.16.08 1.76 1.22 1.76 1.22 1.03 1.81 2.7 1.29 3.36.99.1-.77.4-1.29.72-1.59-2.55-.3-5.23-1.31-5.23-5.84 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.5.11-3.13 0 0 .97-.32 3.19 1.21a10.8 10.8 0 0 1 5.8 0c2.21-1.53 3.18-1.21 3.18-1.21.63 1.63.23 2.83.11 3.13.74.83 1.19 1.89 1.19 3.18 0 4.54-2.68 5.53-5.24 5.83.41.36.77 1.07.77 2.15 0 1.56-.01 2.82-.01 3.21 0 .31.21.69.8.57A11.74 11.74 0 0 0 23.5 12.22C23.5 5.74 18.35.5 12 .5Z"
                />
              </svg>
            </span>
            Continuar com GitHub
          </button>
        </div>

        {error ? (
          <p className="feedback error" role="alert">
            {error}
          </p>
        ) : null}

      </div>
    </section>
  );
}
