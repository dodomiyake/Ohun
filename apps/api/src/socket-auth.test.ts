import { describe, expect, it } from 'vitest';
import { socketAccessToken } from './socket-auth.js';

describe('Socket.IO authentication preparation', () => {
  it('accepts a native handshake token', () => {
    expect(socketAccessToken({ handshake: { auth: { token: 'native-access' }, headers: {} } } as never)).toBe('native-access');
  });

  it('accepts a bearer header and rejects unrelated headers', () => {
    expect(socketAccessToken({ handshake: { auth: {}, headers: { authorization: 'Bearer access' } } } as never)).toBe('access');
    expect(socketAccessToken({ handshake: { auth: {}, headers: { authorization: 'Basic value' } } } as never)).toBe('');
  });
});
