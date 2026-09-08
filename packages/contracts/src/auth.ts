import { z } from 'zod';

const email = z.string().email().max(254);
const username = z.string().min(3).max(32).regex(/^[\p{L}\p{N}._-]+$/u);
const displayName = z.string().trim().min(1).max(80);
const device = z.object({ platform: z.literal('native'), name: z.string().min(1).max(120) });

export const registerRequestSchema = z.object({ email, username, password: z.string(), device: device.optional() }).strict();
export const verificationCodeRequestSchema = z.object({ email, code: z.string().regex(/^\d{6}$/) }).strict();
export const verificationLinkRequestSchema = z.object({ token: z.string().min(32).max(128) }).strict();
export const resendVerificationRequestSchema = z.object({ email }).strict();
export const loginRequestSchema = z.object({ identifier: z.string().min(1).max(254), password: z.string(), device }).strict();
export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32).max(256) }).strict();
export const logoutRequestSchema = z.object({ refreshToken: z.string().min(32).max(256).optional() }).strict();
export const passwordResetRequestSchema = z.object({ email }).strict();
export const passwordResetConfirmRequestSchema = z.object({ token: z.string().min(32).max(128), newPassword: z.string() }).strict();
export const passwordChangeRequestSchema = z.object({ currentPassword: z.string(), newPassword: z.string(), refreshToken: z.string().min(32).max(256) }).strict();
export const profileUpdateRequestSchema = z.object({ displayName, bio: z.string().max(500), status: z.string().max(160), username: username.optional() }).strict();

export const verificationRequiredResponseSchema = z.object({ ok: z.literal(true), verificationRequired: z.literal(true) });
export const okResponseSchema = z.object({ ok: z.literal(true) });
export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  user: z.object({ id: z.string(), email: z.string().email(), username: z.string(), emailVerified: z.boolean() }),
});
export const meResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string().email(), username: z.string(), emailVerified: z.boolean() }),
  profile: z.object({ displayName: z.string(), bio: z.string(), status: z.string(), avatarKey: z.string().optional() }).nullable(),
});
export const profileResponseSchema = meResponseSchema;

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmRequest = z.infer<typeof passwordResetConfirmRequestSchema>;
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;
