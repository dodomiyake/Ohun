import {
  healthResponseSchema,
  type HealthResponse,
} from '@ohun/contracts';

export type CreateHttpClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export function createHttpClient(options: CreateHttpClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    async getHealth(): Promise<HealthResponse> {
      const response = await fetchImpl(`${baseUrl}/health`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const json: unknown = await response.json();
      return healthResponseSchema.parse(json);
    },
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
