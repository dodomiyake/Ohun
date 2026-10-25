import { conversationSchema, conversationPageSchema, messagePageSchema, messageSchema, openDirectRequestSchema, sendMessageRequestSchema, historyQuerySchema, personIdSchema, type HistoryQuery, type SendMessageRequest } from '@ohun/contracts';
export class MessagingError extends Error {
  constructor(public code: string, message: string, public status?: number, public retryAfter?: number) { super(message); this.name = 'MessagingError'; }
}
export function createMessagingClient(options: { baseUrl: string; fetch?: typeof fetch }) {
  const base = options.baseUrl.replace(/\/$/, '');
  const fetcher = options.fetch ?? fetch;
  async function request(token: string, path: string, body?: unknown) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = async () => {
        const response = await fetcher(`${base}/api/v1/conversations${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const retry = Number(response.headers.get('Retry-After'));
          const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
          const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'request_failed';
          const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Please try again.';
          throw new MessagingError(code, message, response.status, retry > 0 ? retry : undefined);
        }
        return data as unknown;
      };
      return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new MessagingError('timeout', 'Ohun did not respond. Please try again.')); controller.abort(); }, 15_000); })]);
    } catch (error) { if (error instanceof MessagingError) throw error; throw new MessagingError('offline', 'Check your connection and try again.'); }
    finally { clearTimeout(timer); }
  }
  return {
    async openDirect(token: string, contactId: string) { return conversationSchema.parse(await request(token, '/direct', openDirectRequestSchema.parse({ contactId }))); },
    async list(token: string, cursor?: string) { return conversationPageSchema.parse(await request(token, cursor ? `?${new URLSearchParams({ cursor })}` : '')); },
    async history(token: string, id: string, query: Partial<HistoryQuery> = {}) {
      personIdSchema.parse(id);
      const parsed = historyQuerySchema.parse(query);
      const params = new URLSearchParams(Object.entries(parsed).map(([key, value]) => [key, String(value)] as [string, string]));
      return messagePageSchema.parse(await request(token, `/${id}/messages?${params}`));
    },
    async send(token: string, id: string, input: SendMessageRequest) { personIdSchema.parse(id); return messageSchema.parse(await request(token, `/${id}/messages`, sendMessageRequestSchema.parse(input))); },
  };
}
export type MessagingClient = ReturnType<typeof createMessagingClient>;
