import { describe, expect, it } from 'vitest';
import { invitationSchema, invitationActionSchema, invitationRequestSchema, publicPersonSchema, usernameSearchSchema } from './people.js';
const id = '507f1f77bcf86cd799439011';
describe('people contracts', () => {
  it('does not expose ignored state to the sender', () => {
    expect(invitationSchema.safeParse({ id, person: { id, username: 'friend', displayName: 'Friend' }, direction: 'outgoing', state: 'ignored', createdAt: '2026-09-13T00:00:00Z', expiresAt: '2026-09-20T00:00:00Z' }).success).toBe(false);
  });
  it('rejects client supplied sender identity', () => { expect(invitationRequestSchema.safeParse({ recipientId: id, senderId: id }).success).toBe(false); });
  it('rejects private fields in public person responses', () => { expect(publicPersonSchema.safeParse({ id, username: 'friend', displayName: 'Friend', email: 'private@example.test' }).success).toBe(false); });
  it('accepts Unicode usernames without accepting regex queries', () => {
    expect(usernameSearchSchema.parse({ username: '  ystävä  ' }).username).toBe('ystävä');
    expect(usernameSearchSchema.safeParse({ username: '.*' }).success).toBe(false);
    expect(usernameSearchSchema.safeParse({ username: { $ne: '' } }).success).toBe(false);
  });
  it('limits actions to recipient acceptance/ignore or sender cancellation', () => {
    for (const action of ['accept', 'ignore', 'cancel']) expect(invitationActionSchema.safeParse({ action }).success).toBe(true);
    expect(invitationActionSchema.safeParse({ action: 'message' }).success).toBe(false);
  });
});
