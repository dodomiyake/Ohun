import { activeSessionsResponseSchema, revokeSessionsResponseSchema, sessionIdSchema } from '@ohun/contracts';
import { ApiError } from '../auth/api';

async function request(token: string, path: string, method: string, signal?: AbortSignal) {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (!base) throw new ApiError('configuration_error', 'The app is not configured to connect to Ohun.');
  let response: Response;
  try { response = await fetch(`${base}/api/v1/sessions${path}`, { method, signal, headers: { Authorization: `Bearer ${token}` } }); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('offline', 'Check your internet connection and try again.');
  }
  if (!response.ok) throw new ApiError(response.status === 401 ? 'session_invalid' : 'request_failed', response.status === 401 ? 'Your session has expired. Sign in again.' : 'Devices could not be updated. Try again.', response.status);
  return response.json();
}
export const nativeSessionsApi = {
  async list(token: string, signal?: AbortSignal) { return activeSessionsResponseSchema.parse(await request(token, '', 'GET', signal)); },
  async revoke(token: string, id: string) { return revokeSessionsResponseSchema.parse(await request(token, `/${sessionIdSchema.parse(id)}`, 'DELETE')); },
  async revokeOthers(token: string) { return revokeSessionsResponseSchema.parse(await request(token, '/revoke-others', 'POST')); },
};
