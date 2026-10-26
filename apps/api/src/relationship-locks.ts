import type { ClientSession } from 'mongoose';
import { User } from './models.js';
import { AuthError } from './auth-service.js';
export async function lockRelationshipParticipants(ids: string[], session: ClientSession): Promise<void> {
  for (const id of [...new Set(ids)].sort()) {
    if (!(await User.updateOne({ _id: id, emailVerifiedAt: { $ne: null } }, { $inc: { __v: 1 } }, { session })).matchedCount) throw new AuthError(404, 'person_unavailable', 'This request is unavailable.');
  }
}
