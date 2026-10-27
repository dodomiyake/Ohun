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
import { createMessagingPublisher, validateLiveSocketSessions } from './messaging-events.js';

export async function startServer(env: ApiEnv = loadEnv()) {
  const auth = createAuthService({ env, email: new MemoryEmailProvider(), blocklist: new MemoryPasswordBlocklist() });
  let publish: ReturnType<typeof createMessagingPublisher> = async () => {};
  const app = createApp(env, { messaging: { publish: (participants, event) => publish(participants, event) } });
  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: env.CLIENT_ORIGIN, credentials: true } });
  requireSocketAuthentication(io, auth);
  publish = createMessagingPublisher(io, auth);
  io.on('connection', socket => socket.emit('ready', { milestone: 'm4', messaging: true }));
  const sessionSweep = setInterval(() => { void validateLiveSocketSessions(io, auth); }, 15_000);
  sessionSweep.unref();
  server.on('close', () => clearInterval(sessionSweep));

  const connected = await connectMongoIfConfigured(env.MONGO_URI);
  if (!connected) console.info('[api] MONGO_URI not set — skipping database connection (M1).');
  await new Promise<void>(resolve => server.listen(env.PORT, () => resolve()));
  console.info(`[api] listening on port ${env.PORT}`);
  return { app, server, io };
}
