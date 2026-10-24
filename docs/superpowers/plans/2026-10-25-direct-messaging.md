# Native Direct Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Accepted contacts exchange durable text messages in the native Ohun app, with live updates and recoverable history.
**Architecture:** HTTP owns authorization, transactional persistence and history; authenticated Socket.IO sends invalidations after commit. Account-scoped TanStack Query caches and sequence-based reconciliation recover dropped notifications.
**Tech Stack:** Existing TypeScript npm workspaces, Expo/React Native, Express, Mongoose/MongoDB replica set, Socket.IO, Zod, Vitest.
**Spec:** docs/superpowers/specs/2026-10-25-direct-messaging-design.md
**Approval:** User approved the design with “continue” after reviewing the design handoff. This plan awaits execution handoff.
**Baseline:** m4/direct-messaging at 8767a4da4d60ee5d8515aefeaaa32dc0c2b7684b. Read AGENTS.md and the spec before execution.

## Global Constraints
- Android and iOS come first.
- Limit text to 4,000 Unicode code points; preserve meaningful whitespace and line breaks, reject whitespace-only input.
- Bound all limits to 50.
- Retry uses the same client message UUID.
- Sent never implies read or delivery to a device.
- No persistent offline outbox in this milestone.
- Use native accessible controls, minimum 44-point targets, text resizing, screen-reader labels and restrained announcements.
- While foregrounded, run a 15-second lightweight refresh of Chats and the open conversation as fallback for missed events, including a server crash after commit.
- Do not log message bodies, credentials or private contact information.
- No production deployment, destructive data reset or unrelated refactor.
- Existing versions remain: Node >=22.13; React 19.2.3 and React Native 0.86.2. Do not upgrade the stack.
- No new calls, attachments, presence, read receipts, push, groups or functional web messaging.

## Review Focus
1. Astral emoji and combining text must not be counted as UTF-16 units (Task 1).
2. A timed-out send followed by a retry after blocking must recover an already saved message without permitting a new send (Task 2).
3. A late request from account A must never repopulate account B's cache (Task 5).
4. A new draft typed during an in-flight send must survive success of the previous send (Task 6).
5. Same-time conversation updates and out-of-order notifications must not skip history or duplicate rows (Tasks 2 and 5).

## File map
New contracts: packages/contracts/src/messaging.ts and messaging.test.ts.
New transport: packages/api-client/src/messaging.ts and messaging.test.ts; update socket.ts/index.ts.
New backend: relationship-locks.ts, messaging-models.ts, messaging-service.ts, messaging-router.ts, messaging-events.ts and focused tests alongside each.
Modify backend people-service.ts to reuse locks, app.ts for router injection, server.ts for event wiring, socket-auth.ts for lifecycle checks.
New native directory apps/mobile/src/messaging: api.ts, reconcile.ts, MessagingProvider.tsx, useConversation.ts, ChatsScreen.tsx, ConversationScreen.tsx and corresponding tests.
New route apps/mobile/app/(app)/conversation/[id].tsx. Modify protected layout, authenticated index route and src/people/PeopleScreen.tsx.
Modify apps/mobile/package.json/package-lock.json only for the existing workspace api-client dependency and a platform UUID source if needed; prefer Expo-compatible expo-crypto when no native secure UUID API exists. Confirm Expo compatibility before installing.
New docs/superpowers/verification/2026-10-25-direct-messaging.md records actual checks and unresolved native validation.

## Task 1: Validated contracts and transport

**Interfaces:**
- Message = {id,conversationId,senderId,clientMessageId,body,sequence,createdAt}.
- Conversation = {id,person:PublicPerson,canSend:boolean,lastMessage:Message|null}; never expose email.
- MessagePage = {messages:Message[],nextBefore:number|null,nextAfter:number|null,latestSequence:number,conversation:Conversation}. before mode returns newest page in ascending display order; after mode returns ascending catch-up.
- ConversationPage = {conversations:Conversation[],nextCursor:string|null}.
- Export schemas/types above, openDirectRequestSchema {contactId}, sendMessageRequestSchema {clientMessageId,body}, historyQuerySchema {beforeSequence?,afterSequence?,limit=50}, conversationChangedSchema {conversationId,latestSequence}.
- createMessagingClient({baseUrl,fetch?}) returns openDirect(token,contactId):Promise<Conversation>, list(token,cursor?):Promise<ConversationPage>, history(token,id,query?):Promise<MessagePage>, send(token,id,input):Promise<Message>.
- createSocketClient retains its existing caller compatibility; add optional token and bounded reconnect options, autoConnect:false.

