import mongoose from 'mongoose';
import { RefreshToken, Session } from './models.js';
import { isExpired } from './security.js';

export class RefreshReplayError extends Error {}
export class InvalidSessionError extends Error {}

export interface RotationInput {
  tokenHash: string;
  successorHash: string;
  successorExpiresAt: Date;
  now?: Date;
  lastUsedThrottleMs: number;
  idleLifetimeMs: number;
}

/** Atomically consumes one refresh record and creates exactly one successor. */
export async function rotateRefreshToken(input: RotationInput): Promise<{ sessionId: string; userId: string; refreshTokenId: string }> {
  const now = input.now ?? new Date();
  let result: { sessionId: string; userId: string; refreshTokenId: string } | undefined;
  try {
    await mongoose.connection.transaction(async (transaction) => {
    const current = await RefreshToken.findOne({ tokenHash: input.tokenHash }).session(transaction);
    if (!current) throw new InvalidSessionError('Unknown refresh credential');
    if (current.usedAt) throw new RefreshReplayError('Refresh credential was already consumed');
    if (current.revokedAt || isExpired(current.expiresAt, now)) throw new InvalidSessionError('Refresh credential is invalid');

    const session = await Session.findById(current.sessionId).session(transaction);
    if (!session || session.revokedAt || isExpired(session.absoluteExpiresAt, now) || isExpired(session.idleExpiresAt, now)) throw new InvalidSessionError('Session is invalid');

    const consumed = await RefreshToken.updateOne({ _id: current._id, usedAt: null, revokedAt: null }, { $set: { usedAt: now } }, { session: transaction });
    if (consumed.modifiedCount !== 1) throw new RefreshReplayError('Concurrent refresh consumption detected');

    const [successor] = await RefreshToken.create([{ sessionId: current.sessionId, userId: current.userId, familyId: current.familyId, tokenHash: input.successorHash, parentTokenId: current._id, expiresAt: input.successorExpiresAt }], { session: transaction });
    if (!successor) throw new Error('Successor creation failed');

    if (now.getTime() - session.lastUsedAt.getTime() >= input.lastUsedThrottleMs) {
      const proposedIdle = new Date(now.getTime() + input.idleLifetimeMs);
      session.lastUsedAt = now;
      session.idleExpiresAt = proposedIdle < session.absoluteExpiresAt ? proposedIdle : session.absoluteExpiresAt;
      await session.save({ session: transaction });
    }
    result = { sessionId: String(current.sessionId), userId: String(current.userId), refreshTokenId: String(successor._id) };
    });
  } catch (error) {
    if (error instanceof RefreshReplayError) {
      const replayed = await RefreshToken.findOne({ tokenHash: input.tokenHash }).select('familyId');
      if (replayed) await revokeRefreshFamily(replayed.familyId, 'refresh_reuse_detected', now);
    }
    throw error;
  }
  if (!result) throw new Error('Refresh transaction produced no result');
  return result;
}

export async function revokeSession(sessionId: string, reason: string, now = new Date()) {
  await mongoose.connection.transaction(async (transaction) => {
    const session = await Session.findById(sessionId).session(transaction);
    if (!session) return;
    await Session.updateOne({ _id: session._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
    await RefreshToken.updateMany({ sessionId: session._id, revokedAt: null }, { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
  });
}

export async function revokeRefreshFamily(familyId: string, reason: string, now = new Date()) {
  await mongoose.connection.transaction(async (transaction) => {
    await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
    await Session.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now, revokeReason: reason } }, { session: transaction });
  });
}
