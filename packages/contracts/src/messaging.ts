import { z } from 'zod';
import { personIdSchema, publicPersonSchema } from './people.js';
const sequence = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const body = z.string().refine(value => value.trim().length > 0 && [...value].length <= 4000, 'Use 1–4000 characters.');
export const openDirectRequestSchema = z.object({ contactId: personIdSchema }).strict();
export const sendMessageRequestSchema = z.object({ clientMessageId: z.string().uuid(), body }).strict();
export const receiptRequestSchema = z.object({ messageIds: z.array(personIdSchema).min(1).max(50), state: z.enum(['delivered', 'read']) }).strict();
export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;
export const messageSchema = z.object({ id: personIdSchema, conversationId: personIdSchema, senderId: personIdSchema, clientMessageId: z.string().uuid(), body, sequence, createdAt: z.string().datetime() }).strict();
export const conversationSchema = z.object({ id: personIdSchema, person: publicPersonSchema, canSend: z.boolean(), lastMessage: messageSchema.nullable() }).strict();
export const conversationPageSchema = z.object({ conversations: z.array(conversationSchema).max(50), nextCursor: z.string().max(256).nullable() }).strict();
export const historyQuerySchema = z.object({
  beforeSequence: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  afterSequence: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
}).strict().refine(query => query.beforeSequence === undefined || query.afterSequence === undefined, 'Choose one cursor.');
export const messagePageSchema = z.object({ messages: z.array(messageSchema).max(50), nextBefore: sequence.nullable(), nextAfter: sequence.nullable(), latestSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), conversation: conversationSchema }).strict();
export const conversationChangedSchema = z.object({ conversationId: personIdSchema, latestSequence: sequence }).strict();
export type Message = z.infer<typeof messageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationPage = z.infer<typeof conversationPageSchema>;
export type MessagePage = z.infer<typeof messagePageSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
export type ConversationChanged = z.infer<typeof conversationChangedSchema>;
