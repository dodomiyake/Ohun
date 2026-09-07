export interface EmailMessage { to: string; subject: string; text: string; }
export interface EmailProvider { send(message: EmailMessage): Promise<void>; }
export class MemoryEmailProvider implements EmailProvider { readonly messages: EmailMessage[] = []; async send(message: EmailMessage) { this.messages.push(structuredClone(message)); } }
export interface AvatarStorageProvider { put(key: string, bytes: Uint8Array, contentType: string): Promise<void>; delete(key: string): Promise<void>; }
export class MemoryAvatarStorage implements AvatarStorageProvider { readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>(); async put(key: string, bytes: Uint8Array, contentType: string) { this.files.set(key, { bytes: bytes.slice(), contentType }); } async delete(key: string) { this.files.delete(key); } }
export function assertNonProductionProvider(nodeEnv: string, provider: 'memory' | 'none') { if (nodeEnv === 'production' && provider === 'memory') throw new Error('In-memory provider is forbidden in production'); }
