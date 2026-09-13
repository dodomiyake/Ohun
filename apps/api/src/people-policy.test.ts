import { describe, expect, it } from 'vitest';
import { invitationTransition, personPairKey } from './people-policy.js';
import { Connection, DiscoveryPreferences, Invitation } from './people-models.js';
const senderId = '507f1f77bcf86cd799439011';
const recipientId = '507f1f77bcf86cd799439012';
const strangerId = '507f1f77bcf86cd799439013';
const now = new Date('2026-09-13T00:00:00Z');
const pending = { senderId, recipientId, state: 'pending' as const, expiresAt: new Date(now.getTime() + 1000) };
describe('private invitation rules', () => {
  it('uses one pair for both directions and rejects self invitations', () => {
    expect(personPairKey(senderId, recipientId)).toBe(personPairKey(recipientId, senderId));
    expect(() => personPairKey(senderId, senderId)).toThrow();
  });
  it('allows only the recipient to accept or ignore', () => {
    for (const action of ['accept', 'ignore'] as const) {
      expect(invitationTransition(pending, recipientId, action, now).allowed).toBe(true);
      expect(invitationTransition(pending, senderId, action, now).allowed).toBe(false);
      expect(invitationTransition(pending, strangerId, action, now).allowed).toBe(false);
    }
  });
  it('allows only the sender to cancel', () => {
    expect(invitationTransition(pending, senderId, 'cancel', now)).toEqual({ allowed: true, state: 'cancelled' });
    expect(invitationTransition(pending, recipientId, 'cancel', now).allowed).toBe(false);
    expect(invitationTransition(pending, strangerId, 'cancel', now).allowed).toBe(false);
  });
  it('rejects expiry at the exact deadline even while the record exists', () => {
    expect(invitationTransition({ ...pending, expiresAt: now }, recipientId, 'accept', now).allowed).toBe(false);
    expect(invitationTransition({ ...pending, expiresAt: new Date(NaN) }, recipientId, 'accept', now).allowed).toBe(false);
  });
  it('cannot reopen resolved invitations', () => {
    for (const state of ['accepted', 'ignored', 'cancelled'] as const) expect(invitationTransition({ ...pending, state }, recipientId, 'accept', now).allowed).toBe(false);
  });
  it('defaults discovery to off', () => { expect(new DiscoveryPreferences({ userId: senderId }).byUsername).toBe(false); });
  it('indexes both directions and prevents duplicate pairs', () => {
    for (const entity of [Invitation, Connection]) expect(entity.schema.indexes()).toEqual(expect.arrayContaining([[{ pairKey: 1 }, expect.objectContaining({ unique: true })]]));
    expect(Invitation.schema.indexes().some(([, options]) => 'expireAfterSeconds' in options)).toBe(false);
  });
  it('rejects malformed participant pairs at validation', async () => {
    await expect(new Invitation({ ...pending, pairKey: 'wrong' }).validate()).rejects.toThrow('Invalid participant pair');
    await expect(new Connection({ firstUserId: senderId, secondUserId: senderId, pairKey: `${senderId}:${senderId}` }).validate()).rejects.toThrow('Invalid participant pair');
    await expect(new Invitation({ ...pending, pairKey: personPairKey(senderId, recipientId) }).validate()).resolves.toBeUndefined();
  });
});
