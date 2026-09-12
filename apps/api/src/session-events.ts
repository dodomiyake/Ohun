import { randomUUID } from 'node:crypto';
import { sessionEventSchema } from './session-event-schema.js';
import { SecurityEvent } from './models.js';

export async function recordSessionEvent(userId: string, type: string, metadata: unknown) {
  const event = sessionEventSchema.parse({ type, metadata });
  try { await SecurityEvent.create({ userId, ...event }); }
  catch { console.error(JSON.stringify({ event: 'security_event_persistence_failed', type: event.type, requestCorrelationId: randomUUID(), alert: true })); }
}
