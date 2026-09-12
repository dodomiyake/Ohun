import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { MemoryAvatarStorage } from './providers.js';
import { Profile } from './models.js';
import { createProfileService } from './profile-service.js';
import { createProfileRouter } from './profile-router.js';
import { AuthError, type AuthService } from './auth-service.js';

afterEach(() => vi.restoreAllMocks());
describe('saved avatar reads', () => {
  it('reads only the authenticated user’s stored avatar and disables caching', async () => {
    const storage = new MemoryAvatarStorage();
    await storage.put('owned', new Uint8Array([1, 2, 3]), 'image/webp');
    const find = vi.spyOn(Profile, 'findOne').mockReturnValue({ select: () => Promise.resolve({ avatarKey: 'owned' }) } as never);
    const auth = { authenticate: vi.fn().mockResolvedValue({ userId: 'owner', sessionId: 'session' }) } as unknown as AuthService;
    const app = express(); app.use(createProfileRouter(auth, createProfileService(storage)));
    const response = await request(app).get('/avatar?userId=someone-else').set('Authorization', 'Bearer access');
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-type']).toContain('image/webp');
    expect(find).toHaveBeenCalledWith({ userId: 'owner' });
    expect(response.body).toEqual(Buffer.from([1, 2, 3]));
  });
  it('returns a controlled missing-photo error when storage no longer has the file', async () => {
    vi.spyOn(Profile, 'findOne').mockReturnValue({ select: () => Promise.resolve({ avatarKey: 'missing' }) } as never);
    await expect(createProfileService(new MemoryAvatarStorage()).readAvatar('owner')).rejects.toMatchObject({ status: 404, code: 'avatar_not_found' });
  });
  it('does not access storage without authentication', async () => {
    const storage = new MemoryAvatarStorage(); const get = vi.spyOn(storage, 'get');
    const app = express(); app.use(createProfileRouter({} as AuthService, createProfileService(storage)));
    app.use((error: AuthError, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status).end(); });
    expect((await request(app).get('/avatar')).status).toBe(401); expect(get).not.toHaveBeenCalled();
  });
});
