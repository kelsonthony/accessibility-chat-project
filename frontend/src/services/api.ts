import type {
  AskQuestionInput,
  AskQuestionResponse,
  CaptchaChallenge,
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  PasswordResetRequestResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
  SignupInput,
  SignupStartInput,
  SignupStartResponse,
  TelemetryDataResponse,
  VerifySignupInput,
} from '@accessibility-platform/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function signup(input: SignupInput): Promise<AuthResponse> {
  return request<AuthResponse>('/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchCaptcha(): Promise<CaptchaChallenge> {
  return request<CaptchaChallenge>('/auth/captcha', {
    method: 'GET',
  });
}

export async function startSignup(input: SignupStartInput): Promise<SignupStartResponse> {
  return request<SignupStartResponse>('/signup/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifySignup(input: VerifySignupInput): Promise<AuthResponse> {
  return request<AuthResponse>('/signup/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<PasswordResetRequestResponse> {
  return request<PasswordResetRequestResponse>('/password/forgot', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
  return request<ResetPasswordResponse>('/password/reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function askQuestion(
  token: string,
  input: AskQuestionInput,
): Promise<AskQuestionResponse> {
  return request<AskQuestionResponse>('/ask', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function fetchTelemetry(token: string): Promise<TelemetryDataResponse> {
  return request<TelemetryDataResponse>('/data', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function syncSources(token: string) {
  return request<{ status: string; jobId: string; syncedSources: number }>('/sources/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function ingestSources(token: string) {
  return request<{ status: string; jobId: string; seededChunks: number; steps: string[] }>('/ingest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
