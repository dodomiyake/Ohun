import type { createMessagingClient } from '@ohun/api-client';

type Client = ReturnType<typeof createMessagingClient>;

// History is fetched on an active device. Only messages actually received by
// that device are acknowledged, and reading remains a separate operation.
export async function deliverConversation(client: Client, token: string, id: string, userId: string, active: () => boolean) {
 let beforeSequence: number | undefined;
 do {
  if (!active()) return;
  const page = await client.history(token, id, { limit: 50, ...(beforeSequence === undefined ? {} : { beforeSequence }) });
  if (!active()) return;
  const ids = page.messages.filter(message => message.senderId !== userId && (!message.deliveryStatus || message.deliveryStatus === 'sent')).map(message => message.id);
  if (ids.length && active()) await client.acknowledge(token, id, { messageIds: ids, state: 'delivered' });
  beforeSequence = page.nextBefore ?? undefined;
 } while (beforeSequence !== undefined);
}
