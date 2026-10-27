import { discoveryPreferencesSchema, invitationsResponseSchema, peopleResponseSchema, okResponseSchema, type InvitationAction } from '@ohun/contracts';
import { ApiError } from '../auth/api';
const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
async function request(token: string, path: string, body?: unknown, method = 'POST') {
  if (!base) throw new ApiError('configuration_error', 'The API is not configured.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = async () => {
      const response = await fetch(`${base}/api/v1${path}`, { method: body === undefined ? 'GET' : method, signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const data = await response.json();
      if (!response.ok) throw new ApiError(data?.error?.code ?? 'request_failed', data?.error?.message ?? 'Please try again.', response.status);
      return data as unknown;
    };
    return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ApiError('timeout', 'The app did not respond. Please try again.')); }, 15000); })]);
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('offline', 'Check your connection and try again.'); }
  finally { clearTimeout(timer); }
}
export const peopleApi = {
  preferences: async (token: string) => discoveryPreferencesSchema.parse(await request(token, '/people/preferences')),
  setPreferences: async (token: string, byUsername: boolean) => discoveryPreferencesSchema.parse(await request(token, '/people/preferences', { byUsername }, 'PUT')),
  search: async (token: string, username: string) => peopleResponseSchema.parse(await request(token, '/people/search', { username })),
  contacts: async (token: string, cursor?: string) => peopleResponseSchema.parse(await request(token, `/people${cursor ? `?cursor=${cursor}` : ''}`)),
  invitations: async (token: string, cursor?: string) => invitationsResponseSchema.parse(await request(token, `/invitations${cursor ? `?cursor=${cursor}` : ''}`)),
  invite: async (token: string, recipientId: string) => okResponseSchema.parse(await request(token, '/invitations', { recipientId })),
  action: async (token: string, id: string, action: InvitationAction) => okResponseSchema.parse(await request(token, `/invitations/${id}/action`, { action })),
};
