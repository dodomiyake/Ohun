import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { User, Profile } from './models.js';
import { Connection, PersonBlock } from './people-models.js';
import { personPairKey } from './people-policy.js';
import { createPeopleService } from './people-service.js';
import { createMessagingService } from './messaging-service.js';
import { DirectConversation, DirectMessage } from './messaging-models.js';
let replica: MongoMemoryReplSet | undefined;
let a: string, b: string, c: string;
const service = createMessagingService(() => new Date('2026-10-25T00:00:00Z'));
beforeAll(async () => {
 if (process.env.MONGO_TEST_URI) await mongoose.connect(process.env.MONGO_TEST_URI);
 else { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); }
}, 120000);
beforeEach(async () => {
 await mongoose.connection.dropDatabase();
 await Promise.all([User, Profile, Connection, PersonBlock, DirectConversation, DirectMessage].map(model=>model.syncIndexes()));
 const ids:string[]=[];
 for (const name of ['alice','bobby','carol']) {
 const user=await User.create({username:name,usernameNormalized:name,email:`${name}@example.test`,emailNormalized:`${name}@example.test`,passwordHash:'test',emailVerifiedAt:new Date()});
 ids.push(String(user._id)); await Profile.create({userId:user._id,displayName:name});
 }
 [a,b,c]=ids as [string,string,string]; await connect(a,b);
},30000);
afterAll(async()=>{await mongoose.disconnect();await replica?.stop();});
async function connect(first:string,second:string) { const [firstUserId,secondUserId]=[first,second].sort();await Connection.create({pairKey:personPairKey(first,second),firstUserId,secondUserId}); }
const input=(body='Hello')=>({clientMessageId:randomUUID(),body});
describe('durable direct messaging',()=>{
 it('concurrent opens yield one private empty conversation',async()=>{
 const chats=await Promise.all([service.openDirect(a,b),service.openDirect(b,a)]);
 expect(new Set(chats.map(x=>x.id)).size).toBe(1);expect(await DirectConversation.countDocuments()).toBe(1);
 expect((await service.list(a)).conversations).toEqual([]);
 expect(chats[0].person).toEqual({id:b,username:'bobby',displayName:'bobby'});
 });
 it('denies noncontacts, self, third-party reads and sends',async()=>{
 for(const target of [a,c]) await expect(service.openDirect(a,target)).rejects.toMatchObject({status:404});
 const chat=await service.openDirect(a,b);
 await expect(service.history(c,chat.id,{limit:50})).rejects.toMatchObject({status:404});
 await expect(service.send(c,chat.id,input())).rejects.toMatchObject({status:404});
 expect((await service.list(c)).conversations).toEqual([]);
 });
 it('deduplicates concurrent retries and rejects changed content',async()=>{
 const chat=await service.openDirect(a,b), request=input();
 const results=await Promise.all([service.send(a,chat.id,request),service.send(a,chat.id,request)]);
 expect(results[0].message.id).toBe(results[1].message.id);expect(await DirectMessage.countDocuments()).toBe(1);
 await expect(service.send(a,chat.id,{...request,body:'changed'})).rejects.toMatchObject({status:409});
 });
 it('orders concurrent sends and atomically updates preview',async()=>{
 const chat=await service.openDirect(a,b);
 const results=await Promise.all([service.send(a,chat.id,input('one')),service.send(b,chat.id,input('two')),service.send(a,chat.id,input('three'))]);
 expect(results.map(x=>x.message.sequence).sort()).toEqual([1,2,3]);
 expect((await service.list(a)).conversations[0].lastMessage?.sequence).toBe(3);
 expect((await service.history(a,chat.id,{limit:50})).messages.map(x=>x.sequence)).toEqual([1,2,3]);
 });
 it('rolls back failed insertion and counter',async()=>{
 const chat=await service.openDirect(a,b);
 const spy=vi.spyOn(DirectMessage,'create').mockRejectedValueOnce(new Error('injected failure'));
 try{await expect(service.send(a,chat.id,input())).rejects.toThrow('injected failure');}finally{spy.mockRestore();}
 expect(await DirectMessage.countDocuments()).toBe(0);expect((await service.list(a)).conversations).toEqual([]);
 expect((await service.send(a,chat.id,input())).message.sequence).toBe(1);
 });
 it('retains history and recovers saved retry after block while denying new sends',async()=>{
 const chat=await service.openDirect(a,b),request=input();const sent=await service.send(a,chat.id,request);
 await createPeopleService().block(b,a);
 expect((await service.send(a,chat.id,request)).message.id).toBe(sent.message.id);
 await expect(service.send(a,chat.id,input())).rejects.toMatchObject({status:404});
 const history=await service.history(a,chat.id,{limit:50});expect(history.messages).toHaveLength(1);expect(history.conversation.canSend).toBe(false);
 await PersonBlock.deleteMany({});await connect(a,b);expect((await service.openDirect(a,b)).id).toBe(chat.id);
 });
 it('serializes concurrent block and send',async()=>{
 const chat=await service.openDirect(a,b);
 await Promise.allSettled([service.send(a,chat.id,input()),createPeopleService().block(b,a)]);
 await expect(service.send(a,chat.id,input())).rejects.toMatchObject({status:404});
 expect(await Connection.countDocuments()).toBe(0);
 expect(await DirectMessage.countDocuments()).toBeLessThanOrEqual(1);
 });
 it('pages 51 messages without skipping history or catch-up',async()=>{
 const chat=await service.openDirect(a,b);
 for(let i=1;i<=51;i++) await service.send(a,chat.id,input(`Message ${i}`));
 const page=await service.history(b,chat.id,{limit:50});expect(page.messages.map(x=>x.sequence)).toEqual(Array.from({length:50},(_,i)=>i+2));
 expect(page.nextBefore).toBe(2);expect(page.latestSequence).toBe(51);
 const older=await service.history(b,chat.id,{beforeSequence:2,limit:50});expect(older.messages.map(x=>x.sequence)).toEqual([1]);expect(older.nextBefore).toBeNull();
 const catchup=await service.history(b,chat.id,{afterSequence:0,limit:50});expect(catchup.nextAfter).toBe(50);
 expect((await service.history(b,chat.id,{afterSequence:50,limit:50})).messages.map(x=>x.sequence)).toEqual([51]);
 },30000);
 it('uses a stable tie-break for lists and never changes actor scope with a cursor',async()=>{
 await connect(a,c);const one=await service.openDirect(a,b),two=await service.openDirect(a,c);
 await service.send(a,one.id,input());await service.send(a,two.id,input());
 const first=await service.list(a,undefined,1);const second=await service.list(a,first.nextCursor!,1);
 expect(new Set([...first.conversations,...second.conversations].map(x=>x.id)).size).toBe(2);
 const other=await service.list(b,first.nextCursor!,1);expect(other.conversations.every(x=>x.id===one.id)).toBe(true);
 await expect(service.list(a,'invalid')).rejects.toMatchObject({status:400});
 });
});
