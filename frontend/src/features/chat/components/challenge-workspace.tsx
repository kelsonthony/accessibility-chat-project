'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  AskQuestionResponse,
  AuthResponse,
  CaptchaChallenge,
  ForgotPasswordInput,
  Jurisdiction,
  PasswordResetRequestResponse,
  ResetPasswordInput,
  SignupStartInput,
  SignupStartResponse,
  SupportedLanguage,
  TelemetryDataItem,
  VerifySignupInput,
} from '@accessibility-platform/contracts';

import { AuthPanel } from '../../auth/components/auth-panel';
import { useTelemetryBatch } from '../../telemetry/use-telemetry-batch';
import {
  askQuestion,
  fetchCaptcha,
  fetchTelemetry,
  forgotPassword,
  ingestSources,
  login,
  resetPassword,
  signup,
  startSignup,
  syncSources,
  verifySignup,
} from '../../../services/api';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
};

const copy = {
  pt: {
    placeholder: 'Pergunte sobre WCAG, LBI, ADA ou Section 508...',
    send: 'Enviar',
    empty: 'No que você está pensando hoje?',
  },
  en: {
    placeholder: 'Ask about WCAG, ADA, Section 508, LBI, or EN 301 549...',
    send: 'Send',
    empty: 'How can I help you today with accessibility content?',
  },
  es: {
    placeholder: 'Pregunta sobre WCAG, ADA, Section 508, LBI o EN 301 549...',
    send: 'Enviar',
    empty: '¿Cómo puedo ayudarte hoy con contenido de accesibilidad?',
  },
} as const;

const defaultPrompts: Record<SupportedLanguage, string> = {
  pt: 'Quais requisitos da LBI devo observar no Brasil para acessibilidade?',
  en: 'Which accessibility criteria should I prioritize for a keyboard-friendly checkout?',
  es: '¿Qué criterios debo priorizar para un checkout accesible por teclado?',
};

const storageKey = 'handtalk-auth';
const conversationsStorageKey = 'handtalk-conversations';
const activeConversationStorageKey = 'handtalk-active-conversation';
const historyOpenStorageKey = 'handtalk-history-open';
const languageStorageKey = 'handtalk-language';
const minimumReplyDelayMs = 700;
const initialConversation: Conversation = {
  id: 'initial-conversation',
  title: 'Nova conversa',
  messages: [],
  updatedAt: '',
};

function createBlankConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'Nova conversa',
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function ChallengeWorkspace() {
  const [language, setLanguage] = useState<SupportedLanguage>('pt');
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([initialConversation]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [opsMessage, setOpsMessage] = useState<string | null>(null);
  const [telemetryItems, setTelemetryItems] = useState<TelemetryDataItem[]>([]);
  const [telemetryTotal, setTelemetryTotal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const telemetry = useTelemetryBatch({
    token: auth?.accessToken || null,
    sessionId,
    language,
  });

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

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
    const savedConversations = window.localStorage.getItem(conversationsStorageKey);
    const savedActiveConversation = window.localStorage.getItem(activeConversationStorageKey);
    const savedHistoryOpen = window.localStorage.getItem(historyOpenStorageKey);
    const savedLanguage = window.localStorage.getItem(languageStorageKey);

    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations) as Conversation[];
        if (parsed.length > 0) {
          setConversations(parsed);
        }
      } catch {
        window.localStorage.removeItem(conversationsStorageKey);
      }
    }

    if (savedActiveConversation) {
      setActiveConversationId(savedActiveConversation);
    }

    if (savedHistoryOpen) {
      setHistoryOpen(savedHistoryOpen === 'true');
    }

    if (savedLanguage === 'pt' || savedLanguage === 'en' || savedLanguage === 'es') {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    setActiveConversationId((current) => current || conversations[0]?.id || '');
  }, [conversations]);

  useEffect(() => {
    window.localStorage.setItem(conversationsStorageKey, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    window.localStorage.setItem(activeConversationStorageKey, activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    window.localStorage.setItem(historyOpenStorageKey, String(historyOpen));
  }, [historyOpen]);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  useEffect(() => {
    telemetry.track('language_changed', { language });
  }, [language, telemetry]);

  useEffect(() => {
    if (auth) {
      return;
    }

    void refreshCaptcha();
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    void refreshTelemetry(auth.accessToken);
  }, [auth]);

  const activeCopy = copy[language];
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const messages = activeConversation?.messages || [];
  const hasConversationHistory = conversations.some((conversation) => conversation.messages.length > 0);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [question]);

  async function handleLogin(input: { email: string; password: string }) {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      const response = await login({
        email: input.email,
        password: input.password,
      });

      setAuth(response);
      window.localStorage.setItem(storageKey, JSON.stringify(response));
      telemetry.track('login_succeeded', {
        emailDomain: input.email.split('@')[1] || 'unknown',
      });
      setOpsMessage('Sessão autenticada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      setAuthError(message);
      telemetry.track('login_failed', {
        reason: message,
      });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleStartSignup(input: SignupStartInput): Promise<SignupStartResponse> {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      const response = await startSignup(input);
      telemetry.track('signup_succeeded', {
        emailDomain: input.email.split('@')[1] || 'unknown',
        deliveryMode: response.deliveryMode,
      });
      setAuthMessage(`Codigo enviado para ${response.email}.`);
      await refreshCaptcha();
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start signup.';
      setAuthError(message);
      telemetry.track('signup_failed', {
        reason: message,
      });
      await refreshCaptcha();
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleVerifySignup(input: VerifySignupInput) {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      const response = await verifySignup(input);
      setAuth(response);
      window.localStorage.setItem(storageKey, JSON.stringify(response));
      setOpsMessage('Sessão autenticada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify signup.';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleForgotPassword(
    input: ForgotPasswordInput,
  ): Promise<PasswordResetRequestResponse> {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      const response = await forgotPassword(input);
      setAuthMessage(`Se o email existir, um codigo foi enviado para ${input.email}.`);
      await refreshCaptcha();
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to request password reset.';
      setAuthError(message);
      await refreshCaptcha();
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleResetPassword(input: ResetPasswordInput) {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      await resetPassword(input);
      setAuthMessage('Senha redefinida. Faça login com a nova senha.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset password.';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleSocialAuth(provider: 'google' | 'github') {
    const credentials = {
      google: {
        email: 'google.user@accesschat.dev',
        password: 'StrongPass123',
        displayName: 'Google User',
      },
      github: {
        email: 'github.user@accesschat.dev',
        password: 'StrongPass123',
        displayName: 'GitHub User',
      },
    }[provider];

    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      let response: AuthResponse;

      try {
        response = await login({
          email: credentials.email,
          password: credentials.password,
        });
      } catch {
        response = await signup({
          email: credentials.email,
          password: credentials.password,
          displayName: credentials.displayName,
        });
      }

      setAuth(response);
      window.localStorage.setItem(storageKey, JSON.stringify(response));
      telemetry.track('login_succeeded', {
        emailDomain: credentials.email.split('@')[1] || 'unknown',
        provider,
      });
      setOpsMessage(`Sessão autenticada via ${provider === 'google' ? 'Google' : 'GitHub'} em modo demo.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Social authentication failed.';
      setAuthError(message);
      telemetry.track('login_failed', {
        reason: message,
        provider,
      });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function refreshCaptcha() {
    try {
      const nextCaptcha = await fetchCaptcha();
      setCaptcha(nextCaptcha);
      setCaptchaError(null);
    } catch {
      setCaptcha(null);
      setCaptchaError('Nao foi possivel carregar o captcha.');
    }
  }

  async function handleAsk() {
    if (!auth) {
      setChatError('Authenticate before sending a question.');
      return;
    }

    if (!question.trim() || isAsking) {
      return;
    }

    setChatError(null);
    telemetry.track('message_sent', {
      length: question.length,
      language,
    });

    const nextMessages = [...messages, { role: 'user' as const, content: question }];
    const submittedQuestion = question;
    setQuestion('');
    updateConversation(activeConversation.id, nextMessages, submittedQuestion);
    setIsAsking(true);

    try {
      const startedAt = Date.now();
      const response = await askQuestion(auth.accessToken, {
        question: submittedQuestion,
        language,
        jurisdictions: inferJurisdictions(submittedQuestion),
      });

      const elapsed = Date.now() - startedAt;
      const remainingDelay = minimumReplyDelayMs - elapsed;

      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }

      updateConversation(activeConversation.id, [
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
    } finally {
      setIsAsking(false);
    }
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
    const blankConversation = createBlankConversation();
    setConversations([blankConversation]);
    setActiveConversationId(blankConversation.id);
    window.localStorage.removeItem(conversationsStorageKey);
    window.localStorage.removeItem(activeConversationStorageKey);
    setTelemetryItems([]);
    setTelemetryTotal(0);
    setSettingsOpen(false);
  }

  function handleNewConversation() {
    const newConversation = createBlankConversation();

    setConversations((current) => [newConversation, ...current]);
    setActiveConversationId(newConversation.id);
    setQuestion('');
    setHistoryOpen(false);
  }

  function handleLanguageChange(nextLanguage: SupportedLanguage) {
    setLanguage(nextLanguage);
    setQuestion((current) =>
      Object.values(defaultPrompts).includes(current) ? '' : current,
    );
  }

  function updateConversation(id: string, nextMessages: Message[], draftTitle?: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: nextMessages,
              title:
                conversation.title === 'Nova conversa' && draftTitle
                  ? draftTitle.slice(0, 48)
                  : conversation.title,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }

  if (!auth) {
    return (
      <main className="minimal-shell">
        <div className="topbar unauthenticated">
          <div className="topbar-right">
            <div className="language-select" role="group" aria-label="Language selector">
              {(['pt', 'en', 'es'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="language-button"
                  aria-pressed={language === option}
                  onClick={() => handleLanguageChange(option)}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <AuthPanel
          captcha={captcha}
          captchaError={captchaError}
          onRefreshCaptcha={refreshCaptcha}
          onLogin={handleLogin}
          onStartSignup={handleStartSignup}
          onVerifySignup={handleVerifySignup}
          onForgotPassword={handleForgotPassword}
          onResetPassword={handleResetPassword}
          onSocialAuth={handleSocialAuth}
          isPending={isAuthenticating}
          error={authError}
          successMessage={authMessage}
        />
      </main>
    );
  }

  return (
    <main className="minimal-shell">
      <div className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
          <button
            type="button"
            className="history-toggle"
            aria-label="Toggle history"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            Historico
          </button>
          <button type="button" className="ghost-button topbar-new-chat" onClick={handleNewConversation}>
            Novo chat
          </button>
        </div>
        <div className="topbar-right">
          <div className="language-select" role="group" aria-label="Language selector">
            {(['pt', 'en', 'es'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="language-button"
                aria-pressed={language === option}
                onClick={() => handleLanguageChange(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="ghost-button topbar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <aside className="settings-drawer">
          <div className="settings-section">
            <strong>Settings</strong>
          </div>
          <div className="settings-section">
            <strong>Remote ops</strong>
            <button type="button" className="ghost-button" onClick={handleSync}>
              Sync sources
            </button>
            <button type="button" className="ghost-button" onClick={handleIngest}>
              Ingest chunks
            </button>
            <button type="button" className="ghost-button" onClick={handleFlushTelemetry}>
              Flush telemetry
            </button>
            <button type="button" className="ghost-button" onClick={() => void refreshTelemetry()}>
              Refresh /data
            </button>
          </div>
          <div className="settings-section">
            <strong>Telemetry</strong>
            <p className="feedback">Stored events: {telemetryTotal}</p>
            {telemetryItems.slice(0, 5).map((item) => (
              <article key={item.id} className="settings-item">
                <strong>{item.eventType}</strong>
                <span>{new Date(item.timestamp).toLocaleString()}</span>
              </article>
            ))}
          </div>
          {opsMessage ? <p className="feedback success">{opsMessage}</p> : null}
          {opsError ? <p className="feedback error">{opsError}</p> : null}
        </aside>
      ) : null}

      <section
        className={`chat-layout ${
          !hasConversationHistory || !historyOpen ? 'chat-layout-single' : ''
        }`}
      >
        {historyOpen && hasConversationHistory ? (
          <aside className="history-sidebar">
            <button type="button" className="ghost-button history-new" onClick={handleNewConversation}>
              + Nova conversa
            </button>
            <div className="history-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`history-item ${
                    conversation.id === activeConversation.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setHistoryOpen(false);
                  }}
                >
                  <strong>{conversation.title}</strong>
                  <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section className="chat-shell">
        {messages.length === 0 ? (
          <section className="empty-stage" aria-live="polite">
            <div className="empty-state">
              <h1>{activeCopy.empty}</h1>
            </div>

            <div className="composer-shell composer-shell-centered">
              <div className="composer-card">
                <textarea
                  id="chat-question"
                  ref={textareaRef}
                  value={question}
                  placeholder={activeCopy.placeholder}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    telemetry.track('message_edited', { length: event.target.value.length });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (!isAsking && question.trim()) {
                        void handleAsk();
                      }
                    }
                  }}
                />
                <div className="composer-actions">
                  {chatError ? <p className="feedback error">{chatError}</p> : null}
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isAsking || !question.trim()}
                    onClick={handleAsk}
                  >
                    {isAsking ? '...' : activeCopy.send}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="chat-scroll" aria-live="polite">
              <>
                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                    {message.content}
                  </article>
                ))}
                {isAsking ? (
                  <article className="message assistant typing" aria-label="Assistant is typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </article>
                ) : null}
              </>
            </div>

            <div className="composer-shell">
              <div className="composer-card">
                <textarea
                  id="chat-question"
                  ref={textareaRef}
                  value={question}
                  placeholder={activeCopy.placeholder}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    telemetry.track('message_edited', { length: event.target.value.length });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (!isAsking && question.trim()) {
                        void handleAsk();
                      }
                    }
                  }}
                />
                <div className="composer-actions">
                  {chatError ? <p className="feedback error">{chatError}</p> : null}
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isAsking || !question.trim()}
                    onClick={handleAsk}
                  >
                    {isAsking ? '...' : activeCopy.send}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        </section>
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
  return `${response.answer}\n\nSources: ${sources}`;
}