- [ ] Write contract and transport tests in the mapped files. Core assertions:
```ts
expect(sendMessageRequestSchema.safeParse({clientMessageId:uuid,body:'😀'.repeat(4000)}).success).toBe(true);
expect(sendMessageRequestSchema.safeParse({clientMessageId:uuid,body:'😀'.repeat(4001)}).success).toBe(false);
expect(sendMessageRequestSchema.safeParse({clientMessageId:uuid,body:' \n '}).success).toBe(false);
expect(historyQuerySchema.safeParse({beforeSequence:2,afterSequence:1}).success).toBe(false);
```
Also assert strict rejection of senderId/extra fields, invalid IDs/UUIDs, zero/negative/noninteger sequence, limit >50, preservation of line breaks, response validation, URL encoding, bearer header, 15,000ms timeout and structured 401/429 errors.
- [ ] Run: npm run test -w @ohun/contracts -- src/messaging.test.ts and npm run test -w @ohun/api-client -- src/messaging.test.ts. Expected red: missing exports/modules, then real failed assertions after scaffolding.
- [ ] Implement schemas, HTTP methods and socket options; use a shared transport error type for messaging, without rewriting existing auth/people clients.
- [ ] Rebuild packages and rerun both tests. Expected all pass.
- [ ] Commit: feat: define direct messaging contracts and transport.

## Task 2: Transactional conversation and message service

**Interfaces:**
- lockRelationshipParticipants(ids:string[],session:ClientSession):Promise<void> in relationship-locks.ts, preserving current sorted User __v writes and verified-user check.
- createMessagingService(now=()=>new Date()) exposes openDirect(actor:string,contactId:string):Promise<Conversation>, list(actor:string,cursor?:string,limit?:number):Promise<ConversationPage>, history(actor:string,id:string,query:HistoryQuery):Promise<MessagePage>, send(actor:string,id:string,input:SendMessageRequest):Promise<{message:Message,participantIds:string[],created:boolean}>.
- Models DirectConversation and DirectMessage use spec indexes. Expose no database models to native code.

- [ ] Write messaging.integration.test.ts using the existing MongoMemoryReplSet patterns, plus lock extraction regression coverage in people.integration.test.ts. Assertions:
```ts
expect(new Set((await Promise.all([openA(),openB()])).map(x=>x.id)).size).toBe(1);
expect(await DirectMessage.countDocuments({conversationId})).toBe(1); // concurrent same UUID
expect(retried.message.id).toBe(first.message.id);
expect(sequences).toEqual([1,2,3]); // concurrent distinct sends, sorted
expect(summary.lastMessage?.sequence).toBe(3);
```
Test missing contact/self/third-party denied; block-first forbids new send; send-first survives; retry after block returns existing matching message; changed body conflicts; transaction abort rolls back message/summary/counter; history still readable after block; reaccept reuses conversation; empty conversation excluded; 51-message pagination and same-time list tie-breaks skip nothing; cursor cannot change actor scope.
- [ ] Run npm run test:integration -w @ohun/api. Expected new tests red; preserve existing tests.
- [ ] Extract lock helper and replace the existing local lock calls without policy changes. Implement transactional open and send. First authorize membership and look for idempotent saved record; only new sends require current connection and no block. Acquire participant locks before relationship checks; atomically increment sequence, insert and update summary. Retry duplicate-open races by reading authorized winner. No socket emission inside retryable transactions.
- [ ] Implement stable list cursor as validated opaque encoding of lastMessage.createdAt plus conversationId; history by sequence, with fixed snapshot latestSequence for each response. Scope every query to actor membership and return uniform 404 for nonmembers. Populate public person fields only.
- [ ] Run integration suite and unit tests. Expected all pass, including cancelled-invitation regressions.
- [ ] Commit: feat: persist authorized direct conversations and messages.

## Task 3: HTTP routes and post-commit notifications

