import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { ProfileUpdateRequest } from '@ohun/contracts';
import { Profile, SecurityEvent, User } from './models.js';
import type { AvatarStorageProvider } from './providers.js';
import { AuthError } from './auth-service.js';
import { normalizeAvatar } from './avatar-image.js';

type Identity = { userId: string; sessionId: string };

const normalizeUsername = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US');
const publicUser = (user: { _id: unknown; email: string; username: string; emailVerifiedAt?: Date | null }) => ({ id: String(user._id), email: user.email, username: user.username, emailVerified: Boolean(user.emailVerifiedAt) });

export function createProfileService(storage: AvatarStorageProvider) {
  async function read(userId: string) {
    const [user, profile] = await Promise.all([User.findById(userId), Profile.findOne({ userId })]);
    if (!user) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
    return { user: publicUser(user), profile: profile ? { displayName: profile.displayName, bio: profile.bio, status: profile.status, ...(profile.avatarKey ? { avatarKey: profile.avatarKey } : {}) } : null };
  }

  async function update(identity: Identity, input: ProfileUpdateRequest) {
    const usernameNormalized = input.username ? normalizeUsername(input.username) : undefined;
    let usernameChanged = false;
    try {
      await mongoose.connection.transaction(async (transaction) => {
        const user = await User.findById(identity.userId).session(transaction);
        if (!user) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
        if (input.username && usernameNormalized !== user.usernameNormalized) {
          if (await User.exists({ _id: { $ne: user._id }, usernameNormalized }).session(transaction)) throw new AuthError(409, 'username_unavailable', 'That username is unavailable.');
          user.username = input.username.normalize('NFKC');
          user.usernameNormalized = usernameNormalized!;
          await user.save({ session: transaction });
          usernameChanged = true;
        }
        await Profile.findOneAndUpdate(
          { userId: user._id },
          { $set: { displayName: input.displayName.trim(), bio: input.bio, status: input.status }, $setOnInsert: { userId: user._id } },
          { new: true, upsert: true, runValidators: true, session: transaction },
        );
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (typeof error === 'object' && error && 'code' in error && error.code === 11000) throw new AuthError(409, 'username_unavailable', 'That username is unavailable.');
      throw error;
    }
    if (usernameChanged) await recordEvent(identity, 'username_changed');
    return read(identity.userId);
  }

  async function uploadAvatar(identity: Identity, input: Buffer) {
    const profile = await Profile.findOne({ userId: identity.userId });
    if (!profile) throw new AuthError(409, 'profile_required', 'Create your profile before adding an avatar.');
    const bytes = await normalizeAvatar(input);
    const key = `avatars/${identity.userId}/${randomUUID()}.webp`;
    await storage.put(key, bytes, 'image/webp');
    const previousKey = profile.avatarKey;
    try { profile.avatarKey = key; await profile.save(); }
    catch (error) { await storage.delete(key).catch(() => undefined); throw error; }
    if (previousKey && previousKey !== key) await storage.delete(previousKey).catch(() => console.error('[api] previous avatar cleanup failed'));
    return read(identity.userId);
  }

  async function recordEvent(identity: Identity, type: string) {
    try { await SecurityEvent.create({ userId: identity.userId, type, metadata: { sessionId: identity.sessionId, reason: type } }); }
    catch { console.error(`[api] security event persistence failed: ${type}`); }
  }

  return { read, update, uploadAvatar };
}

export type ProfileService = ReturnType<typeof createProfileService>;
