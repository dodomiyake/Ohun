import { z } from 'zod';

export const sessionIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
export const activeSessionSchema = z.object({
  id: sessionIdSchema,
  deviceName: z.string().min(1).max(80),
  platform: z.enum(['native', 'web']),
  current: z.boolean(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
}).strict();
export const activeSessionsResponseSchema = z.object({ sessions: z.array(activeSessionSchema) }).strict();
export const revokeSessionsResponseSchema = z.object({ ok: z.literal(true), revokedCount: z.number().int().nonnegative() }).strict();
export type ActiveSession = z.infer<typeof activeSessionSchema>;
