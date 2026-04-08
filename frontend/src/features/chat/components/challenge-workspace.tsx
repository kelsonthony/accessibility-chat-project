'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import type {
  AskQuestionResponse,
  AuthResponse,
  Jurisdiction,
  SupportedLanguage,
  TelemetryDataItem,
} from '@accessibility-platform/contracts';

import { AuthPanel } from '../../auth/components/auth-panel';
import { useTelemetryBatch } from '../../telemetry/use-telemetry-batch';
import {
  askQuestion,
  fetchTelemetry,
  ingestSources,
  login,
  signup,
  syncSources,
} from '../../../services/api';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const copy = {
  pt: {
    eyebrow: 'Hand Talk Challenge',
    title: 'Telemetria forte. Chat útil. RAG pronto para crescer.',
    description:
      'A interface agora segue o escopo do desafio: autenticação, chat protegido, batching de telemetria e fallback operacional enquanto a ingestão oficial evolui.',
    placeholder: 'Pergunte sobre WCAG, LBI, ADA, Section 508 ou EN 301 549...',
    send: 'Enviar pergunta',
    chatTitle: 'Chat accessibility assistant',
  },
  en: {
    eyebrow: 'Hand Talk Challenge',
    title: 'Strong telemetry. Useful chat. RAG ready to grow.',
    description:
      'The interface now follows the challenge scope: authentication, protected chat, telemetry batching, and an operational fallback while official ingestion evolves.',
    placeholder: 'Ask about WCAG, ADA, Section 508, LBI, or EN 301 549...',
    send: 'Send question',
    chatTitle: 'Chat accessibility assistant',
  },
  es: {
    eyebrow: 'Hand Talk Challenge',
    title: 'Telemetría fuerte. Chat útil. RAG listo para crecer.',
    description:
      'La interfaz ahora sigue el alcance del desafío: autenticación, chat protegido, batching de telemetría y fallback operativo mientras evoluciona la ingestión oficial.',
    placeholder: 'Pregunta sobre WCAG, ADA, Section 508, LBI o EN 301 549...',
    send: 'Enviar pregunta',
    chatTitle: 'Asistente de accesibilidad',
  },
} as const;

const defaultPrompts: Record<SupportedLanguage, string> = {
  pt: 'Quais critérios devo priorizar para um checkout acessível por teclado no Brasil?',
  en: 'Which accessibility criteria should I prioritize for a keyboard-friendly checkout in the US?',
  es: '¿Qué criterios debo priorizar para un checkout accesible por teclado en la Unión Europea?',
};

const storageKey = 'handtalk-auth';

