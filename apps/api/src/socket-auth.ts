import type { Server as SocketServer, Socket } from 'socket.io';
import type { AuthService } from './auth-service.js';

export function socketAccessToken(socket: Pick<Socket, 'handshake'>): string {
  const authToken: unknown = socket.handshake.auth.token;
  if (typeof authToken === 'string') return authToken;
  const header = socket.handshake.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}

export function requireSocketAuthentication(io: SocketServer, auth: AuthService) {
  io.use(async (socket, next) => {
    try {
      const token = socketAccessToken(socket);
      if (!token) throw new Error('Missing access token');
      socket.data.identity = await auth.authenticate(token);
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
}
