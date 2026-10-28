import mongoose, { type InferSchemaType, type Model } from 'mongoose';
const { Schema, model, models } = mongoose;
const oid = { type: Schema.Types.ObjectId, required: true } as const;
const messageSchema = new Schema({
  conversationId: oid, senderId: oid, clientMessageId: { type: String, required: true },
  body: { type: String, required: true }, sequence: { type: Number, required: true }, createdAt: { type: Date, required: true },
  deliveredAt: { type: Date, default: null }, readAt: { type: Date, default: null },
}, { strict: 'throw' });
messageSchema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ conversationId: 1, sequence: 1 }, { unique: true });
const previewSchema = messageSchema.clone();
previewSchema.clearIndexes();
const conversationSchema = new Schema({
  pairKey: { type: String, required: true, unique: true },
  participantIds: { type: [Schema.Types.ObjectId], required: true, validate: (ids: mongoose.Types.ObjectId[]) => ids.length === 2 && String(ids[0]) !== String(ids[1]) },
  nextSequence: { type: Number, required: true, default: 0 }, lastMessage: { type: previewSchema, default: null },
}, { timestamps: true, strict: 'throw' });
conversationSchema.index({ participantIds: 1, 'lastMessage.createdAt': -1, _id: -1 });
export type StoredConversation = InferSchemaType<typeof conversationSchema>;
type StoredMessage = InferSchemaType<typeof messageSchema>;
export const DirectConversation: Model<StoredConversation> = (models.DirectConversation as Model<StoredConversation> | undefined) ?? model<StoredConversation>('DirectConversation', conversationSchema);
export const DirectMessage: Model<StoredMessage> = (models.DirectMessage as Model<StoredMessage> | undefined) ?? model<StoredMessage>('DirectMessage', messageSchema);
