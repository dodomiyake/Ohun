import { sessionEventSchema } from './session-event-schema.js';
import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const id = { type: Schema.Types.ObjectId, required: true, index: true } as const;
const expires = { type: Date, required: true, index: { expireAfterSeconds: 0 } } as const;
const userSchema = new Schema({ email: { type: String, required: true }, emailNormalized: { type: String, required: true, unique: true }, username: { type: String, required: true }, usernameNormalized: { type: String, required: true, unique: true }, passwordHash: { type: String, required: true, select: false }, emailVerifiedAt: Date }, { timestamps: true });
const profileSchema = new Schema({ userId: { ...id, unique: true }, displayName: { type: String, required: true }, bio: { type: String, default: '' }, status: { type: String, default: '' }, avatarKey: String }, { timestamps: true });
const sessionSchema = new Schema({ userId: id, familyId: { type: String, required: true, index: true }, platform: { type: String, enum: ['web', 'native'], required: true }, deviceName: { type: String, required: true, maxlength: 80 }, absoluteExpiresAt: { type: Date, required: true, index: true }, idleExpiresAt: { type: Date, required: true, index: true }, lastUsedAt: { type: Date, required: true }, revokedAt: Date, revokeReason: String }, { timestamps: true });
const refreshTokenSchema = new Schema({ sessionId: id, userId: id, familyId: { type: String, required: true, index: true }, tokenHash: { type: String, required: true, unique: true }, parentTokenId: Schema.Types.ObjectId, createdAt: { type: Date, required: true, default: Date.now }, expiresAt: expires, usedAt: Date, revokedAt: Date, revokeReason: String });
const verificationChallengeSchema = new Schema({ userId: id, linkHash: { type: String, required: true, unique: true }, codeHash: { type: String, required: true }, codeExpiresAt: { type: Date, required: true }, expiresAt: expires, consumedAt: Date }, { timestamps: true });
const verificationThrottleSchema = new Schema({ userId: { ...id, unique: true }, failedAttempts: { type: Number, default: 0 }, windowStartedAt: Date, lockedUntil: Date, lastSentAt: Date, sendCount: { type: Number, default: 0 }, sendWindowStartedAt: Date }, { timestamps: true });
const passwordResetSchema = new Schema({ userId: id, tokenHash: { type: String, required: true, unique: true }, expiresAt: expires, usedAt: Date }, { timestamps: true });
const securityMetadataKeys = new Set(['sessionId', 'familyId', 'reason', 'requestCorrelationId', 'ipCorrelation', 'targetSessionId', 'revokedCount']);
const securityEventSchema = new Schema({ userId: id, type: { type: String, required: true }, metadata: { type: Schema.Types.Mixed, required: true, validate: { validator: function (this: { type: string }, value: unknown) { if (['device_revoked', 'other_devices_revoked'].includes(this.type)) return sessionEventSchema.safeParse({ type: this.type, metadata: value }).success; return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, field]) => securityMetadataKeys.has(key) && (key === 'revokedCount' ? Number.isInteger(field) && Number(field) >= 0 : typeof field === 'string' && field.length <= 200))); }, message: 'Security event metadata contains an unknown field' } }, occurredAt: { type: Date, default: Date.now, required: true, index: true } });

type UserDocument = InferSchemaType<typeof userSchema>;
type ProfileDocument = InferSchemaType<typeof profileSchema>;
type SessionDocument = InferSchemaType<typeof sessionSchema>;
type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema>;
type VerificationDocument = InferSchemaType<typeof verificationChallengeSchema>;
type ThrottleDocument = InferSchemaType<typeof verificationThrottleSchema>;
type ResetDocument = InferSchemaType<typeof passwordResetSchema>;
type SecurityEventDocument = InferSchemaType<typeof securityEventSchema>;
export const User: Model<UserDocument> = (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>('User', userSchema);
export const Profile: Model<ProfileDocument> = (models.Profile as Model<ProfileDocument> | undefined) ?? model<ProfileDocument>('Profile', profileSchema);
export const Session: Model<SessionDocument> = (models.Session as Model<SessionDocument> | undefined) ?? model<SessionDocument>('Session', sessionSchema);
export const RefreshToken: Model<RefreshTokenDocument> = (models.RefreshToken as Model<RefreshTokenDocument> | undefined) ?? model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);
export const EmailVerificationChallenge: Model<VerificationDocument> = (models.EmailVerificationChallenge as Model<VerificationDocument> | undefined) ?? model<VerificationDocument>('EmailVerificationChallenge', verificationChallengeSchema);
export const VerificationThrottle: Model<ThrottleDocument> = (models.VerificationThrottle as Model<ThrottleDocument> | undefined) ?? model<ThrottleDocument>('VerificationThrottle', verificationThrottleSchema);
export const PasswordResetToken: Model<ResetDocument> = (models.PasswordResetToken as Model<ResetDocument> | undefined) ?? model<ResetDocument>('PasswordResetToken', passwordResetSchema);
export const SecurityEvent: Model<SecurityEventDocument> = (models.SecurityEvent as Model<SecurityEventDocument> | undefined) ?? model<SecurityEventDocument>('SecurityEvent', securityEventSchema);
export type SessionRecord = InferSchemaType<typeof sessionSchema>;
