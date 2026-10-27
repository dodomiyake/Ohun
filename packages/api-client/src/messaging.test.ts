import { afterEach, expect, it, vi } from 'vitest';
import * as transport from './index.js';
const id='000000000000000000000001', uuid='00000000-0000-4000-8000-000000000001';
const message={id,conversationId:id,senderId:id,clientMessageId:uuid,body:'hello',sequence:1,createdAt:'2026-10-25T00:00:00.000Z'};
const conversation={id,person:{id,username:'alice',displayName:'Alice'},canSend:true,lastMessage:null};
afterEach(()=>vi.useRealTimers());
it('exposes a messaging transport',()=>expect(transport).toHaveProperty('createMessagingClient'));
it('sends bearer identity and retains idempotency key',async()=>{
 const calls: {url:string;init:RequestInit}[]=[];
 const client=transport.createMessagingClient({baseUrl:'https://example.test/',fetch:async(input,init)=>{calls.push({url:String(input),init:init!});return new Response(JSON.stringify(message));}});
 expect(await client.send('token',id,{clientMessageId:uuid,body:'hello'})).toEqual(message);
 expect(calls[0].url).toBe(`https://example.test/api/v1/conversations/${id}/messages`);
 expect(calls[0].init.headers).toMatchObject({Authorization:'Bearer token'});
 expect(JSON.parse(calls[0].init.body as string)).toEqual({clientMessageId:uuid,body:'hello'});
});
it('encodes list cursors and validates responses',async()=>{
 let url='';
 const client=transport.createMessagingClient({baseUrl:'https://example.test',fetch:async input=>{url=String(input);return new Response(JSON.stringify({conversations:[],nextCursor:null}));}});
 await client.list('token','a+b/=');expect(new URL(url).searchParams.get('cursor')).toBe('a+b/=');
 await expect(client.openDirect('token',id)).rejects.toThrow();
});
it('opens direct conversations and reads bounded history',async()=>{
 const calls:string[]=[];
 const client=transport.createMessagingClient({baseUrl:'https://example.test',fetch:async input=>{calls.push(String(input));return new Response(JSON.stringify(String(input).endsWith('/direct')?conversation:{conversation,messages:[],nextBefore:null,nextAfter:null,latestSequence:0}));}});
 expect(await client.openDirect('token',id)).toEqual(conversation);
 expect((await client.history('token',id,{afterSequence:0,limit:50})).messages).toEqual([]);
 expect(new URL(calls[1]).searchParams.get('afterSequence')).toBe('0');
});
it('sends a recipient receipt using authenticated bounded input',async()=>{
 let url='';let options:RequestInit|undefined;
 const client=transport.createMessagingClient({baseUrl:'https://example.test',fetch:async(input,init)=>{url=String(input);options=init;return new Response(JSON.stringify({ok:true}));}});
 await client.acknowledge('token',id,{messageIds:[id],state:'read'});
 expect(url).toBe(`https://example.test/api/v1/conversations/${id}/receipts`);
 expect(options?.headers).toMatchObject({Authorization:'Bearer token'});
 expect(JSON.parse(options!.body as string)).toEqual({messageIds:[id],state:'read'});
 await expect(client.acknowledge('token',id,{messageIds:[],state:'read'})).rejects.toThrow();
});
it.each([401,429])('retains HTTP error status %s and retry guidance',async status=>{
 const client=transport.createMessagingClient({baseUrl:'https://example.test',fetch:async()=>new Response(JSON.stringify({error:{code:'denied',message:'Try again'}}),{status,headers:{'Retry-After':'60'}})});
 await expect(client.list('token')).rejects.toMatchObject({status,code:'denied',retryAfter:60});
});
it('times out after 15000ms even if fetch ignores abort',async()=>{
 vi.useFakeTimers();let signal:AbortSignal|null|undefined;
 const client=transport.createMessagingClient({baseUrl:'https://example.test',fetch:async(_input,init)=>{signal=init?.signal;return new Promise(()=>{});}});
 const promise=client.list('token');const assertion=expect(promise).rejects.toMatchObject({code:'timeout'});
 await vi.advanceTimersByTimeAsync(15000);await assertion;expect(signal?.aborted).toBe(true);
});
