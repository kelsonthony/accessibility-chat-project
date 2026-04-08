'use client';

import { useState } from 'react';

type AuthMode = 'login' | 'signup';

interface AuthPanelProps {
  onSubmit: (input: { email: string; password: string; displayName?: string; mode: AuthMode }) => void;
  isPending: boolean;
  error: string | null;
}

export function AuthPanel({ onSubmit, isPending, error }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [displayName, setDisplayName] = useState('Accessibility Analyst');
  const [email, setEmail] = useState('analyst@handtalk.dev');
  const [password, setPassword] = useState('StrongPass123');

  return (
    <section className="panel auth-panel" aria-labelledby="auth-title">
      <div className="section-heading">
        <span className="eyebrow">Authentication</span>
        <h2 id="auth-title">{mode === 'signup' ? 'Create evaluator account' : 'Login to continue'}</h2>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Authentication mode">
        {(['signup', 'login'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="segment"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
          >
            {option}
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
            <span>Display name</span>
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
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? 'Working...' : mode === 'signup' ? 'Signup' : 'Login'}
        </button>
      </form>

      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

