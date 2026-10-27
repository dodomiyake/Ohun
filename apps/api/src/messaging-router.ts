import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { historyQuerySchema, openDirectRequestSchema, personIdSchema, receiptRequestSchema, sendMessageRequestSchema } from '@ohun/contracts';
import { AuthError, type AuthService } from './auth-service.js';
import { createRateLimiter } from './rate-limit.js';
import { createMessagingService, type MessagingService } from './messaging-service.js';
import type { ConversationChanged } from '@ohun/contracts';
const pagination = (value: unknown) => historyQuerySchema.parse(value);
const listQuery = z.object({ cursor: z.string().max(256).optional(), limit: z.coerce.number().int().min(1).max(50).default(50) }).strict();
export type PublishConversationChange = (participantIds:string[],event:ConversationChanged)=>Promise<void>;
export function createMessagingRouter(auth:AuthService,service:MessagingService=createMessagingService(),publish:PublishConversationChange=async()=>{}) {
 const router=Router();const identities=new WeakMap<Request,string>();
 const route=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{void handler(req,res).catch(next);};
 router.use(createRateLimiter(240,60_000,req=>req.ip??'unknown'));
 router.use((req,res,next)=>{
  res.setHeader('Cache-Control','private, no-store');const header=req.header('authorization');
  if(!header?.startsWith('Bearer ')){next(new AuthError(401,'authentication_required','Authentication is required.'));return;}
  void auth.authenticate(header.slice(7)).then(identity=>{identities.set(req,identity.userId);next();},()=>next(new AuthError(401,'session_invalid','Authentication is required.')));
 });
 const actor=(req:Request)=>identities.get(req)!;router.use(createRateLimiter(120,60_000,actor));
 router.post('/direct',route(async(req,res)=>{const {contactId}=openDirectRequestSchema.parse(req.body);res.status(200).json(await service.openDirect(actor(req),contactId));}));
 router.get('/',route(async(req,res)=>{const query=listQuery.parse(req.query);res.json(await service.list(actor(req),query.cursor,query.limit));}));
 router.get('/:id/messages',route(async(req,res)=>{personIdSchema.parse(req.params.id);const query=pagination(req.query);res.json(await service.history(actor(req),req.params.id!,query));}));
 router.post('/:id/receipts',createRateLimiter(60,60_000,actor),route(async(req,res)=>{
  personIdSchema.parse(req.params.id);const input=receiptRequestSchema.parse(req.body);const result=await service.acknowledge(actor(req),req.params.id!,input);
  if(result.changed)try{await publish(result.participantIds,{conversationId:req.params.id!,latestSequence:result.latestSequence});}catch{console.error('[api] messaging notification failed');}
  res.json({ok:true});
 }));
 router.post('/:id/messages',createRateLimiter(60,60_000,actor),route(async(req,res)=>{
  personIdSchema.parse(req.params.id);const input=sendMessageRequestSchema.parse(req.body);const result=await service.send(actor(req),req.params.id!,input);
  try{await publish(result.participantIds,{conversationId:result.message.conversationId,latestSequence:result.message.sequence});}catch{console.error('[api] messaging notification failed');}
  res.status(result.created?201:200).json(result.message);
 }));
 return router;
}
