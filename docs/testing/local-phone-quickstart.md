# Test Ohun on your phone

These steps target Windows/Git Bash, Node 22.13 or later, Docker Desktop running Linux containers, and a phone on the same private Wi-Fi. This is local development, not a production deployment.

## Prepare once

From the repository root:

```sh
npm ci
npm run build:packages
```

Run `ipconfig` and find your Wi-Fi IPv4 address. Replace the example below with it:

```sh
npm run setup:local -- 192.168.1.50
```

The setup script generates local API secrets and mobile API URLs. It never overwrites existing environment files. If it retains existing files, check apps/api/.env against .env.example and set DEV_INBOX_ENABLED=true plus a random DEV_INBOX_SECRET of at least 32 characters. Update apps/mobile/.env with your computer's Wi-Fi address. Do not share these files.

Start a local MongoDB replica set:

```sh
docker compose -f compose.local.yml up -d
```

Wait until MongoDB is healthy, then initialize it once:

```sh
docker compose -f compose.local.yml exec mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

An already-initialized response is fine on subsequent runs. Data is stored in a Docker volume. The database port is bound only to your computer's loopback interface.

## Run in separate terminals

Terminal 1:

```sh
npm run dev:api
```

Terminal 2:

```sh
npm run dev:mobile
```

Scan the QR code with a compatible Expo client. If Expo Go reports an SDK mismatch, use a compatible native development build; an Expo export is not an APK/IPA. Allow Node through Windows Firewall for private networks if prompted. Verify that `http://YOUR_WIFI_IP:5000/health` opens in the phone browser before troubleshooting sign-in.

## Test registration and verification

1. Create an account in the app with an email-shaped test address, unique username, and a 15–128-character password.
2. In a third terminal at the repository root, run:

   ```sh
   npm run dev:inbox
   ```

3. Read the six-digit code in your local terminal and enter it in the app. Codes expire in 10 minutes; verification does not sign you in automatically.
4. Sign in, create a profile, and choose an optional photo.
5. Reopen the profile and confirm the saved photo loads. Photos are lost when the API restarts because the development adapter is in memory.
6. Close/reopen the mobile app and check session restoration and profile-aware routing.
7. Use a second device/login to test Active devices and logout of other sessions.

The inbox requires development mode, explicit opt-in, a private header key, and a loopback connection. Browser-origin and forwarded requests are rejected. The inbox command intentionally displays test codes only in your local terminal; do not run it in shared logs or share terminal screenshots containing credentials.

## Limits

Real messaging is not implemented; chats remain a shell. Email is captured locally, not delivered. No production email/storage services or store-ready mobile binaries are configured. TalkBack/VoiceOver, large-text, keyboard, and physical Android/iOS checks remain pending (see native-m2-validation.md).

Stop the servers with Ctrl+C and MongoDB with `docker compose -f compose.local.yml stop`. Avoid `down -v` unless you intend to erase local test accounts.
