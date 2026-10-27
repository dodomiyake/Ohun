import { io, type Socket } from 'socket.io-client';

export type CreateSocketClientOptions = {
  url: string;
  token?: string;
};

/**
 * Transport-only socket factory for later milestones.
 * M1 does not join rooms or send messages.
 */
export function createSocketClient(options: CreateSocketClientOptions): Socket {
  return io(options.url, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    ...(options.token ? { auth: { token: options.token } } : {}),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
  });
}
