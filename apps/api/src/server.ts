import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import type { ApiEnv } from '@ohun/contracts';
import { createApp } from './app.js';
import { connectMongoIfConfigured } from './db.js';
import { loadEnv } from './env.js';
import { createAuthService } from './auth-service.js';
import { MemoryEmailProvider } from './providers.js';
import { MemoryPasswordBlocklist } from './security.js';
import { requireSocketAuthentication } from './socket-auth.js';

export async function startServer(env: ApiEnv = loadEnv()) {
  const app = createApp(env);
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  const auth = createAuthService({ env, email: new MemoryEmailProvider(), blocklist: new MemoryPasswordBlocklist() });
  requireSocketAuthentication(io, auth);

  io.on('connection', (socket) => {
    socket.emit('ready', { milestone: 'm2.2', messaging: false });
  });

  const connected = await connectMongoIfConfigured(env.MONGO_URI);
  if (!connected) {
    console.info('[api] MONGO_URI not set — skipping database connection (M1).');
  }

  await new Promise<void>((resolve) => {
    server.listen(env.PORT, () => resolve());
  });

  console.info(`[api] listening on port ${env.PORT}`);
  return { app, server, io };
}
