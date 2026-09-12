# M2 authentication, sessions and profiles

## Product priority

Ohun V2 is delivered as a native mobile application first. Android and iOS are the primary clients for M2 and the following messaging milestone. The existing web/PWA shell remains buildable as a non-functional design foundation, but functional browser authentication, profiles and messaging are deferred until the native product is stable.

This direction does not discard the shared API, MongoDB models, contracts or security primitives. Those components are platform-neutral and serve native first. Browser-only controls are retained below as a future architecture decision, not as current implementation scope.

## Scope and locked decisions

M2 uses MongoDB/Mongoose, email-or-username login, 15–128 Unicode-character passwords, no composition rules, dual email verification, access JWTs, rotating refresh credentials and revocable devices. Email verification never logs a user in. Production email and avatar providers remain out of scope.

Native sessions expire after 30 days absolutely or 7 days idle. Native access tokens remain in memory and rotating refresh credentials are stored only in Expo SecureStore. Password change revokes all other sessions and rotates the current refresh credential. Session usage writes are throttled to once per five minutes.

The future web policy remains 7 days absolute/24 hours idle by default and 30 days absolute/7 days idle when “Remember me” is selected. It does not drive current mobile implementation.

## Data ownership and indexes

`User` owns normalised unique email and username plus a non-selected Argon2id hash. `Profile` owns display name, bio, status and optional avatar key; it never duplicates username. `Session` owns device and expiry state. Every issued refresh credential has one `RefreshToken` record with a unique HMAC hash, family, parent, use, revocation and expiry state. Verification challenges, persistent verification throttles, reset tokens and validated security events are separate models.

MongoDB TTL indexes are cleanup only. Every operation compares expiry in application logic. Refresh rotation uses a replica-set transaction: validate session and absolute/idle expiry, consume exactly one unused token, create one successor, throttle session activity/idle updates, and commit. Replay of a consumed token revokes its family; there is no grace period or stored plaintext successor.

## Verification

One challenge contains a cryptographically random six-digit code (10-minute lifetime) and opaque 256-bit link token (24-hour lifetime). Only keyed hashes are stored. Either path consumes the whole challenge. A separate `VerificationThrottle` persists five-failure/30-minute lock and resend counters, so resend cannot reset protection.

The native app accepts the verification link through an approved universal/app-link route. It extracts the token once, immediately exchanges it through POST, replaces the navigation state, and never stores or logs the raw URL or token. Analytics and third-party initialisation must not receive the incoming URL. The six-digit code remains a complete manual verification path, including when the app is not installed. Browser URL handling is deferred with the web client.

## Cryptography and password policy

Passwords allow spaces, Unicode, paste, managers and autofill; inputs are not trimmed or truncated. Argon2id parameters are benchmarked before production. A blocklist interface handles common/compromised passwords. A 256-bit `TOKEN_HMAC_MASTER` is expanded with HKDF contexts for refresh, verification-link, verification-code, reset and IP correlation. CSRF has a separate secret. JWT verification pins HS256 and requires `sub`, `sid`, `typ=access`, `iss`, `aud`, `iat`, `exp` and `jti`.

## Native credential handling

The access token exists in memory only. The refresh credential is written to Expo SecureStore and is never placed in AsyncStorage, application logs, analytics, crash metadata or URLs. Startup may attempt one guarded refresh from SecureStore. Logout clears the local refresh credential even when server revocation fails, while surfacing the recoverable server error safely.

Native refresh requests use an explicit credential supplied by the application, not an ambient browser cookie, so CSRF cookies are not part of native authentication. API authentication and Socket.IO handshakes derive identity only from a verified access token and enforce session revocation server-side.

## Deferred web credential handling

When web implementation begins later, its refresh credential will use the host-only `ohun_refresh` cookie: HttpOnly, Secure outside local development, SameSite=Lax, Path=/api/v1/auth, with no Domain. Login/refresh JSON will return a session-bound HMAC CSRF value held only in memory and sent as `X-CSRF-Token`. Cookie-authenticated mutations will also enforce exact Origin. Bearer endpoints will enforce the browser-origin policy but are not treated as ambient-cookie authentication.

