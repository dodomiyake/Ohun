# M3 — Native contacts and private invitations

## Scope and delivery

Android and iOS first. The foundation provides contracts, persistence schemas and invitation transition rules. The current API slice adds authenticated discovery and invitation endpoints; messaging is not exposed. M2 account/profile/session behavior stays available.

Reference: [Ohun Figma](https://www.figma.com/design/XWy7Hpekp3sO0qqAuyDDfF/Ohun?node-id=0-1), inspected 2026-09-13. Relevant nodes: People Hub `6:3982`, Username Search `6:4189`, Invite Link `6:4254`, Requests `6:4349`. The user's later Figma direction takes precedence over the original Stitch-only reference.

Design corrections for implementation: flexible text layouts instead of clipped fixed widths; minimum 44px touch targets; current Ohun branding; genuine generated QR data instead of the reference's placeholder photograph; no fabricated contacts, online status, message previews or automatic spam classification. Request copy must describe connection invitations until real messaging exists.

## Privacy and ownership

DiscoveryPreferences owns a per-user `byUsername` opt-in, default false, including users without a preferences document. Username remains solely on User. Public DTOs expose only user ID, username and display name. No email, device details, tokens, avatar storage keys, online status or read receipts.

Initial lookup will use an exact normalized username, not prefix/regex search or a public directory. Only verified users with completed profiles and enabled discoverability are eligible. Both lookup and invitation creation must recheck privacy and block policy. Database filters must be server constructed from validated inputs. No address-book permission or upload in the initial slice.

## Models and indexes

- DiscoveryPreferences: unique userId, byUsername, timestamps.
- Invitation: unique canonical pairKey, senderId, recipientId, state, expiresAt, resolvedAt, timestamps. Recipient/state/id and sender/state/id indexes support bounded lists.
- Connection: unique canonical pairKey, firstUserId, secondUserId, timestamps; indexes on each participant and id.

Canonical pair keys sort the two validated ObjectId strings. Self invitations are invalid. One invitation record per pair prevents crossed requests and repeated unsolicited requests. Ignored records are retained, not TTL deleted, so they cannot silently permit another request. Removal/retention policy needs completion before production account deletion.

## State and concurrency rules

Pending invitations expire after seven days (initial implementation policy). Recipient may accept or ignore; sender may cancel. Third parties cannot act. Expiry is enforced at the exact deadline in application logic. Accepted/cancelled records cannot transition again. A sender may cancel an ignored record with the same result as a pending record to avoid disclosing ignored status. No sender-facing read/ignored signal: outgoing presentation must not disclose whether the recipient opened or ignored a request.

The pure transition helper is not an authorization boundary by itself. Repository updates must repeat participant, state and expiry predicates in the atomic update filter. Acceptance and unique Connection creation must commit in one MongoDB transaction. Simultaneous accept/ignore/cancel must have one winner; duplicate acceptance must not create duplicate connections. Block operations must serialize against acceptance and prevent new discovery/invitations in both directions. Connections do not grant messaging access until conversation membership is implemented.

## Endpoint contracts

All routes require the existing bearer/session authentication. Identity comes from auth, never request bodies. Enforce IP and account limits, with stricter discovery and invitation issuance limits; production requires a shared limiter before multi-instance operation.

- GET/PUT `/api/v1/people/preferences`: explicit username discovery choice.
- POST `/api/v1/people/search`: exact username in body to avoid URL logging; max one result.
- GET `/api/v1/people`: accepted connections, keyset pagination, max 50.
- POST `/api/v1/invitations`: recipientId only; generic response for inaccessible recipients.
- GET `/api/v1/invitations`: participant-owned, bounded paginated results; incoming/outgoing serialization differs to protect ignored state.
- POST `/api/v1/invitations/:id/action`: accept/ignore/cancel with role-specific authorization.

No request body or contact identifiers in logs. Invalid/non-owned resources use the same generic response. Blocking and anti-abuse behavior must be implemented before functional discovery is exposed.

## Delivery sequence and acceptance

1. **M3.1 foundations (this change):** strict contracts, model indexes, opt-out default, canonical pair identity, role/expiry transition tests and m3 branch CI coverage. These tests verify schema definitions, not live index enforcement.
2. **M3.2 API:** transactional acceptance, block checks, preferences, privacy-aware search, rate limits, bounded lists and replica-set integration tests. Test cross-account access, privacy changes, crossed requests, concurrent actions and rollback. Establish concrete issuance limits and block model here.
3. **M3.3 native:** People, Find People and Requests using TanStack Query, existing tokens/components, foreground refresh, cleared account-scoped caches, accessible pending/empty/offline/error states and retry-safe actions. Validate with two distinct Android accounts, then iOS.
4. **M3.4 private links/QR and contacts:** opt-in revocable expiring invitation links, hash-only server token storage, explicit recipient confirmation, native link handling and QR generation/scanning. Do not publish a fictitious website/domain or use static placeholder QR artwork. Address-book matching needs a separate consent/minimization design before implementation.
5. **M3.5 validation:** full gates, actual transaction/concurrency results, Android/iOS device flow, TalkBack/VoiceOver and large text checks. Real messaging follows this milestone.

No new dependencies, production providers or deployment are needed for M3.1. QR library/deep-link domain, address-book handling and production rate-limit storage remain later decisions; they do not block the foundations.


## M3.2 implementation checkpoint

Authenticated routes above are now implemented, plus POST `/api/v1/people/:id/block`. Blocking is directional, unique per blocker/target, suppresses discovery in both directions and removes the connection. All relationship/privacy mutations write participant User version locks in sorted ID order inside transactions; this serializes crossed requests, acceptance and blocking. Acceptance repeats actor/state/expiry conditions in its atomic update filter.

Limits: 120 requests/minute/IP, 60/minute/account, search 10/minute/account, invitations 10/hour/account. These are process-local development limits; production distributed limiting is outstanding. Lists use ObjectId keyset pages of 50. Outgoing ignored records serialize as pending; there is no read signal. Exact username discovery follows the existing NFKC identity normalization.

Eight replica-set tests cover privacy, ownership, crossed invitations, concurrent acceptance, rollback, ignored-state suppression, expiry and block/accept concurrency. Local MongoDB startup currently exits with code 100, so live transaction validation remains pending on the CI replica set. Unit/HTTP tests do not substitute for these checks. Native UI, block management/unblock, links/QR and address-book matching remain later work; this API checkpoint is not production-ready.
