import { it,expect,vi } from 'vitest';
import { createMessagingPublisher } from './messaging-events.js';
import type { AuthService } from './auth-service.js';
const one='000000000000000000000001',two='000000000000000000000002',three='000000000000000000000003';
function socket(userId:string,token:string){return {data:{identity:{userId}},handshake:{auth:{token},headers:{}},emit:vi.fn(),disconnect:vi.fn()};}
it('revalidates sessions and notifies only conversation participants across devices',async()=>{
 const a=socket(one,'a'),a2=socket(one,'a2'),b=socket(two,'b'),outsider=socket(three,'c');
 const sockets=new Map([['a',a],['a2',a2],['b',b],['c',outsider]]);
 const io={sockets:{sockets}} as never;
 const auth={authenticate:vi.fn(async(token:string)=>{if(token==='c')throw new Error('revoked');return {userId:token.startsWith('a')?one:two,sessionId:token};})} as unknown as AuthService;
 const publish=createMessagingPublisher(io,auth);
 const event={conversationId:one,latestSequence:4};await publish([one,two],event);
 expect(a.emit).toHaveBeenCalledWith('conversation:changed',event);expect(a2.emit).toHaveBeenCalledWith('conversation:changed',event);expect(b.emit).toHaveBeenCalledWith('conversation:changed',event);
 expect(outsider.emit).not.toHaveBeenCalled();expect(auth.authenticate).toHaveBeenCalledTimes(3);
});
it('disconnects revoked and mismatched socket identities without emitting',async()=>{
 const revoked=socket(one,'revoked'),mismatch=socket(one,'wrong-user');const io={sockets:{sockets:new Map([['r',revoked],['m',mismatch]])}} as never;
 const auth={authenticate:vi.fn(async(token:string)=>{if(token==='revoked')throw new Error('expired');return {userId:three,sessionId:'m'};})} as unknown as AuthService;
 await createMessagingPublisher(io,auth)([one],{conversationId:one,latestSequence:1});
 expect(revoked.disconnect).toHaveBeenCalledWith(true);expect(mismatch.disconnect).toHaveBeenCalledWith(true);expect(revoked.emit).not.toHaveBeenCalled();expect(mismatch.emit).not.toHaveBeenCalled();
});
