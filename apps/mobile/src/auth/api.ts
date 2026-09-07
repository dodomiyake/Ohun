import {
  authResponseSchema,
  okResponseSchema,
  verificationRequiredResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@ohun/contracts';

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) { super(message); }
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

async function post(path: string, body: unknown) {
  if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to Ohun.');
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('offline', 'Check your internet connection and try again.');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'request_failed';
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'The request could not be completed.';
    throw new ApiError(code, message, response.status);
  }
  return payload;
}

export const nativeAuthApi = {
  async register(input: RegisterRequest) { return verificationRequiredResponseSchema.parse(await post('/api/v1/auth/register', input)); },
  async verifyCode(email: string, code: string) { return okResponseSchema.parse(await post('/api/v1/auth/verification/code', { email, code })); },
  async verifyLink(token: string) { return okResponseSchema.parse(await post('/api/v1/auth/verification/link', { token })); },
  async resendVerification(email: string) { return okResponseSchema.parse(await post('/api/v1/auth/verification/resend', { email })); },
  async login(input: LoginRequest) { return authResponseSchema.parse(await post('/api/v1/auth/login', input)); },
};
