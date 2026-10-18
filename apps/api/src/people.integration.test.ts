import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { User, Profile } from './models.js';
import { Connection, DiscoveryPreferences, Invitation, PersonBlock } from './people-models.js';
import { createPeopleService } from './people-service.js';
let replica: MongoMemoryReplSet | undefined;
const service = createPeopleService();
let a: string, b: string, c: string;
beforeAll(async () => {
  if (process.env.MONGO_TEST_URI) await mongoose.connect(process.env.MONGO_TEST_URI);
  else { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); }
}, 60_000);
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Profile, Connection, DiscoveryPreferences, Invitation, PersonBlock].map(model => model.syncIndexes()));
  const ids = [];
  for (const name of ['alice', 'bobby', 'carol']) {
    const user = await User.create({ username: name, usernameNormalized: name, email: `${name}@example.test`, emailNormalized: `${name}@example.test`, passwordHash: 'test-only', emailVerifiedAt: new Date() });
    const id = String(user._id); ids.push(id);
    await Profile.create({ userId: id, displayName: name });
  }
  [a, b, c] = ids as [string, string, string];
}, 30_000);
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });
async function invite() { await service.setPreferences(b, { byUsername: true }); await service.invite(a, { recipientId: b }); return String((await Invitation.findOne())!._id); }
describe('private people transactions', () => {
  it('defaults to private and exposes only minimal opted-in identity', async () => {
    expect((await service.search(a, { username: 'bobby' })).people).toEqual([]);
    await service.setPreferences(b, { byUsername: true });
    expect((await service.search(a, { username: 'BOBBY' })).people).toEqual([{ id: b, username: 'bobby', displayName: 'bobby' }]);
    await service.setPreferences(b, { byUsername: false });
    await service.invite(a, { recipientId: b });
    expect(await Invitation.countDocuments()).toBe(0);
  });
  it('denies third-party and sender acceptance', async () => {
    const id = await invite();
    for (const actor of [a, c]) await expect(service.action(actor, id, { action: 'accept' })).rejects.toMatchObject({ status: 404 });
    await service.action(b, id, { action: 'accept' });
    expect(await Connection.countDocuments()).toBe(1);
    expect((await service.list(c, 'people')).people).toEqual([]);
    expect((await service.list(a, 'people')).people).toHaveLength(1);
  });
  it('issues only one crossed invitation', async () => {
    await service.setPreferences(a, { byUsername: true }); await service.setPreferences(b, { byUsername: true });
    await Promise.all([service.invite(a, { recipientId: b }), service.invite(b, { recipientId: a })]);
    expect(await Invitation.countDocuments()).toBe(1);
  });
  it('has one winner for concurrent acceptance', async () => {
    const id = await invite();
    const results = await Promise.allSettled([service.action(b, id, { action: 'accept' }), service.action(b, id, { action: 'accept' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await Connection.countDocuments()).toBe(1);
  });
  it('rolls acceptance back if connection creation fails', async () => {
    const id = await invite();
    const spy = vi.spyOn(Connection, 'create').mockRejectedValueOnce(new Error('injected failure'));
    try { await expect(service.action(b, id, { action: 'accept' })).rejects.toThrow('injected failure'); } finally { spy.mockRestore(); }
    expect((await Invitation.findById(id))?.state).toBe('pending');
    expect(await Connection.countDocuments()).toBe(0);
  });
  it('does not expose ignored state or permit repeated invitations', async () => {
    const id = await invite(); await service.action(b, id, { action: 'ignore' });
    expect((await service.list(a, 'invitations')).invitations?.[0]).toMatchObject({ state: 'pending' });
    await service.invite(a, { recipientId: b });
    expect((await Invitation.findById(id))?.state).toBe('ignored');
    await service.action(a, id, { action: 'cancel' });
    await service.invite(a, { recipientId: b });
    expect((await service.list(b, 'invitations')).invitations).toHaveLength(0);
    expect(await Invitation.countDocuments()).toBe(1);
  });
  it('allows a fresh request after the sender cancels, including reversed direction', async () => {
    const oldId = await invite();
    await service.action(a, oldId, { action: 'cancel' });
    await service.invite(a, { recipientId: b });
    const sent = (await service.list(a, 'invitations')).invitations!;
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ direction: 'outgoing', state: 'pending' });
    expect(sent[0].id).not.toBe(oldId);
    await expect(service.action(b, oldId, { action: 'accept' })).rejects.toMatchObject({ status: 404 });
    await service.action(a, sent[0].id, { action: 'cancel' });
    await service.setPreferences(a, { byUsername: true });
    await service.invite(b, { recipientId: a });
    const incoming = (await service.list(a, 'invitations')).invitations!;
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ direction: 'incoming', state: 'pending' });
    await service.action(a, incoming[0].id, { action: 'accept' });
    expect((await service.list(a, 'people')).people).toHaveLength(1);
  });
  it('enforces expiry without deleting the record', async () => {
    const id = await invite(); await Invitation.updateOne({ _id: id }, { $set: { expiresAt: new Date(0) } });
    await expect(service.action(b, id, { action: 'accept' })).rejects.toMatchObject({ status: 404 });
    expect(await Invitation.countDocuments()).toBe(1);
  });
  it('serializes block against acceptance and removes any resulting connection', async () => {
    const id = await invite();
    await Promise.allSettled([service.action(b, id, { action: 'accept' }), service.block(a, b)]);
    expect(await PersonBlock.countDocuments()).toBe(1);
    expect(await Connection.countDocuments()).toBe(0);
    expect((await service.search(a, { username: 'bobby' })).people).toEqual([]);
    expect((await service.search(b, { username: 'alice' })).people).toEqual([]);
    expect((await service.list(b, 'invitations')).invitations).toEqual([]);
  });
});
