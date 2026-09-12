import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
if (process.env.CI) throw new Error('Local setup is unavailable in CI.');
const addresses = Object.values(networkInterfaces()).flat().filter((value) => value && value.family === 'IPv4' && !value.internal);
const host = process.argv[2] ?? addresses[0]?.address ?? '127.0.0.1';
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.split('.').some((part) => Number(part) > 255)) throw new Error('Supply your computer’s local IPv4 address.');
const api = `NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ohun_local?replicaSet=rs0&directConnection=true
CLIENT_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=${randomBytes(32).toString('base64url')}
TOKEN_HMAC_MASTER=${randomBytes(32).toString('base64url')}
DEV_INBOX_ENABLED=true
DEV_INBOX_SECRET=${randomBytes(32).toString('base64url')}
EMAIL_PROVIDER=memory
AVATAR_STORAGE_PROVIDER=memory
PASSWORD_BLOCKLIST_PROVIDER=memory
`;
for (const [path, content] of [['apps/api/.env', api], ['apps/mobile/.env', `EXPO_PUBLIC_API_BASE_URL=http://${host}:5000\nEXPO_PUBLIC_SOCKET_URL=http://${host}:5000\n`]]) {
  if (existsSync(path)) { console.info(`${path} already exists; retained it.`); continue; }
  writeFileSync(path, content, { flag: 'wx', mode: 0o600 }); console.info(`Created ${path}.`);
}
console.info(`Phone API address: http://${host}:5000. Check this is your Wi-Fi IPv4 address.`);