**Interfaces:**
- createMessagingRouter(auth:AuthService,service:MessagingService,publish:PublishConversationChange):Router.
- PublishConversationChange = (participantIds:string[],event:ConversationChanged)=>Promise<void>.
- Mount at /api/v1/conversations; relative routes /direct, /, /:id/messages GET/POST. Send status 201 if created, 200 if recovered; both return Message.
- createApp receives optional messaging dependencies for tests; preserve current default callers.

- [ ] Write messaging-router.test.ts with Supertest and injected service/publisher. Assert bearer identity overrides client input; invalid body/cursor rejected before service; 401/404/409/429 mapped; Cache-Control private,no-store; max 60 sends/minute/actor, 120 reads+opens/minute/actor and 240 all messaging requests/minute/IP; Retry-After present. Assert failed send never publishes; publisher rejection after commit still returns saved Message.
- [ ] Run npm run test -w @ohun/api -- src/messaging-router.test.ts. Expected red.
- [ ] Implement router validation/auth/rate limits, app wiring and publication after successful service commit. Idempotent recovery may republish the same invalidation safely. Bound error logs to event/error category, never payload.
- [ ] Rerun tests and API typecheck; expect pass.
- [ ] Commit: feat: expose authenticated messaging endpoints.

## Task 4: Session-safe Socket.IO invalidations

**Interfaces:**
- createMessagingPublisher(io:SocketServer,auth:AuthService):PublishConversationChange in messaging-events.ts.
- Event name conversation:changed; payload only ConversationChanged.
- Server-selected room user:<authenticated userId>; no client join handlers.
- Existing socketAccessToken and requireSocketAuthentication remain exported; socket lifecycle retains token in server memory only, never logs it.

- [ ] Write messaging-events.test.ts with authenticated fake sockets and at least one real server/client integration case in messaging-socket.integration.test.ts. Assert both participants' multiple devices receive event; third party receives none; revoked/expired token receives none and disconnects; malformed event rejected; failed authentication rejected; client room spoof has no effect.
- [ ] Run focused unit test and integration suite; expected red.
- [ ] Implement per-socket reauthentication immediately before emit, checking returned identity matches room owner. Do not broadcast blindly to the room. Recheck connected sockets every 15s to disconnect inactive invalid sessions; clear timers on shutdown. Wire publisher into the same HTTP app instance in server.ts. Keep REST success independent of socket failures. Update ready metadata to reflect actual enabled messaging.
- [ ] Run socket/auth tests and integration suite; expected pass.
- [ ] Commit: feat: deliver session-checked conversation updates.

## Task 5: Native synchronization and reconciliation

**Interfaces:**
- api.ts adapts createMessagingClient to EXPO_PUBLIC_API_BASE_URL.
- mergeMessages(existing:Message[],incoming:Message[]):Message[] deduplicates by ID and sorts sequence; reconcileOutgoing(local:PendingMessage[],saved:Message[]):PendingMessage[] matches senderId/clientMessageId.
- PendingMessage = {clientMessageId,senderId,body,state:'sending'|'failed'}.
- MessagingProvider uses useAuth and QueryClient; account key prefix ['messaging',userId].
- useConversation(id:string) returns {conversation,messages,pending,loading,error,loadOlder,hasOlder,send(body:string):Promise<void>,retry(clientMessageId:string):Promise<void>,refresh}.
- A single recovery controller per open conversation tracks highest contiguous loaded sequence, independent of older-page loading.

- [ ] Write reconcile.test.ts and MessagingProvider.test.tsx using existing native mocks/fake timers. Assert duplicate/out-of-order notifications converge; event-before-POST response removes matching pending only once; sequence 12 received before 11 triggers catch-up; 101 missing messages loads 3 bounded pages; account A result resolving after switch cannot populate B; logout removes private query data; background stops polling; active state performs refresh and 15s polling; token replacement reconnects with new credentials; failed renewal does not loop.
- [ ] Run npm run test -w @ohun/mobile -- src/messaging/reconcile.test.ts src/messaging/MessagingProvider.test.tsx. Expected red.
- [ ] Implement synchronization with generation guards, explicit account keys and cleanup. Subscribe before initial catch-up; invalidate Chats plus active conversation on events. GET retries bounded; POST retry only deliberate with retained UUID. Retry 401 once after existing single-flight restoreSession, using latest token; otherwise surface sign-in/error state. Socket reconnect backoff capped at 30s; no background poll.
- [ ] Add useConversation.test.tsx: timeout-after-commit resolves via history without duplication; explicit retry reuses UUID; failure keeps body; older page insertion preserves sequence order. Implement hook.
- [ ] Run all native tests and typecheck; expect pass.
- [ ] Commit: feat: synchronize native conversation history and retries.

