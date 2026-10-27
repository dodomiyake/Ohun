import type { Message } from '@ohun/contracts';
export type PendingMessage={clientMessageId:string;senderId:string;body:string;state:'sending'|'failed'};
export function mergeMessages(current:Message[],incoming:Message[]):Message[]{
 const byId=new Map(current.map(item=>[item.id,item]));for(const item of incoming)byId.set(item.id,item);return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);
}
export function reconcileOutgoing(pending:PendingMessage[],saved:Message[]):PendingMessage[]{
 const savedKeys=new Set(saved.map(item=>`${item.senderId}:${item.clientMessageId}`));return pending.filter(item=>!savedKeys.has(`${item.senderId}:${item.clientMessageId}`));
}
