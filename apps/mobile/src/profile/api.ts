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

export async function downloadAvatar(accessToken: string, signal?: AbortSignal) {
  if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to Ohun.');
  const { File, Paths } = await import('expo-file-system');
  const { fetch: imageFetch } = await import('expo/fetch');
  let response: Response;
  try { response = await imageFetch(`${apiBaseUrl}/api/v1/profile/avatar`, { headers: { Authorization: `Bearer ${accessToken}` }, signal }); }
  catch { throw new ApiError('photo_download_failed', 'Your profile was saved, but the photo could not be downloaded. Check the connection to Ohun and reopen your profile.'); }
  if (response.status === 404) throw new ApiError('photo_missing', 'The server no longer has this photo. Upload it again; restarting the development API clears photos.', 404);
  if (response.status === 401) throw new ApiError('session_expired', 'Sign in again to load your profile photo.', 401);
  if (!response.ok) throw new ApiError('photo_download_failed', `The server could not load your photo (HTTP ${response.status}).`, response.status);
  if (!response.headers.get('content-type')?.startsWith('image/webp')) throw new ApiError('photo_response_invalid', 'The server returned an unexpected photo format.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new ApiError('photo_response_invalid', 'The saved photo has an invalid size.');
  const file = new File(Paths.cache, `ohun-avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`);
  const dispose = () => { try { if (file.exists) file.delete(); } catch { /* Cache is also managed by the OS. */ } };
  try { file.write(bytes); } catch { dispose(); throw new ApiError('photo_cache_failed', 'The photo downloaded, but could not be opened on this device.'); }
  return { uri: file.uri, dispose };
}

export const nativeProfileApi = {
  async read(accessToken: string) { return parse(await request('/api/v1/profile', accessToken)); },
  async update(accessToken: string, input: ProfileUpdateRequest) {
    const body = profileUpdateRequestSchema.parse(input);
    return parse(await request('/api/v1/profile', accessToken, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  },
  async uploadAvatar(accessToken: string, asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
    if (!apiBaseUrl) throw new ApiError('configuration_error', 'The app is not configured to connect to Ohun.');
    const { File } = await import('expo-file-system');
    const { fetch: uploadFetch } = await import('expo/fetch');
    const file = new File(asset.uri);
    if (!file.exists || file.size === 0) throw new ApiError('photo_unavailable', 'This photo could not be read. Choose a photo saved on your device.');
    if (file.size > 5 * 1024 * 1024) throw new ApiError('photo_too_large', 'Choose a photo smaller than 5 MB.');
    const mimeType = file.type || asset.mimeType;
    if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new ApiError('photo_format', 'Choose a JPEG, PNG, or WebP photo.');
    const form = new FormData();
    form.append('avatar', file);
    let response: Response;
    try {
      response = await uploadFetch(`${apiBaseUrl}/api/v1/profile/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    } catch {
      throw new ApiError('upload_failed', 'The photo could not be sent. Try a smaller photo saved on this device, and check that Ohun can reach the server.');
    }
    return parse(response);
  },
};
