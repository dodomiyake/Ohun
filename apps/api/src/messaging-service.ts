import mongoose, { type ClientSession } from 'mongoose';
import { z } from 'zod';
import { personIdSchema, historyQuerySchema, sendMessageRequestSchema, messageSchema, type Message, type Conversation, type ConversationPage, type MessagePage, type HistoryQuery, type SendMessageRequest } from '@ohun/contracts';
import { AuthError } from './auth-service.js';
import { User, Profile } from './models.js';
import { Connection, PersonBlock } from './people-models.js';
import { personPairKey } from './people-policy.js';
import { lockRelationshipParticipants } from './relationship-locks.js';
import { DirectConversation, DirectMessage, type StoredConversation } from './messaging-models.js';
const unavailable = () => new AuthError(404, 'conversation_unavailable', 'This conversation is unavailable.');
const cursorSchema = z.object({ time: z.string().datetime(), id: personIdSchema }).strict();
type ChatRecord = mongoose.HydratedDocument<StoredConversation>;
function serializeMessage(record: { _id?: unknown; conversationId: unknown; senderId: unknown; clientMessageId: string; body: string; sequence: number; createdAt: Date }): Message {
  return messageSchema.parse({ id: String(record._id), conversationId: String(record.conversationId), senderId: String(record.senderId), clientMessageId: record.clientMessageId, body: record.body, sequence: record.sequence, createdAt: record.createdAt.toISOString() });
}
async function allowed(pairKey: string, session?: ClientSession) {
  return Boolean(await Connection.findOne({ pairKey }).session(session ?? null)) && !await PersonBlock.findOne({ pairKey }).session(session ?? null);
}
async function membership(actor: string, id: string, session?: ClientSession) {
  personIdSchema.parse(actor); personIdSchema.parse(id);
  const chat = await DirectConversation.findOne({ _id: id, participantIds: actor }).session(session ?? null);
  if (!chat) throw unavailable(); return chat;
}
async function serializeConversation(actor: string, chat: ChatRecord, session?: ClientSession): Promise<Conversation> {
  const other = chat.participantIds.map(String).find(id => id !== actor)!;
  const user = await User.findById(other).session(session ?? null);
  const profile = await Profile.findOne({ userId: other }).session(session ?? null);
  if (!user || !profile) throw unavailable();
  return { id: String(chat._id), person: { id: other, username: user.username, displayName: profile.displayName }, canSend: await allowed(chat.pairKey, session), lastMessage: chat.lastMessage ? serializeMessage(chat.lastMessage) : null };
}
export function createMessagingService(now = () => new Date()) {
  return {
    async openDirect(actor: string, contactId: string): Promise<Conversation> {
      personIdSchema.parse(actor); personIdSchema.parse(contactId); if (actor === contactId) throw unavailable();
      return mongoose.connection.transaction(async session => {
        await lockRelationshipParticipants([actor, contactId], session);
        const pairKey = personPairKey(actor, contactId);
        if (!await allowed(pairKey, session)) throw unavailable();
        let chat = await DirectConversation.findOne({ pairKey }).session(session);
        if (!chat) { const [created] = await DirectConversation.create([{ pairKey, participantIds: [actor, contactId].sort() }], { session }); chat = created!; }
        return serializeConversation(actor, chat, session);
      });
    },
    async list(actor: string, cursor?: string, limit = 50): Promise<ConversationPage> {
      personIdSchema.parse(actor); z.number().int().min(1).max(50).parse(limit);
      let after = {};
      if (cursor) {
        try { if (cursor.length > 256) throw new Error(); const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))); const time = new Date(parsed.time);
          after = { $or: [{ 'lastMessage.createdAt': { $lt: time } }, { 'lastMessage.createdAt': time, _id: { $lt: parsed.id } }] };
        } catch { throw new AuthError(400, 'invalid_request', 'The cursor is invalid.'); }
      }
      const chats = await DirectConversation.find({ participantIds: actor, lastMessage: { $ne: null }, ...after }).sort({ 'lastMessage.createdAt': -1, _id: -1 }).limit(limit + 1);
      const page = chats.slice(0, limit), last = page.at(-1);
      return { conversations: await Promise.all(page.map(chat => serializeConversation(actor, chat))), nextCursor: chats.length > limit && last?.lastMessage ? Buffer.from(JSON.stringify({ time: last.lastMessage.createdAt.toISOString(), id: String(last._id) })).toString('base64url') : null };
    },
    async history(actor: string, id: string, input: HistoryQuery): Promise<MessagePage> {
      const query = historyQuerySchema.parse(input);
      const chat = await membership(actor, id); const latestSequence = chat.nextSequence;
      const after = query.afterSequence !== undefined;
      const range = after ? { $gt: query.afterSequence!, $lte: latestSequence } : { $lt: query.beforeSequence ?? latestSequence + 1, $lte: latestSequence };
      const rows = await DirectMessage.find({ conversationId: id, sequence: range }).sort({ sequence: after ? 1 : -1 }).limit(query.limit + 1);
      const page = rows.slice(0, query.limit); if (!after) page.reverse();
      return { messages: page.map(serializeMessage), latestSequence, conversation: await serializeConversation(actor, chat), nextBefore: !after && rows.length > query.limit ? page[0]!.sequence : null, nextAfter: after && rows.length > query.limit ? page.at(-1)!.sequence : null };
    },
    async send(actor: string, id: string, input: SendMessageRequest): Promise<{ message: Message; participantIds: string[]; created: boolean }> {
      const request = sendMessageRequestSchema.parse(input);
      return mongoose.connection.transaction(async session => {
        const chat = await membership(actor, id, session); const participantIds = chat.participantIds.map(String);
        await lockRelationshipParticipants(participantIds, session);
        const existing = await DirectMessage.findOne({ conversationId: id, senderId: actor, clientMessageId: request.clientMessageId }).session(session);
        if (existing) { if (existing.body !== request.body) throw new AuthError(409, 'message_conflict', 'This message identifier has already been used.'); return { message: serializeMessage(existing), participantIds, created: false }; }
        if (!await allowed(chat.pairKey, session)) throw unavailable();
        const sequence = chat.nextSequence + 1;
        const [message] = await DirectMessage.create([{ conversationId: id, senderId: actor, ...request, sequence, createdAt: now() }], { session });
        chat.nextSequence = sequence;
        chat.lastMessage = {
          conversationId: message!.conversationId,
          senderId: message!.senderId,
          clientMessageId: message!.clientMessageId,
          body: message!.body,
          sequence: message!.sequence,
          createdAt: message!.createdAt,
        };
        await chat.save({ session });
        return { message: serializeMessage(message!), participantIds, created: true };
      });
    },
  };
}
export type MessagingService = ReturnType<typeof createMessagingService>;
