import { z } from 'zod';

const seconds = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const provider = z.enum(['memory', 'none']).default('memory');

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEV_INBOX_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DEV_INBOX_SECRET: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().default(''),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().default(''),
  JWT_ISSUER: z.string().min(1).default('ohun-api'),
  JWT_AUDIENCE: z.string().min(1).default('ohun-clients'),
  TOKEN_HMAC_MASTER: z.string().default(''),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  ACCESS_TOKEN_TTL_SECONDS: seconds(900),
  SESSION_NATIVE_ABSOLUTE_SECONDS: seconds(30 * 86_400),
  SESSION_NATIVE_IDLE_SECONDS: seconds(7 * 86_400),
  EMAIL_VERIFICATION_LINK_TTL_SECONDS: seconds(86_400),
  EMAIL_VERIFICATION_CODE_TTL_SECONDS: seconds(600),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: seconds(5),
  EMAIL_VERIFICATION_LOCK_SECONDS: seconds(1_800),
  PASSWORD_RESET_TTL_SECONDS: seconds(3_600),
  SESSION_LAST_USED_THROTTLE_SECONDS: seconds(300),
  EMAIL_PROVIDER: provider,
  AVATAR_STORAGE_PROVIDER: provider,
  PASSWORD_BLOCKLIST_PROVIDER: provider,
}).superRefine((env, ctx) => {
  for (const name of ['JWT_ACCESS_SECRET', 'TOKEN_HMAC_MASTER'] as const) {
    if (env.NODE_ENV !== 'test' && Buffer.byteLength(env[name], 'utf8') < 32) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: 'must contain at least 32 bytes' });
    }
  }
  if (env.NODE_ENV === 'production' && !env.MONGO_URI) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGO_URI'], message: 'is required in production' });
  if (env.NODE_ENV === 'production' && (env.EMAIL_PROVIDER === 'memory' || env.AVATAR_STORAGE_PROVIDER === 'memory')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_PROVIDER'], message: 'memory providers are forbidden in production' });
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export const webEnvSchema = z.object({ VITE_API_BASE_URL: z.string().url(), VITE_SOCKET_URL: z.string().url() });
export type WebEnv = z.infer<typeof webEnvSchema>;
