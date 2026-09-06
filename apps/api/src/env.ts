import { apiEnvSchema, type ApiEnv } from '@ohun/contracts';

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
