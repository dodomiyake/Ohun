import { personIdSchema, type InvitationAction, type InvitationState } from '@ohun/contracts';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Same canonical key for either direction; also rejects a self invitation. */
export function personPairKey(first: string, second: string): string {
  const ids = [personIdSchema.parse(first), personIdSchema.parse(second)].sort();
  if (ids[0] === ids[1]) throw new Error('A connection requires two different people.');
  return ids.join(':');
}

type Invitation = { senderId: string; recipientId: string; state: InvitationState; expiresAt: Date };
type Decision = { allowed: true; state: InvitationState } | { allowed: false };

/** Repository callers must enforce this decision in the atomic update filter too. */
export function invitationTransition(invitation: Invitation, actorId: string, action: InvitationAction, now: Date): Decision {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(invitation.expiresAt.getTime()) || invitation.expiresAt <= now) return { allowed: false };
  if (action === 'cancel' && actorId === invitation.senderId && ['pending', 'ignored'].includes(invitation.state)) return { allowed: true, state: 'cancelled' };
  if (invitation.state !== 'pending' || actorId !== invitation.recipientId) return { allowed: false };
  if (action === 'accept') return { allowed: true, state: 'accepted' };
  if (action === 'ignore') return { allowed: true, state: 'ignored' };
  return { allowed: false };
}
