import { z } from 'zod';

export const personIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const publicPersonSchema = z.object({
  id: personIdSchema,
  username: z.string().min(3).max(32),
  displayName: z.string().min(1).max(80),
}).strict();
export const usernameSearchSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}._-]+$/u),
}).strict();
export const discoveryPreferencesSchema = z.object({ byUsername: z.boolean() }).strict();
export const invitationRequestSchema = z.object({ recipientId: personIdSchema }).strict();
export const invitationActionSchema = z.object({ action: z.enum(['accept', 'ignore', 'cancel']) }).strict();
export const invitationStateSchema = z.enum(['pending', 'accepted', 'ignored', 'cancelled']);
const invitationFields = {
  id: personIdSchema,
  person: publicPersonSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
};
export const invitationSchema = z.discriminatedUnion('direction', [
  z.object({ ...invitationFields, direction: z.literal('incoming'), state: invitationStateSchema }).strict(),
  z.object({ ...invitationFields, direction: z.literal('outgoing'), state: z.enum(['pending', 'accepted', 'cancelled']) }).strict(),
]);
export const peopleResponseSchema = z.object({ people: z.array(publicPersonSchema).max(50), nextCursor: personIdSchema.nullable() }).strict();
export const invitationsResponseSchema = z.object({ invitations: z.array(invitationSchema).max(50), nextCursor: personIdSchema.nullable() }).strict();
export type InvitationState = z.infer<typeof invitationStateSchema>;
export type InvitationAction = z.infer<typeof invitationActionSchema>['action'];
export type PublicPerson = z.infer<typeof publicPersonSchema>;