export function ChallengeWorkspace() {
  const [language, setLanguage] = useState<SupportedLanguage>('pt');
  const [question, setQuestion] = useState(defaultPrompts.pt);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [opsMessage, setOpsMessage] = useState<string | null>(null);
  const [telemetryItems, setTelemetryItems] = useState<TelemetryDataItem[]>([]);
  const [telemetryTotal, setTelemetryTotal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const telemetry = useTelemetryBatch({
    token: auth?.accessToken || null,
    sessionId,
    language,
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      setAuth(JSON.parse(raw) as AuthResponse);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    telemetry.track('language_changed', { language });
  }, [language, telemetry]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    void refreshTelemetry(auth.accessToken);
  }, [auth]);

  const activeCopy = copy[language];

  async function handleAuth(input: {
    email: string;
    password: string;
    displayName?: string;
    mode: 'login' | 'signup';
  }) {
    setAuthError(null);

    startTransition(async () => {
      try {
        const response =
          input.mode === 'signup'
            ? await signup({
                email: input.email,
                password: input.password,
                displayName: input.displayName || 'Accessibility Analyst',
              })
            : await login({
                email: input.email,
                password: input.password,
              });

        setAuth(response);
        window.localStorage.setItem(storageKey, JSON.stringify(response));
        telemetry.track(input.mode === 'signup' ? 'signup_succeeded' : 'login_succeeded', {
          emailDomain: input.email.split('@')[1] || 'unknown',
        });
        setOpsMessage('Authenticated against accesschatdb.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication failed.';
        setAuthError(message);
        telemetry.track(input.mode === 'signup' ? 'signup_failed' : 'login_failed', {
          reason: message,
        });
      }
    });
  }

  async function handleAsk() {
    if (!auth) {
      setChatError('Authenticate before sending a question.');
      return;
    }

    setChatError(null);
    telemetry.track('message_sent', {
      length: question.length,
      language,
    });

    const nextMessages = [...messages, { role: 'user' as const, content: question }];
    setMessages(nextMessages);

    startTransition(async () => {
      try {
        const response = await askQuestion(auth.accessToken, {
          question,
          language,
          jurisdictions: inferJurisdictions(question),
        });

        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: formatAnswer(response),
          },
        ]);

        telemetry.track('answer_received', {
          mode: response.mode,
          sources: response.sources.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send question.';
        setChatError(message);
        telemetry.track('retry_triggered', {
          reason: message,
        });
      }
    });
  }

  async function refreshTelemetry(token = auth?.accessToken) {
    if (!token) {
      return;
    }

    try {
      const response = await fetchTelemetry(token);
      setTelemetryItems(response.items);
      setTelemetryTotal(response.total);
    } catch (error) {
      setOpsError(error instanceof Error ? error.message : 'Unable to load telemetry data.');
    }
  }

  async function handleSync() {
    if (!auth) {
      return;
    }

    setOpsError(null);
    setOpsMessage(null);

    try {
      const response = await syncSources(auth.accessToken);
      setOpsMessage(`Sources synced: ${response.syncedSources}.`);
    } catch (error) {
      setOpsError(error instanceof Error ? error.message : 'Unable to sync sources.');
    }
  }

  async function handleIngest() {
    if (!auth) {
      return;
    }

    setOpsError(null);
    setOpsMessage(null);

    try {
      const response = await ingestSources(auth.accessToken);
      setOpsMessage(`Chunks seeded: ${response.seededChunks}.`);
    } catch (error) {
      setOpsError(error instanceof Error ? error.message : 'Unable to ingest sources.');
    }
  }

  async function handleFlushTelemetry() {
    await telemetry.flush('timer');
    await refreshTelemetry();
    const metrics = telemetry.getMetrics();
    setOpsMessage(
      metrics.lastFlushAt
        ? `Telemetry flush ${metrics.lastFlushStatus}: ${metrics.lastFlushCount} event(s).`
        : 'No queued telemetry to flush.',
    );
  }

  function handleLogout() {
    window.localStorage.removeItem(storageKey);
    setAuth(null);
    setMessages([]);
    setTelemetryItems([]);
    setTelemetryTotal(0);
    setOpsMessage('Session cleared locally.');
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">{activeCopy.eyebrow}</span>
        <h1>{activeCopy.title}</h1>
        <p>{activeCopy.description}</p>
      </section>

      <section className="workspace-grid">
        <AuthPanel onSubmit={handleAuth} isPending={isPending} error={authError} />

        <section className="panel chat-panel" aria-labelledby="chat-title">
          <div className="toolbar">
            <div>
              <span className="eyebrow">Protected chat</span>
              <h2 id="chat-title">{activeCopy.chatTitle}</h2>
            </div>
            <div className="toolbar-actions">
              <div className="segmented-control" role="group" aria-label="Language selector">
                {(['pt', 'en', 'es'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="segment"
                    aria-pressed={language === option}
                    onClick={() => {
                      setLanguage(option);
                      setQuestion(defaultPrompts[option]);
                    }}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
              {auth ? (
                <button type="button" className="ghost-button" onClick={handleLogout}>
                  Logout
                </button>
              ) : null}
            </div>
          </div>

          <div className="conversation" aria-live="polite">
            {messages.length === 0 ? (
              <article className="message assistant">
                Authenticate, send a question, and inspect batched telemetry through `/data`.
              </article>
            ) : null}

            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                {message.content}
              </article>
            ))}
          </div>

          <div className="stack">
            <label className="field" htmlFor="chat-question">
              <span>Question</span>
              <textarea
                id="chat-question"
                value={question}
                placeholder={activeCopy.placeholder}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  telemetry.track('message_edited', { length: event.target.value.length });
                }}
              />
            </label>

            <button type="button" className="primary-button" disabled={isPending} onClick={handleAsk}>
              {isPending ? 'Sending...' : activeCopy.send}
            </button>

            {chatError ? (
              <p className="feedback error" role="alert">
                {chatError}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="panel insight-panel">
          <div className="fact-card">
            <strong>Telemetry batching</strong>
            Client-side buffering flushes every 5 seconds, at 20 events, and on page hide.
          </div>
          <div className="fact-card">
            <strong>Current backend mode</strong>
            JWT auth and chat fallback are live. Ingestion and vector retrieval stay behind the same
            contracts for the next iteration.
          </div>
          <div className="fact-card">
            <strong>Operational API surface</strong>
            <code>/signup</code>, <code>/login</code>, <code>/collect</code>, <code>/data</code>,
            <code>/ask</code>, <code>/sources/sync</code>, and <code>/ingest</code>.
          </div>
          <div className="fact-card stack">
            <strong>Remote ops</strong>
            <div className="button-row">
              <button type="button" className="ghost-button" onClick={handleSync} disabled={!auth}>
                Sync sources
              </button>
              <button type="button" className="ghost-button" onClick={handleIngest} disabled={!auth}>
                Ingest chunks
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleFlushTelemetry}
                disabled={!auth}
              >
                Flush telemetry
              </button>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void refreshTelemetry()}
                disabled={!auth}
              >
                Refresh /data
              </button>
            </div>
            {opsMessage ? <p className="feedback success">{opsMessage}</p> : null}
            {opsError ? <p className="feedback error">{opsError}</p> : null}
          </div>
          <div className="fact-card">
            <strong>Telemetry inspector</strong>
            <p>Total visible events: {telemetryTotal}</p>
            <div className="telemetry-list">
              {telemetryItems.length === 0 ? (
                <p className="feedback">No persisted telemetry loaded yet.</p>
              ) : (
                telemetryItems.slice(0, 6).map((item) => (
                  <article key={item.id} className="telemetry-item">
                    <strong>{item.eventType}</strong>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <code>{JSON.stringify(item.metadata)}</code>
                  </article>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function inferJurisdictions(question: string): Jurisdiction[] {
  const normalized = question.toLowerCase();

  if (normalized.includes('brasil') || normalized.includes('lbi')) {
    return ['BR', 'GLOBAL'];
  }

  if (normalized.includes('ada') || normalized.includes('508') || normalized.includes('us')) {
    return ['US', 'GLOBAL'];
  }

  if (normalized.includes('eu') || normalized.includes('europe') || normalized.includes('en 301 549')) {
    return ['EU', 'GLOBAL'];
  }

  return ['GLOBAL'];
}

function formatAnswer(response: AskQuestionResponse) {
  const sources = response.sources.map((source) => `${source.title} ${source.section}`).join(', ');
  return `${response.answer}\n\nMode: ${response.mode}\nSources: ${sources}`;
}
