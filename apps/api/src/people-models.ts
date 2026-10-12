import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { personPairKey } from './people-policy.js';
const { Schema, model, models } = mongoose;
const userId = { type: Schema.Types.ObjectId, required: true } as const;
const preferencesSchema = new Schema({ userId: { ...userId, unique: true }, byUsername: { type: Boolean, default: false, required: true } }, { timestamps: true, strict: 'throw' });
const invitationSchema = new Schema({
  pairKey: { type: String, required: true, unique: true },
  senderId: userId,
  recipientId: userId,
  state: { type: String, enum: ['pending', 'accepted', 'ignored', 'cancelled'], default: 'pending', required: true },
  expiresAt: { type: Date, required: true },
  resolvedAt: Date,
}, { timestamps: true, strict: 'throw' });
// Keep ignored records to prevent repeat invitations. Expiry is checked by the service, not TTL.
invitationSchema.index({ recipientId: 1, state: 1, _id: 1 });
invitationSchema.index({ senderId: 1, state: 1, _id: 1 });
const connectionSchema = new Schema({ pairKey: { type: String, required: true, unique: true }, firstUserId: userId, secondUserId: userId }, { timestamps: true, strict: 'throw' });
connectionSchema.index({ firstUserId: 1, _id: 1 });
connectionSchema.index({ secondUserId: 1, _id: 1 });
for (const schema of [invitationSchema, connectionSchema]) {
  schema.pre('validate', function () {
    const first = this.get('senderId') ?? this.get('firstUserId');
    const second = this.get('recipientId') ?? this.get('secondUserId');
    if (!first || !second) return;
    try {
      if (this.get('pairKey') !== personPairKey(String(first), String(second))) this.invalidate('pairKey', 'Invalid participant pair.');
    } catch { this.invalidate('pairKey', 'Invalid participant pair.'); }
  });
}
type Preferences = InferSchemaType<typeof preferencesSchema>;
type Invitation = InferSchemaType<typeof invitationSchema>;
type Connection = InferSchemaType<typeof connectionSchema>;
export const DiscoveryPreferences: Model<Preferences> = (models.DiscoveryPreferences as Model<Preferences> | undefined) ?? model<Preferences>('DiscoveryPreferences', preferencesSchema);
export const Invitation: Model<Invitation> = (models.Invitation as Model<Invitation> | undefined) ?? model<Invitation>('Invitation', invitationSchema);
export const Connection: Model<Connection> = (models.Connection as Model<Connection> | undefined) ?? model<Connection>('Connection', connectionSchema);
const blockSchema = new Schema({ blockerId: userId, blockedId: userId, pairKey: { type: String, required: true, index: true } }, { timestamps: true, strict: 'throw' });
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
type Block = InferSchemaType<typeof blockSchema>;
export const PersonBlock: Model<Block> = (models.PersonBlock as Model<Block> | undefined) ?? model<Block>('PersonBlock', blockSchema);
