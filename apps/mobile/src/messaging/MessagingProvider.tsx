import type { ConversationChanged } from '@ohun/contracts';
import { createSocketClient } from '@ohun/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { MessagingError } from '@ohun/api-client';
import { messagingApi } from './api';
import { deliverConversation } from './deliverySync';
const Context=createContext<{setOpenConversation:(id:string|null)=>void}|null>(null);
const base=process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/,'')??'';
export function MessagingProvider({children}:PropsWithChildren){
 const auth=useAuth();const queries=useQueryClient();const openId=useRef<string|null>(null);const previousUser=useRef<string|null>(null);const refreshFlight=useRef<Promise<void>|null>(null);
 const setOpenConversation=useCallback((id:string|null)=>{openId.current=id;},[]);
 useEffect(()=>{const userId=auth.status==='signedIn'?auth.user?.id??null:null;if(previousUser.current&&previousUser.current!==userId)void queries.removeQueries({queryKey:['messaging',previousUser.current]});previousUser.current=userId;},[auth.status,auth.user?.id,queries]);
 useEffect(()=>{
  if(auth.status!=='signedIn'||!auth.accessToken||!base)return;
  const token=auth.accessToken;const userId=auth.user!.id;const socket=createSocketClient({url:base,token});let disposed=false;
  const refreshAuth=()=>{if(!refreshFlight.current)refreshFlight.current=auth.restoreSession().then(()=>undefined).catch(()=>undefined).finally(()=>{refreshFlight.current=null;});return refreshFlight.current;};
  const active=()=>!disposed&&AppState.currentState==='active';
  const flights=new Map<string, Promise<void>>();const dirty=new Set<string>();
  const deliver=(id:string):Promise<void>=>{if(!active())return Promise.resolve();const existing=flights.get(id);if(existing){dirty.add(id);return existing;}const flight=(async()=>{do{dirty.delete(id);await deliverConversation(messagingApi,token,id,userId,active);}while(active()&&dirty.has(id));})().catch(error=>{if(isUnauthorized(error))void refreshAuth();}).finally(()=>{flights.delete(id);dirty.delete(id);});flights.set(id,flight);return flight;};
  const catchUp=async()=>{try{let cursor:string|undefined;do{if(!active())return;const page=await messagingApi.list(token,cursor);if(!active())return;for(const chat of page.conversations)await deliver(chat.id);cursor=page.nextCursor??undefined;}while(cursor);}catch(error){if(isUnauthorized(error))void refreshAuth();}};
  socket.on('conversation:changed',(raw:unknown)=>{if(disposed)return;const event=raw as ConversationChanged;if(typeof event?.conversationId!=='string'||!Number.isInteger(event.latestSequence))return;void queries.invalidateQueries({queryKey:['messaging',userId,'chats']});void queries.invalidateQueries({queryKey:['messaging',userId,'conversation',event.conversationId]});void deliver(event.conversationId);});
  socket.on('connect',()=>{if(active())void catchUp();});
  socket.on('connect_error',error=>{if(error.message==='Authentication required')void refreshAuth();});socket.connect();
  const refresh=async()=>{if(disposed)return;await queries.invalidateQueries({queryKey:['messaging',userId,'chats']});const id=openId.current;if(id)await queries.invalidateQueries({queryKey:['messaging',userId,'conversation',id]});};
  const timer=setInterval(()=>{if(active())void refresh();},15_000);const sub=AppState.addEventListener('change',state=>{if(state==='active'){void refresh();void catchUp();}});
  return()=>{disposed=true;clearInterval(timer);sub.remove();socket.removeAllListeners();socket.disconnect();};
 },[auth.status,auth.accessToken,auth.user?.id,auth.restoreSession,auth.signOutLocal,queries]);
 const value=useMemo(()=>({setOpenConversation}),[setOpenConversation]);return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMessagingLifecycle(){const value=useContext(Context);if(!value)throw new Error('useMessagingLifecycle must be used within MessagingProvider');return value;}
export function isUnauthorized(error:unknown){return error instanceof MessagingError&&error.status===401;}
