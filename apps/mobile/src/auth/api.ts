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
  if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to the server.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: Response;
  let payload: unknown;
  try {
    const operation = async () => {
      const result = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data: unknown = await result.json().catch(() => null);
      return { response: result, payload: data };
    };
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ApiError('timeout', path.endsWith('/register') ? 'The app did not respond in time. Your account may have been created. Check email verification before trying again.' : 'The app did not respond in time. Check your connection and try again.'));
        controller.abort();
      }, 15_000);
    });
    ({ response, payload } = await Promise.race([operation(), timeout]));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('offline', 'Check your internet connection and try again.');
  } finally { clearTimeout(timer); }

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
  async refresh(refreshToken: string) { return authResponseSchema.parse(await post('/api/v1/auth/refresh', { refreshToken })); },
  async logout(refreshToken?: string, accessToken?: string) {
    if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to the server.');
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
    } catch { throw new ApiError('offline', 'You are signed out on this device. The server could not be reached.'); }
    if (!response.ok) throw new ApiError('request_failed', 'You are signed out on this device. The server session may still be active.', response.status);
    return okResponseSchema.parse(await response.json());
  },
  async requestPasswordReset(email: string) { return okResponseSchema.parse(await post('/api/v1/auth/password/reset/request', { email })); },
  async confirmPasswordReset(token: string, newPassword: string) { return okResponseSchema.parse(await post('/api/v1/auth/password/reset/confirm', { token, newPassword })); },
};
