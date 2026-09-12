import { z } from 'zod';
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const sessionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('device_revoked'), metadata: z.object({ sessionId: objectId, targetSessionId: objectId, revokedCount: z.number().int().positive() }).strict() }).strict(),
  z.object({ type: z.literal('other_devices_revoked'), metadata: z.object({ sessionId: objectId, revokedCount: z.number().int().positive() }).strict() }).strict(),
]);
