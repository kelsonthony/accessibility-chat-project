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
import { useChatSocket } from '../use-chat-socket';
import {
  fetchCaptcha,
  fetchTelemetry,
  forgotPassword,
  googleAuth,
  ingestSources,
  login,
  resetPassword,
  startSignup,
  syncSources,
  verifySignup,
} from '../../../services/api';
import { generateUUID } from '../../../utils/uuid';

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
    history: 'Histórico',
    newChat: 'Novo chat',
    logout: 'Sair',
    settings: 'Configurações',
    remoteOps: 'Operações remotas',
    syncSources: 'Sincronizar fontes',
    ingestChunks: 'Ingerir chunks',
    flushTelemetry: 'Enviar telemetria',
    refreshData: 'Atualizar /data',
    telemetry: 'Telemetria',
    storedEvents: 'Eventos armazenados',
    newConversation: 'Nova conversa',
  },
  en: {
    placeholder: 'Ask about WCAG, ADA, Section 508, LBI, or EN 301 549...',
    send: 'Send',
    empty: 'How can I help you today with accessibility content?',
    history: 'History',
    newChat: 'New chat',
    logout: 'Logout',
    settings: 'Settings',
    remoteOps: 'Remote ops',
    syncSources: 'Sync sources',
    ingestChunks: 'Ingest chunks',
    flushTelemetry: 'Flush telemetry',
    refreshData: 'Refresh /data',
    telemetry: 'Telemetry',
    storedEvents: 'Stored events',
    newConversation: 'New conversation',
  },
  es: {
    placeholder: 'Pregunta sobre WCAG, ADA, Section 508, LBI o EN 301 549...',
    send: 'Enviar',
    empty: '¿Cómo puedo ayudarte hoy con contenido de accesibilidad?',
    history: 'Historial',
    newChat: 'Nuevo chat',
    logout: 'Cerrar sesión',
    settings: 'Configuración',
    remoteOps: 'Operaciones remotas',
    syncSources: 'Sincronizar fuentes',
    ingestChunks: 'Ingerir fragmentos',
    flushTelemetry: 'Enviar telemetría',
    refreshData: 'Actualizar /data',
    telemetry: 'Telemetría',
    storedEvents: 'Eventos almacenados',
    newConversation: 'Nueva conversación',
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

function getInitialConversation(language: SupportedLanguage): Conversation {
  const titles = {
    pt: 'Nova conversa',
    en: 'New conversation',
    es: 'Nueva conversación',
  };

  return {
    id: 'initial-conversation',
    title: titles[language],
    messages: [],
    updatedAt: '',
  };
}

function createBlankConversation(language: SupportedLanguage): Conversation {
  const titles = {
    pt: 'Nova conversa',
    en: 'New conversation',
    es: 'Nueva conversación',
  };

  return {
    id: generateUUID(),
    title: titles[language],
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function ChallengeWorkspace() {
  const [language, setLanguage] = useState<SupportedLanguage>('pt');
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([getInitialConversation('pt')]);
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
  const typingPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backspaceCountRef = useRef(0);
  const backspaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingStartedRef = useRef(false);
  const authRef = useRef<AuthResponse | null>(null);

  const telemetry = useTelemetryBatch({
    token: auth?.accessToken || null,
    sessionId,
    language,
  });

  const chatSocket = useChatSocket(auth?.accessToken ?? null);

  useEffect(() => {
    setSessionId(generateUUID());
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
    if (!activeConversationId && conversations.length > 0) {
      const firstConversationId = conversations[0]?.id;
      if (firstConversationId) {
        setActiveConversationId(firstConversationId);
      }
    }
  }, [conversations, activeConversationId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        telemetry.track('keyboard_navigation_detected', { key: e.key });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-contrast: more)');
    if (mq.matches) {
      telemetry.track('high_contrast_mode_enabled', { source: 'initial' });
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) telemetry.track('high_contrast_mode_enabled', { source: 'change' });
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      if (!authRef.current) return;
      telemetry.track('session_ended', { trigger: 'tab_close' });
      void telemetry.flush('visibility');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Update conversation titles when language changes
    const newConversationTitles = {
      pt: 'Nova conversa',
      en: 'New conversation',
      es: 'Nueva conversación',
    };

    setConversations((current) => {
      let hasChanges = false;
      const updated = current.map((conversation) => {
        const isDefaultTitle =
          conversation.title === 'Nova conversa' ||
          conversation.title === 'New conversation' ||
          conversation.title === 'Nueva conversación';

        if (isDefaultTitle && conversation.messages.length === 0) {
          const newTitle = newConversationTitles[language];
          if (conversation.title !== newTitle) {
            hasChanges = true;
            return {
              ...conversation,
              title: newTitle,
            };
          }
        }

        return conversation;
      });

      // Only update if there were actual changes
      return hasChanges ? updated : current;
    });
  }, [language]);

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

  useEffect(() => {
    authRef.current = auth;
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
      telemetry.track('session_started', { method: 'password' });
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
      telemetry.track('session_started', { method: 'signup' });
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

  async function handleGoogleAuth() {
    setAuthError(null);
    setAuthMessage(null);
    setIsAuthenticating(true);

    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('Google Client ID não configurado.');
      }

      const redirectUri = `${window.location.origin}/auth/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile',
        access_type: 'offline',
        prompt: 'select_account',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const width = 500;
      const height = 600;
      const left = window.screenLeft + Math.round((window.outerWidth - width) / 2);
      const top = window.screenTop + Math.round((window.outerHeight - height) / 2);

      const popup = window.open(
        authUrl,
        'google-auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
      );

      if (!popup) {
        throw new Error('Popup bloqueado pelo navegador. Permita popups para este site.');
      }

      const code = await new Promise<string>((resolve, reject) => {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            reject(new Error('Login com Google cancelado.'));
          }
        }, 500);

        function onMessage(event: MessageEvent) {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type !== 'GOOGLE_AUTH_CALLBACK') return;

          clearInterval(timer);
          window.removeEventListener('message', onMessage);

          if (event.data.error) {
            reject(new Error(`Erro do Google: ${event.data.error}`));
          } else if (event.data.code) {
            resolve(event.data.code as string);
          } else {
            reject(new Error('Resposta inválida do Google.'));
          }
        }

        window.addEventListener('message', onMessage);
      });

      const response = await googleAuth(code, redirectUri);
      setAuth(response);
      window.localStorage.setItem(storageKey, JSON.stringify(response));
      telemetry.track('login_succeeded', {
        emailDomain: response.user.email.split('@')[1] || 'unknown',
        provider: 'google',
      });
      telemetry.track('session_started', { method: 'google' });
      setOpsMessage('Sessão autenticada via Google.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha na autenticação com Google.';
      setAuthError(message);
      telemetry.track('login_failed', {
        reason: message,
        provider: 'google',
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
      const response = await chatSocket.ask({
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
      telemetry.track('request_latency_observed', {
        latencyMs: elapsed,
        mode: response.mode,
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
    telemetry.track('session_ended', { trigger: 'logout' });
    void telemetry.flush('visibility');
    window.localStorage.removeItem(storageKey);
    setAuth(null);
    const blankConversation = createBlankConversation(language);
    setConversations([blankConversation]);
    setActiveConversationId(blankConversation.id);
    window.localStorage.removeItem(conversationsStorageKey);
    window.localStorage.removeItem(activeConversationStorageKey);
    setTelemetryItems([]);
    setTelemetryTotal(0);
    setSettingsOpen(false);
  }

  function handleNewConversation() {
    if (question.trim()) {
      telemetry.track('message_abandoned', { length: question.length, trigger: 'new_conversation' });
    }
    const newConversation = createBlankConversation(language);

    setConversations((current) => [newConversation, ...current]);
    setActiveConversationId(newConversation.id);
    setQuestion('');
    isTypingStartedRef.current = false;
    setHistoryOpen(false);
  }

  function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    const prev = question;

    if (!isTypingStartedRef.current && next.length > 0) {
      isTypingStartedRef.current = true;
      telemetry.track('message_started', { length: next.length });
    }

    if (prev.trim() && !next.trim()) {
      telemetry.track('message_cleared', { previousLength: prev.length });
      isTypingStartedRef.current = false;
    }

    if (typingPauseTimerRef.current) clearTimeout(typingPauseTimerRef.current);
    if (next.trim()) {
      typingPauseTimerRef.current = setTimeout(() => {
        telemetry.track('typing_pause_detected', { length: next.length, pauseMs: 3000 });
      }, 3000);
    }

    setQuestion(next);
    telemetry.track('message_edited', { length: next.length });
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (typingPauseTimerRef.current) clearTimeout(typingPauseTimerRef.current);
      isTypingStartedRef.current = false;
      if (!isAsking && question.trim()) {
        void handleAsk();
      }
      return;
    }

    if (event.key === 'Backspace') {
      backspaceCountRef.current += 1;
      if (backspaceTimerRef.current) clearTimeout(backspaceTimerRef.current);
      backspaceTimerRef.current = setTimeout(() => {
        backspaceCountRef.current = 0;
      }, 2000);
      if (backspaceCountRef.current >= 5) {
        telemetry.track('repeated_backspace_burst', { count: backspaceCountRef.current });
        backspaceCountRef.current = 0;
      }
    }
  }

  function handleTextareaBlur() {
    if (question.trim()) {
      telemetry.track('focus_loss_detected', { length: question.length });
    }
    if (typingPauseTimerRef.current) clearTimeout(typingPauseTimerRef.current);
  }

  function handleLanguageChange(nextLanguage: SupportedLanguage) {
    setLanguage(nextLanguage);
    setQuestion((current) =>
      Object.values(defaultPrompts).includes(current) ? '' : current,
    );
  }

  function updateConversation(id: string, nextMessages: Message[], draftTitle?: string) {
    const newConversationTitles = ['Nova conversa', 'New conversation', 'Nueva conversación'];

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: nextMessages,
              title:
                newConversationTitles.includes(conversation.title) && draftTitle
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
          onGoogleAuth={handleGoogleAuth}
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
            {activeCopy.history}
          </button>
          <button type="button" className="ghost-button topbar-new-chat" onClick={handleNewConversation}>
            {activeCopy.newChat}
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
            {activeCopy.logout}
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <aside className="settings-drawer" aria-label={activeCopy.settings}>
          <div className="settings-section">
            <strong>{activeCopy.settings}</strong>
          </div>
          <div className="settings-section">
            <strong>{activeCopy.remoteOps}</strong>
            <button type="button" className="ghost-button" onClick={handleSync}>
              {activeCopy.syncSources}
            </button>
            <button type="button" className="ghost-button" onClick={handleIngest}>
              {activeCopy.ingestChunks}
            </button>
            <button type="button" className="ghost-button" onClick={handleFlushTelemetry}>
              {activeCopy.flushTelemetry}
            </button>
            <button type="button" className="ghost-button" onClick={() => void refreshTelemetry()}>
              {activeCopy.refreshData}
            </button>
          </div>
          <div className="settings-section">
            <strong>{activeCopy.telemetry}</strong>
            <p className="feedback">{activeCopy.storedEvents}: {telemetryTotal}</p>
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
          <aside className="history-sidebar" aria-label={activeCopy.history}>
            <button type="button" className="ghost-button history-new" onClick={handleNewConversation}>
              + {activeCopy.newConversation}
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
                <label htmlFor="chat-question" className="visually-hidden">
                  {activeCopy.placeholder}
                </label>
                <textarea
                  id="chat-question"
                  ref={textareaRef}
                  value={question}
                  placeholder={activeCopy.placeholder}
                  aria-label={activeCopy.placeholder}
                  onChange={handleTextareaChange}
                  onKeyDown={handleTextareaKeyDown}
                  onBlur={handleTextareaBlur}
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
                  <article
                    key={`${message.role}-${index}`}
                    className={`message ${message.role}`}
                    aria-label={message.role === 'user' ? 'You' : 'Assistant'}
                  >
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
                <label htmlFor="chat-question" className="visually-hidden">
                  {activeCopy.placeholder}
                </label>
                <textarea
                  id="chat-question"
                  ref={textareaRef}
                  value={question}
                  placeholder={activeCopy.placeholder}
                  aria-label={activeCopy.placeholder}
                  onChange={handleTextareaChange}
                  onKeyDown={handleTextareaKeyDown}
                  onBlur={handleTextareaBlur}
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