## Task 6: Figma-based native screens and navigation

**Files:** ChatsScreen.tsx, ConversationScreen.tsx and tests; protected index/layout; conversation/[id].tsx; PeopleScreen.tsx/tests.
**Interfaces:** ChatsScreen():JSX.Element; ConversationScreen({conversationId}:{conversationId:string}):JSX.Element.
**Consumes:** useConversation, MessagingProvider, ConversationPage and existing AppNav/StateViews/theme.

- [ ] Load Figma design-to-code skill, retrieve conversation 3:3829 and actual Chats frame design context/screenshots. Record exact node IDs/token mappings and the approved composer/tab-bar correction in verification doc. Do not invent a Chats node or assert visual parity from metadata. Preserve existing Ohun branding.
- [ ] Write screen interaction tests. Assertions include:
```ts
expect(sendButton.disabled).toBe(true); // whitespace only
expect(screen.queryByText('Online')).toBeNull();
expect(screen.queryByText('Read')).toBeNull();
expect(input.value).toBe('new draft'); // older send resolves after edit
```
Test contact tap opens returned conversation id; open error keeps user on People with retry; Chats preview/order/empty state; failed message retry; send label/state; inaccessible contacts cannot send; back returns correctly; no AppNav inside conversation; app tab bar retained elsewhere; new-message affordance when scrolled up.
- [ ] Run npm run test -w @ohun/mobile -- src/messaging/ChatsScreen.test.tsx src/messaging/ConversationScreen.test.tsx src/people/PeopleScreen.test.tsx. Expected red.
- [ ] Implement safe-area/keyboard-aware native layout, multiline composer, initials, text bubbles/date/time, loading/error/empty states, pagination and 44-point controls. Use 4,000-code-point validation in UI and server. On success clear draft only if unchanged since submission; pending/retry stays per screen. Hide unsupported actions rather than render inert buttons. Avoid passing style arrays into Expo Slot children.
- [ ] Rerun native tests/typecheck. Expected pass.
- [ ] Commit: feat: add native direct conversation and chats screens.

## Task 7: Whole-flow validation and handoff

**Files:** docs/superpowers/verification/2026-10-25-direct-messaging.md; focused tests from prior tasks only as failures require.
- [ ] Run npm run lint, npm run typecheck, npm test, npm run test:integration -w @ohun/api, npm run build, npm run validate:bundles -w @ohun/mobile, npm run test:e2e. Expected exit 0 with no new warnings masking failures. Use existing CI Mongo configuration; do not substitute a standalone Mongo server for transaction tests.
- [ ] Inspect security behavior with real API/socket integration: two participants plus third user; revoked session, retry after timeout, block/send race, missing socket event. Capture command/output summaries, not private message contents.
- [ ] On Android phone/emulator, check both directions, reconnect/reopen history, duplicate prevention and Chats ordering. Compare native screenshots with Figma at comparable viewport sizes, including keyboard and large text. Validate iOS export; separately record whether actual iOS interaction testing was performed.
- [ ] If devices are unavailable, explicitly mark manual checks pending and give the user exact steps; never label native parity verified from export success.
- [ ] Run verification-before-completion and whole-branch code review required by chosen execution workflow. Fix material findings, rerun only affected checks, then record results.
- [ ] Commit verification notes; prepare draft PR based on m3/mobile-people, preserving stacked history. No merge/deployment without the applicable approval and CI gates.

## Self-review
Coverage: scope/layout Task 6; contracts Task 1; storage/authorization/block race Task 2; HTTP/limits Task 3; live/session safety Task 4; recovery/account isolation Task 5; device and Figma checks Task 7.
All five Review Focus cases have owning tests. No product code or test execution occurred while writing this plan. Exact implementation details not prescribed here remain builder choices within the approved spec.
