import { profileResponseSchema, profileUpdateRequestSchema, type ProfileUpdateRequest } from '@ohun/contracts';
import { ApiError } from '../auth/api';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

async function parse(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'request_failed';
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'The request could not be completed.';
    throw new ApiError(code, message, response.status);
  }
  return profileResponseSchema.parse(payload);
}

async function request(path: string, accessToken: string, init?: RequestInit) {
  if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to Ohun.');
  try { return await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers } }); }
  catch { throw new ApiError('offline', 'Check your internet connection and try again.'); }
}

export const nativeProfileApi = {
  async read(accessToken: string) { return parse(await request('/api/v1/profile', accessToken)); },
  async update(accessToken: string, input: ProfileUpdateRequest) {
    const body = profileUpdateRequestSchema.parse(input);
    return parse(await request('/api/v1/profile', accessToken, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  },
  async uploadAvatar(accessToken: string, asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
    const form = new FormData();
    form.append('avatar', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'avatar.jpg' } as unknown as Blob);
    return parse(await request('/api/v1/profile/avatar', accessToken, { method: 'POST', body: form }));
  },
};
