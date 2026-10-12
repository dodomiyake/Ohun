import mongoose, { type ClientSession } from 'mongoose';
import { discoveryPreferencesSchema, invitationActionSchema, invitationRequestSchema, personIdSchema, usernameSearchSchema, type PublicPerson } from '@ohun/contracts';
import { AuthError } from './auth-service.js';
import { User, Profile } from './models.js';
import { Connection, DiscoveryPreferences, Invitation, PersonBlock } from './people-models.js';
import { INVITATION_LIFETIME_MS, personPairKey } from './people-policy.js';
const unavailable = () => new AuthError(404, 'person_unavailable', 'This request is unavailable.');

export function createPeopleService(now = () => new Date()) {
  // Every privacy/relationship mutation writes participant locks in the same order.
  async function lock(ids: string[], session: ClientSession) {
    for (const id of [...new Set(ids)].sort()) {
      if (!(await User.updateOne({ _id: id, emailVerifiedAt: { $ne: null } }, { $inc: { __v: 1 } }, { session })).matchedCount) throw unavailable();
    }
  }
  async function blocked(pairKey: string, session?: ClientSession) { return Boolean(await PersonBlock.findOne({ pairKey }).session(session ?? null)); }
  async function person(id: string, session?: ClientSession): Promise<PublicPerson | null> {
    const user = await User.findOne({ _id: id, emailVerifiedAt: { $ne: null } }).session(session ?? null);
    const profile = await Profile.findOne({ userId: id }).session(session ?? null);
    return user && profile ? { id, username: user.username, displayName: profile.displayName } : null;
  }
  return {
    async preferences(actor: string) { return { byUsername: (await DiscoveryPreferences.findOne({ userId: actor }))?.byUsername ?? false }; },
    async setPreferences(actor: string, input: unknown) {
      const value = discoveryPreferencesSchema.parse(input);
      await mongoose.connection.transaction(async session => {
        await lock([actor], session);
        await DiscoveryPreferences.updateOne({ userId: actor }, { $set: value }, { session, upsert: true });
      });
      return value;
    },
    async search(actor: string, input: unknown) {
      const { username } = usernameSearchSchema.parse(input);
      const user = await User.findOne({ usernameNormalized: username.normalize('NFKC').toLowerCase(), emailVerifiedAt: { $ne: null }, _id: { $ne: actor } });
      if (!user) return { people: [], nextCursor: null };
      const id = String(user._id);
      if (!(await DiscoveryPreferences.exists({ userId: id, byUsername: true })) || await blocked(personPairKey(actor, id))) return { people: [], nextCursor: null };
      const result = await person(id);
      return { people: result ? [result] : [], nextCursor: null };
    },
    async invite(actor: string, input: unknown) {
      const { recipientId } = invitationRequestSchema.parse(input);
      if (actor === recipientId) return { ok: true };
      // Identical response for missing, private, blocked, duplicate and ignored recipients.
      try {
        await mongoose.connection.transaction(async session => {
          await lock([actor, recipientId], session);
          const pairKey = personPairKey(actor, recipientId);
          if (await blocked(pairKey, session) || !await person(actor, session) || !await person(recipientId, session) || !await DiscoveryPreferences.findOne({ userId: recipientId, byUsername: true }).session(session)) return;
          if (await Invitation.findOne({ pairKey }).session(session) || await Connection.findOne({ pairKey }).session(session)) return;
          await Invitation.create([{ pairKey, senderId: actor, recipientId, state: 'pending', expiresAt: new Date(now().getTime() + INVITATION_LIFETIME_MS) }], { session });
        });
      } catch (error) { if (!(error instanceof AuthError && error.status === 404)) throw error; }
      return { ok: true };
    },
    async action(actor: string, id: string, input: unknown) {
      personIdSchema.parse(id);
      const { action } = invitationActionSchema.parse(input);
      await mongoose.connection.transaction(async session => {
        const invitation = await Invitation.findOne({ _id: id, $or: [{ senderId: actor }, { recipientId: actor }] }).session(session);
        if (!invitation) throw unavailable();
        const sender = String(invitation.senderId), recipient = String(invitation.recipientId);
        await lock([sender, recipient], session);
        if (await blocked(invitation.pairKey, session)) throw unavailable();
        const timestamp = now();
        const state = action === 'accept' ? 'accepted' : action === 'ignore' ? 'ignored' : 'cancelled';
        // Ignore stays indistinguishable from pending for the sender, including cancellation.
        const result = await Invitation.updateOne({ _id: id, [action === 'cancel' ? 'senderId' : 'recipientId']: actor, state: action === 'cancel' ? { $in: ['pending', 'ignored'] } : 'pending', expiresAt: { $gt: timestamp } }, { $set: { state, resolvedAt: timestamp } }, { session });
        if (!result.modifiedCount) throw unavailable();
        if (action === 'accept') {
          const [firstUserId, secondUserId] = [sender, recipient].sort();
          await Connection.create([{ pairKey: invitation.pairKey, firstUserId, secondUserId }], { session });
        }
      });
      return { ok: true };
    },
    async list(actor: string, kind: 'people' | 'invitations', cursor?: string) {
      if (cursor) personIdSchema.parse(cursor);
      const after = cursor ? { _id: { $gt: cursor } } : {};
      const records = kind === 'people'
        ? await Connection.find({ ...after, $or: [{ firstUserId: actor }, { secondUserId: actor }] }).sort({ _id: 1 }).limit(51).lean()
        : await Invitation.find({ ...after, expiresAt: { $gt: now() }, $or: [{ recipientId: actor, state: 'pending' }, { senderId: actor, state: { $in: ['pending', 'ignored'] } }] }).sort({ _id: 1 }).limit(51).lean();
      const page = records.slice(0, 50);
      const entries = [];
      for (const record of page) {
        if (await blocked(record.pairKey)) continue;
        const first = 'senderId' in record ? String(record.senderId) : String(record.firstUserId);
        const second = 'recipientId' in record ? String(record.recipientId) : String(record.secondUserId);
        const other = await person(first === actor ? second : first);
        if (!other) continue;
        if ('state' in record) entries.push({ id: String(record._id), person: other, direction: first === actor ? 'outgoing' : 'incoming', state: 'pending', createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt.toISOString() });
        else entries.push(other);
      }
      return { [kind]: entries, nextCursor: records.length > 50 ? String(page.at(-1)!._id) : null };
    },
    async block(actor: string, target: string) {
      personIdSchema.parse(target);
      if (actor === target) throw unavailable();
      await mongoose.connection.transaction(async session => {
        await lock([actor, target], session);
        const pairKey = personPairKey(actor, target);
        await PersonBlock.updateOne({ blockerId: actor, blockedId: target }, { $setOnInsert: { pairKey } }, { upsert: true, session });
        await Connection.deleteOne({ pairKey }, { session });
        await Invitation.updateOne({ pairKey, state: { $in: ['pending', 'ignored'] } }, { $set: { state: 'cancelled', resolvedAt: now() } }, { session });
      });
      return { ok: true };
    },
  };
}
