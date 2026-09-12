import mongoose from 'mongoose';
import { activeSessionsResponseSchema, sessionIdSchema } from '@ohun/contracts';
import { AuthError } from './auth-service.js';
import { RefreshToken, Session } from './models.js';
import { recordSessionEvent } from './session-events.js';

type Identity = { userId: string; sessionId: string };
export function createSessionService(getNow = () => new Date()) {
  const active = (now: Date) => ({ revokedAt: null, absoluteExpiresAt: { $gt: now }, idleExpiresAt: { $gt: now } });
  async function list(identity: Identity) {
    const sessions = await Session.find({ userId: identity.userId, ...active(getNow()) })
      .select('_id deviceName platform createdAt lastUsedAt').sort({ lastUsedAt: -1 }).lean();
    return activeSessionsResponseSchema.parse({ sessions: sessions.map((session) => ({
      id: String(session._id), deviceName: session.deviceName, platform: session.platform,
      current: String(session._id) === identity.sessionId,
      createdAt: session.createdAt.toISOString(), lastUsedAt: session.lastUsedAt.toISOString(),
    })).sort((a, b) => Number(b.current) - Number(a.current)) });
  }
  async function revoke(identity: Identity, targetId?: string) {
    if (targetId) sessionIdSchema.parse(targetId);
    const now = getNow();
    let revokedCount = 0;
    await mongoose.connection.transaction(async (transaction) => {
      // Write the caller session to serialize against concurrent revocation/refresh.
      const caller = await Session.updateOne({ _id: identity.sessionId, userId: identity.userId, ...active(now) },
        { $inc: { __v: 1 } }, { session: transaction });
      if (!caller.matchedCount) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
      if (targetId && !await Session.exists({ _id: targetId, userId: identity.userId }).session(transaction)) {
        throw new AuthError(404, 'session_not_found', 'The session was not found.');
      }
      const filter = { userId: identity.userId, _id: targetId ?? { $ne: identity.sessionId } };
      const reason = targetId ? 'device_revoked' : 'other_devices_revoked';
      const result = await Session.updateMany({ ...filter, revokedAt: null }, { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
      await RefreshToken.updateMany({ userId: identity.userId, sessionId: targetId ?? { $ne: identity.sessionId }, revokedAt: null },
        { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
      revokedCount = result.modifiedCount;
    });
    if (revokedCount) await recordSessionEvent(identity.userId, targetId ? 'device_revoked' : 'other_devices_revoked', {
      sessionId: identity.sessionId, ...(targetId ? { targetSessionId: targetId } : {}), revokedCount,
    });
    return { ok: true as const, revokedCount };
  }
  return { list, revoke };
}
