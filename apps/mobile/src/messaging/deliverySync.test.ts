import { describe, expect, it, vi } from 'vitest';
import { deliverConversation } from './deliverySync';

describe('foreground delivery', () => {
 it('acknowledges incoming undelivered messages without marking them read', async () => {
  const history = vi.fn().mockResolvedValue({ messages: [
   { id: 'incoming', senderId: 'other', deliveryStatus: 'sent' },
   { id: 'mine', senderId: 'me', deliveryStatus: 'sent' },
   { id: 'done', senderId: 'other', deliveryStatus: 'read' },
  ], nextBefore: null });
  const acknowledge = vi.fn().mockResolvedValue(undefined);
  await deliverConversation({ history, acknowledge } as never, 'token', 'conversation', 'me', () => true);
  expect(acknowledge).toHaveBeenCalledWith('token', 'conversation', { messageIds: ['incoming'], state: 'delivered' });
 });
 it('does not acknowledge if the app goes to the background while loading', async () => {
  const history = vi.fn().mockResolvedValue({ messages: [{ id: 'incoming', senderId: 'other', deliveryStatus: 'sent' }], nextBefore: null });
  const acknowledge = vi.fn();
  const active = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
  await deliverConversation({ history, acknowledge } as never, 'token', 'conversation', 'me', active);
  expect(acknowledge).not.toHaveBeenCalled();
 });
 it('acknowledges earlier pages of incoming messages on reconnect', async () => {
  const history = vi.fn().mockResolvedValueOnce({ messages: [{ id: 'new', senderId: 'other', deliveryStatus: 'sent' }], nextBefore: 20 }).mockResolvedValueOnce({ messages: [{ id: 'old', senderId: 'other', deliveryStatus: 'sent' }], nextBefore: null });
  const acknowledge = vi.fn().mockResolvedValue(undefined);
  await deliverConversation({ history, acknowledge } as never, 'token', 'conversation', 'me', () => true);
  expect(acknowledge.mock.calls.map(call => call[2].messageIds)).toEqual([['new'], ['old']]);
  expect(history.mock.calls[1]?.[2]).toEqual({ limit: 50, beforeSequence: 20 });
 });
});
