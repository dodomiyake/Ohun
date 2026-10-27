import { describe, it, expect } from 'vitest';
import * as contracts from './index.js';
const uuid = '00000000-0000-4000-8000-000000000001';
const id = '000000000000000000000001';
describe('messaging contracts', () => {
  it('exports validated messaging requests', () => { expect(contracts).toHaveProperty('sendMessageRequestSchema'); });
  it('counts Unicode code points and preserves meaningful whitespace', () => {
    const schema = contracts.sendMessageRequestSchema;
    expect(schema.safeParse({ clientMessageId: uuid, body: '😀'.repeat(4000) }).success).toBe(true);
    expect(schema.safeParse({ clientMessageId: uuid, body: '😀'.repeat(4001) }).success).toBe(false);
    expect(schema.parse({ clientMessageId: uuid, body: ' a\n b ' }).body).toBe(' a\n b ');
    expect(schema.safeParse({ clientMessageId: uuid, body: 'é'.repeat(2001) }).success).toBe(false);
  });
  it.each(['', ' \n\t', 'x'.repeat(4001)])('rejects invalid body', body => {
    expect(contracts.sendMessageRequestSchema.safeParse({ clientMessageId: uuid, body }).success).toBe(false);
  });
  it('rejects identity injection and invalid UUIDs', () => {
    expect(contracts.sendMessageRequestSchema.safeParse({ clientMessageId: uuid, body: 'hi', senderId: id }).success).toBe(false);
    expect(contracts.sendMessageRequestSchema.safeParse({ clientMessageId: 'bad', body: 'hi' }).success).toBe(false);
    expect(contracts.openDirectRequestSchema.safeParse({ contactId: 'bad' }).success).toBe(false);
  });
  it('bounds history and makes cursors exclusive', () => {
    expect(contracts.historyQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(contracts.historyQuerySchema.parse({ afterSequence: '0', limit: '1' })).toEqual({ afterSequence: 0, limit: 1 });
    for (const query of [{ beforeSequence: 0 }, { afterSequence: -1 }, { beforeSequence: 1.5 }, { limit: 51 }, { limit: 0 }, { beforeSequence: 2, afterSequence: 1 }, { extra: true }]) {
      expect(contracts.historyQuerySchema.safeParse(query).success).toBe(false);
    }
  });
  it('rejects message bodies in socket invalidations', () => {
    expect(contracts.conversationChangedSchema.parse({ conversationId: id, latestSequence: 1 })).toEqual({ conversationId: id, latestSequence: 1 });
    expect(contracts.conversationChangedSchema.safeParse({ conversationId: id, latestSequence: 1, body: 'private' }).success).toBe(false);
  });
  it('validates bounded recipient receipt acknowledgements', () => {
    expect(contracts).toHaveProperty('receiptRequestSchema');
    const schema = contracts.receiptRequestSchema;
    expect(schema.safeParse({ messageIds: [id], state: 'delivered' }).success).toBe(true);
    expect(schema.safeParse({ messageIds: [id], state: 'read' }).success).toBe(true);
    for (const bad of [{ messageIds: [], state: 'read' }, { messageIds: Array(51).fill(id), state: 'read' }, { messageIds: ['bad'], state: 'read' }, { messageIds: [id], state: 'sent' }, { messageIds: [id], state: 'read', userId: id }]) expect(schema.safeParse(bad).success).toBe(false);
  });
});
