import { useInfiniteQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { isUnauthorized,useMessagingLifecycle } from './MessagingProvider';
import { messagingApi } from './api';
import { mergeMessages,reconcileOutgoing,type PendingMessage } from './reconcile';
import { useAuth } from '../auth/AuthProvider';
import type { Message } from '@ohun/contracts';
function uuid(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});}
export function useConversation(id:string){
 const auth=useAuth();const queries=useQueryClient();const {setOpenConversation}=useMessagingLifecycle();const [pending,setPending]=useState<PendingMessage[]>([]);const token=auth.accessToken!;const userId=auth.user!.id;
 const key=['messaging',userId,'conversation',id] as const;
 const query=useInfiniteQuery({queryKey:key,enabled:Boolean(token&&id),initialPageParam:undefined as number|undefined,queryFn:({pageParam})=>messagingApi.history(token,id,pageParam===undefined?{limit:50}:{beforeSequence:pageParam,limit:50}),getNextPageParam:page=>page.nextBefore??undefined,retry:false});
 const messages=useMemo(()=>mergeMessages([],query.data?.pages.flatMap(page=>page.messages)??[]),[query.data]);
 useEffect(()=>{setOpenConversation(id);return()=>setOpenConversation(null);},[id,setOpenConversation]);
 useEffect(()=>{setPending(current=>reconcileOutgoing(current,messages));},[messages]);
 const send=useCallback(async(body:string)=>{
  if(!body.trim()||[...body].length>4000)throw new Error('Messages must contain 1–4000 characters.');
  const clientMessageId=uuid();const local:PendingMessage={clientMessageId,senderId:userId,body,state:'sending'};setPending(current=>[...current,local]);
  try{const saved=await messagingApi.send(token,id,{clientMessageId,body});queries.setQueryData(key,(data:typeof query.data|undefined)=>data?{...data,pages:data.pages.map((page,index)=>index===0?{...page,messages:mergeMessages(page.messages,[saved]),conversation:{...page.conversation,lastMessage:saved}}:page)}:data);setPending(current=>reconcileOutgoing(current,[saved]));void queries.invalidateQueries({queryKey:['messaging',userId,'chats']});}
  catch(error){setPending(current=>current.map(item=>item.clientMessageId===clientMessageId?{...item,state:'failed'}:item));if(isUnauthorized(error))void auth.restoreSession().catch(()=>undefined);throw error;}
 },[auth.restoreSession,id,key,queries,query.data,token,userId]);
 const retry=useCallback(async(clientMessageId:string)=>{const item=pending.find(value=>value.clientMessageId===clientMessageId);if(!item)throw new Error('This message can no longer be retried.');setPending(current=>current.map(value=>value.clientMessageId===clientMessageId?{...value,state:'sending'}:value));try{const saved=await messagingApi.send(token,id,{clientMessageId:item.clientMessageId,body:item.body});queries.setQueryData(key,(data:typeof query.data|undefined)=>data?{...data,pages:data.pages.map((page,index)=>index===0?{...page,messages:mergeMessages(page.messages,[saved]),conversation:{...page.conversation,lastMessage:saved}}:page)}:data);setPending(current=>reconcileOutgoing(current,[saved]));void queries.invalidateQueries({queryKey:['messaging',userId,'chats']});}catch(error){setPending(current=>current.map(value=>value.clientMessageId===clientMessageId?{...value,state:'failed'}:value));if(isUnauthorized(error))void auth.restoreSession().catch(()=>undefined);throw error;}},[auth.restoreSession,id,key,pending,queries,query.data,token,userId]);
 return {conversation:query.data?.pages[0]?.conversation,messages,pending,loading:query.isPending,error:query.error,loadOlder:()=>query.fetchNextPage(),hasOlder:query.hasNextPage,send,retry,refresh:()=>query.refetch()};
}
export type ConversationMessage=Message;
