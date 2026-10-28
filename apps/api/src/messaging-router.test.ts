import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import { AuthError, type AuthService } from './auth-service.js';
import { createMessagingRouter } from './messaging-router.js';
import type { MessagingService } from './messaging-service.js';
const id='000000000000000000000001', other='000000000000000000000002';
const input={clientMessageId:'00000000-0000-4000-8000-000000000001',body:'hello'};
const message={id,conversationId:id,senderId:id,...input,sequence:1,createdAt:'2026-10-25T00:00:00.000Z'};
function setup() {
 const auth={authenticate:vi.fn(async(token:string)=>{if(token!=='valid')throw new Error();return {userId:id,sessionId:id};})} as unknown as AuthService;
 const service={openDirect:vi.fn(),list:vi.fn(async()=>({conversations:[],nextCursor:null})),history:vi.fn(),send:vi.fn(async()=>({message,participantIds:[id,other],created:true})),acknowledge:vi.fn(async()=>({participantIds:[id,other],latestSequence:1,changed:true}))} as unknown as MessagingService;
 const publish=vi.fn(async()=>{});const app=express();app.use(express.json());app.use('/api/v1/conversations',createMessagingRouter(auth,service,publish));
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(error instanceof AuthError?error.status:error instanceof ZodError?400:500).json({error:{code:error instanceof AuthError?error.code:'invalid_request'}});});
 return {app,service,publish};
}
describe('messaging HTTP boundary',()=>{
 it('authenticates and publishes recipient receipt updates',async()=>{
  const {app,service,publish}=setup();const body={messageIds:[other],state:'read'};
  expect((await request(app).post(`/api/v1/conversations/${id}/receipts`).send(body)).status).toBe(401);
  const response=await request(app).post(`/api/v1/conversations/${id}/receipts`).set('Authorization','Bearer valid').send(body);
  expect(response.status).toBe(200);expect(response.body).toEqual({ok:true});
  expect(service.acknowledge).toHaveBeenCalledWith(id,id,body);
  expect(publish).toHaveBeenCalledWith([id,other],{conversationId:id,latestSequence:1});
  expect((await request(app).post(`/api/v1/conversations/${id}/receipts`).set('Authorization','Bearer valid').send({...body,userId:other})).status).toBe(400);
 });
 it('requires credentials for all reads and writes',async()=>{
  const {app}=setup();for(const path of ['',`/${id}/messages`])expect((await request(app).get(`/api/v1/conversations${path}`)).status).toBe(401);
  for(const path of ['/direct',`/${id}/messages`])expect((await request(app).post(`/api/v1/conversations${path}`).send(input)).status).toBe(401);
 });
 it('uses server identity and publishes only saved messages',async()=>{
  const {app,service,publish}=setup();const response=await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input);
  expect(response.status).toBe(201);expect(response.body).toEqual(message);expect(service.send).toHaveBeenCalledWith(id,id,input);
  expect(publish).toHaveBeenCalledWith([id,other],{conversationId:id,latestSequence:1});expect(response.headers['cache-control']).toBe('private, no-store');
 });
 it('rejects identity injection and invalid cursors before service',async()=>{
  const {app,service}=setup();expect((await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send({...input,senderId:other})).status).toBe(400);
  expect((await request(app).get(`/api/v1/conversations/${id}/messages?beforeSequence=1&afterSequence=0`).set('Authorization','Bearer valid')).status).toBe(400);
  expect((await request(app).get('/api/v1/conversations?limit=51').set('Authorization','Bearer valid')).status).toBe(400);
  expect(service.send).not.toHaveBeenCalled();expect(service.history).not.toHaveBeenCalled();
 });
 it.each([404,409])('preserves service status %s without publishing',async status=>{
  const {app,service,publish}=setup();vi.mocked(service.send).mockRejectedValueOnce(new AuthError(status,'denied','Unavailable'));
  expect((await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input)).status).toBe(status);expect(publish).not.toHaveBeenCalled();
 });
 it('keeps a successful saved response when publication fails',async()=>{
  const {app,publish}=setup();publish.mockRejectedValueOnce(new Error('transport down'));
  expect((await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input)).body).toEqual(message);
 });
 it('returns 200 for a recovered duplicate',async()=>{
  const {app,service}=setup();vi.mocked(service.send).mockResolvedValueOnce({message,participantIds:[id,other],created:false});
  expect((await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input)).status).toBe(200);
 });
 it('limits new send attempts with retry guidance',async()=>{
  const {app}=setup();for(let i=0;i<60;i++)expect((await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input)).status).toBe(201);
  const result=await request(app).post(`/api/v1/conversations/${id}/messages`).set('Authorization','Bearer valid').send(input);expect(result.status).toBe(429);expect(Number(result.headers['retry-after'])).toBeGreaterThan(0);
 });
 it('limits reads and opens together',async()=>{
  const {app}=setup();for(let i=0;i<120;i++)expect((await request(app).get('/api/v1/conversations').set('Authorization','Bearer valid')).status).toBe(200);
  expect((await request(app).post('/api/v1/conversations/direct').set('Authorization','Bearer valid').send({contactId:other})).status).toBe(429);
 });
 it('limits unauthenticated requests per IP',async()=>{
  const {app}=setup();for(let i=0;i<240;i++)await request(app).get('/api/v1/conversations');
  expect((await request(app).get('/api/v1/conversations')).status).toBe(429);
 });
});
