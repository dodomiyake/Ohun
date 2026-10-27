import type { Server as SocketServer, Socket } from 'socket.io';
import { conversationChangedSchema, type ConversationChanged } from '@ohun/contracts';
import type { AuthService } from './auth-service.js';
import type { PublishConversationChange } from './messaging-router.js';
import { socketAccessToken } from './socket-auth.js';
export async function validateLiveSocketSessions(io:SocketServer,auth:AuthService):Promise<void>{
 await Promise.all([...io.sockets.sockets.values()].map(async(socket:Socket)=>{
  try{const token=socketAccessToken(socket);if(!token)throw new Error('missing token');const identity=await auth.authenticate(token);if(identity.userId!==socket.data.identity?.userId)throw new Error('identity changed');}
  catch{socket.disconnect(true);}
 }));
}
export function createMessagingPublisher(io:SocketServer,auth:AuthService):PublishConversationChange{
 return async(participantIds,event:ConversationChanged)=>{
  const payload=conversationChangedSchema.parse(event);const allowed=new Set(participantIds);
  await Promise.all([...io.sockets.sockets.values()].map(async(socket:Socket)=>{
   const userId=socket.data.identity?.userId as string|undefined;
   if(!userId||!allowed.has(userId))return;
   try{const token=socketAccessToken(socket);if(!token)throw new Error('missing token');const identity=await auth.authenticate(token);if(identity.userId!==userId)throw new Error('identity changed');socket.emit('conversation:changed',payload);}
   catch{socket.disconnect(true);}
  }));
 };
}
