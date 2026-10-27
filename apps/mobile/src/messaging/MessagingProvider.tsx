import type { ConversationChanged } from '@ohun/contracts';
import { createSocketClient } from '@ohun/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { MessagingError } from '@ohun/api-client';
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
  socket.on('conversation:changed',(raw:unknown)=>{if(disposed)return;const event=raw as ConversationChanged;if(typeof event?.conversationId!=='string'||!Number.isInteger(event.latestSequence))return;void queries.invalidateQueries({queryKey:['messaging',userId,'chats']});void queries.invalidateQueries({queryKey:['messaging',userId,'conversation',event.conversationId]});});
  socket.on('connect_error',error=>{if(error.message==='Authentication required')void refreshAuth();});socket.connect();
  const refresh=async()=>{if(disposed)return;await queries.invalidateQueries({queryKey:['messaging',userId,'chats']});const id=openId.current;if(id)await queries.invalidateQueries({queryKey:['messaging',userId,'conversation',id]});};
  const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},15_000);const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return()=>{disposed=true;clearInterval(timer);sub.remove();socket.removeAllListeners();socket.disconnect();};
 },[auth.status,auth.accessToken,auth.user?.id,auth.restoreSession,auth.signOutLocal,queries]);
 const value=useMemo(()=>({setOpenConversation}),[setOpenConversation]);return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMessagingLifecycle(){const value=useContext(Context);if(!value)throw new Error('useMessagingLifecycle must be used within MessagingProvider');return value;}
export function isUnauthorized(error:unknown){return error instanceof MessagingError&&error.status===401;}
