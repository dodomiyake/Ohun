import type { Message } from '@ohun/contracts';
export type PendingMessage={clientMessageId:string;senderId:string;body:string;state:'sending'|'failed'};
export function mergeMessages(current:Message[],incoming:Message[]):Message[]{
 const rank={sent:0,delivered:1,read:2} as const;
 const byId=new Map(current.map(item=>[item.id,item]));
 for(const item of incoming){const previous=byId.get(item.id);const oldStatus=previous?.deliveryStatus;const newStatus=item.deliveryStatus;if(oldStatus&&rank[oldStatus]>(newStatus?rank[newStatus]:-1))byId.set(item.id,{...item,deliveryStatus:oldStatus});else byId.set(item.id,item);}
 return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);
}
export function reconcileOutgoing(pending:PendingMessage[],saved:Message[]):PendingMessage[]{
 const savedKeys=new Set(saved.map(item=>`${item.senderId}:${item.clientMessageId}`));return pending.filter(item=>!savedKeys.has(`${item.senderId}:${item.clientMessageId}`));
}