The future web client will coordinate refresh with the Web Locks API, publish resulting access/CSRF/session state over an authenticated BroadcastChannel and use a safe in-memory fallback. None of this is required by or bundled into the native client. The server transaction remains authoritative and reuse detection is never weakened.

## Providers, events and safe failure

`EmailProvider`, `AvatarStorageProvider` and `PasswordBlocklist` are interfaces. Test adapters are in-process, never log tokens and are forbidden in production. Security-event metadata is allowlisted to session/family/reason/correlation fields; passwords, credentials, request bodies, cookies and email contents are forbidden. Optional IP correlation uses the HKDF-derived HMAC key. Non-critical audit persistence failure emits a secret-free operational signal; revocation state still completes transactionally.

## M2 sequence

- M2.1: this design, contracts, environment validation, models/indexes, primitives and safe adapters.
- M2.2: mobile-first API registration, dual verification, login, initial native session/token issuance, `/me`, authenticated Socket.IO handshake preparation and account/IP rate limits.
- M2.3: Expo native registration, code/link verification and login routes; in-memory access tokens; SecureStore refresh credentials; startup restoration; guarded navigation; accessible error/loading/offline states.
- M2.4: transactional refresh/reuse detection, native logout, password reset/change, session expiry handling and secure retry behaviour.
- M2.5: native profile creation/editing, atomic username change, audited Sharp avatar normalisation and storage abstraction.
- M2.6: native Active Devices, individual revocation, logout all other devices and validated security events.
- M2.7: Android/iOS integration and device tests, deep-link tests, screen-reader checks, CI documentation, dependency/security review and production-readiness assessment.

## Deferred web milestone

After the native application is stable and approved, plan a separate web milestone. It may implement the already approved host-only cookie/CSRF design, browser verification/reset URL hygiene, Web Locks/BroadcastChannel refresh coordination, TanStack Query route guards and the approved Stitch web screens. Web functionality must not delay native milestones or cause shared APIs to assume cookie authentication.

## Mobile-first acceptance rules

- Every new user-facing M2 flow is implemented and approved on Expo/native before a browser equivalent.
- API contracts represent native bearer/refresh credentials without exposing secrets to logs or persistent general-purpose storage.
- Android and iOS behaviour is tested separately where platform handling differs.
- Authentication deep links are single-use, removed from navigation state after exchange and excluded from telemetry.
- SecureStore unavailability and write/delete failures have explicit safe error paths.
- The existing web shell must continue to compile and pass regression tests, but gains no functional authentication or messaging during mobile-first delivery.


## M2.6 native Active Devices

Settings → Active devices lists the account's unrevoked, unexpired sessions with the current device first. Only device name, platform, sign-in time and approximate activity time are returned. No location, IP, token hashes or token-family identifiers are exposed.

- `GET /api/v1/sessions`: list active sessions.
- `DELETE /api/v1/sessions/:sessionId`: revoke one owned session, including the current device when explicitly selected.
- `POST /api/v1/sessions/revoke-others`: revoke every other session while retaining the authenticated session.

All endpoints require bearer authentication, with IP and authenticated-account throttling. Revocation checks ownership and caller validity inside a transaction, serializes against concurrent session changes, and revokes refresh records in the same transaction. Repeated revocation of an owned session is idempotent. Unknown and other-account session IDs return the same 404. Access requests and new socket handshakes reject revoked sessions; disconnecting already-connected messaging sockets remains part of messaging delivery.

Device revocation events use strict event-specific schemas, validated again at the model boundary. Audit-write failure cannot undo successful revocation; a structured operational alert contains only the event type and a generated correlation ID.

The native screen uses TanStack Query, zero cache retention after unmount, abortable reads, foreground/pull refresh, confirmation dialogs, retry/error states, and explicit current-device labeling. Revoking the current session clears native credentials. A rejected session returns the user to sign-in. Activity timestamps are approximate because last-used writes remain throttled.

Validation includes account isolation, expiry filtering, individual/all-other/self revocation, concurrent duplicate revocation, transaction rollback, schema validation, safe audit failure, and native transport tests. Physical Android/iOS accessibility and visual verification remains required before declaring native release readiness.
