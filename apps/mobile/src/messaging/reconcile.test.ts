import { it,expect } from 'vitest';
import { mergeMessages,reconcileOutgoing,type PendingMessage } from './reconcile.js';
const message=(sequence:number,id=String(sequence),clientMessageId='00000000-0000-4000-8000-000000000001')=>({id,conversationId:'000000000000000000000001',senderId:'000000000000000000000002',clientMessageId,body:`m${sequence}`,sequence,createdAt:'2026-10-25T00:00:00.000Z'});
it('deduplicates incoming HTTP and socket messages and sorts by sequence',()=>{
 expect(mergeMessages([message(2),message(1)],[message(2),message(3)])).toEqual([message(1),message(2),message(3)]);
});
it('settles a pending send by client id without duplicating a socket-first result',()=>{
 const pending:PendingMessage[]=[{clientMessageId:'00000000-0000-4000-8000-000000000001',senderId:message(1).senderId,body:'m1',state:'sending'}];
 expect(reconcileOutgoing(pending,[message(1)])).toEqual([]);
});
it('does not settle another sender outgoing record on matching UUID',()=>{
 const pending:PendingMessage[]=[{clientMessageId:'00000000-0000-4000-8000-000000000001',senderId:'000000000000000000000003',body:'m1',state:'failed'}];
 expect(reconcileOutgoing(pending,[message(1)])).toEqual(pending);
});
