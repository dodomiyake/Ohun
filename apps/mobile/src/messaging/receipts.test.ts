import { expect, it } from 'vitest';
import { receiptCandidates } from './receipts.js';
import type { Message } from '@ohun/contracts';
const incoming: Message = { id:'000000000000000000000001', conversationId:'000000000000000000000002', senderId:'000000000000000000000003', clientMessageId:'00000000-0000-4000-8000-000000000001', body:'hello', sequence:1, createdAt:'2026-10-25T00:00:00.000Z', deliveryStatus:'sent' };
const mine: Message = { ...incoming, id:'000000000000000000000004', senderId:'me' };
it('acknowledges received messages only while active and never acknowledges own messages',()=>{
 expect(receiptCandidates([incoming,mine],'me','delivered',true,true,new Set())).toEqual([incoming.id]);
 expect(receiptCandidates([incoming,mine],'me','delivered',false,true,new Set())).toEqual([]);
});
it('marks read only for visible incoming messages in the active conversation',()=>{
 const visible=new Set([incoming.id,mine.id]);
 expect(receiptCandidates([incoming,mine],'me','read',true,true,visible)).toEqual([incoming.id]);
 expect(receiptCandidates([incoming,mine],'me','read',true,false,visible)).toEqual([]);
 expect(receiptCandidates([incoming,mine],'me','read',true,true,new Set())).toEqual([]);
 expect(receiptCandidates([{...incoming,deliveryStatus:'read'}],'me','read',true,true,visible)).toEqual([]);
});
