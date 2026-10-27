# Ohun native direct messaging design
Date: 2026-10-25
Status: Proposed design; approach approved, detailed design awaiting approval.
Builder review: completed 2026-10-25; no important unanswered planning questions.
Base: m3/mobile-people at 01819f60b5b6d8f5c24e80227ebe43327a6b5b6d.

## Intent and approved scope
Let accepted contacts open a direct conversation, exchange text live, and recover saved history after reopening the app. Android and iOS come first. The user approved durable HTTP writes/history with Socket.IO live updates. Preserve the existing Expo, Express, MongoDB, TanStack Query, Zod and shared-package architecture.

The contacts acceptance flow has been confirmed by the user on both accounts. Inspection found authenticated socket handshakes in apps/api/src/socket-auth.ts, while server.ts still advertises messaging:false. Conversation storage, message routes and native conversation behavior are new work.

## Approaches
Chosen: HTTP for conversation creation, message persistence and history; Socket.IO for change notifications. This reuses HTTP authentication, validation, error handling and retry patterns, while a disconnected socket does not prevent saving a message.
Considered: socket commands for both persistence and delivery. This would need another acknowledgement/retry/error path and still require history recovery.
Considered: HTTP polling alone. Simpler transport but worse latency and needless idle requests. Use bounded foreground polling only as a recovery fallback.

## Product behavior and proposed builder decisions
1. Tapping an accepted contact opens the single conversation for that pair. Concurrent opens resolve to the same conversation.
2. Chats lists conversations with at least one saved message, newest activity first, with the other participant, a one-line preview and time. An untouched conversation does not clutter Chats. Empty state points to People.
3. Conversation shows participant identity, back navigation, date groups, left incoming/right outgoing text bubbles, timestamps, and a multiline composer. Send requires non-whitespace text. Limit text to 4,000 Unicode code points; preserve meaningful whitespace and line breaks, reject whitespace-only input.
4. Local outgoing bubbles show Sending, Sent (server saved), or Could not send with Retry. Sent never implies read or delivery to a device. Preserve failed text while the screen remains mounted. No persistent offline outbox in this milestone.
5. Retry uses the same client message UUID. A timeout may mean the server saved the message; retry must recover that message, never duplicate it. Matching socket or HTTP results settle the same local bubble.
6. Open/reopen/refocus/reconnect fetches authoritative state. Older history loads in pages of 50 without jumping the scroll position. New incoming messages auto-scroll only near the bottom; otherwise show a new-messages affordance.
7. Successful sends clear only the submitted draft, never text typed afterward. Leaving a screen may discard unsent drafts; saved messages persist across app/device restarts.
8. No calls, video, attachments, emoji picker, typing indicators, presence, read receipts, push notifications, groups or functional web messaging yet. Render no controls or statuses that imply these work.

## Figma and native layout
Reference: https://www.figma.com/design/XWy7Hpekp3sO0qqAuyDDfF/Ohun?node-id=3-3829
Direct Conversation node 3:3829 was inspected via metadata during exploration. Its composer begins at y721 while bottom navigation begins at y732, so the imported layout overlaps. Proposed correction: hide the tab bar on the conversation route; keep the composer above keyboard and bottom safe area, with back navigation returning to the previous screen. Chats, People and Settings retain the normal tab bar outside conversations.
Use Ohun branding, shared design tokens and actual participant data. No sample messages or fabricated Online labels. Use initials until an authorized existing avatar path is verified; do not expand public profile disclosure.
Before implementation, inspect Figma design context/screenshots for the conversation and Chats list and map sizes, spacing, colors and typography. Metadata alone is not proof of visual parity. User instruction to follow Figma takes precedence over the older Stitch-only wording in AGENTS.md.
Use native accessible controls, minimum 44-point targets, text resizing, screen-reader labels and restrained announcements. Validate keyboard open/closed, small screens and large text. Match the approved visual hierarchy while resolving the overlap explicitly above.

## Storage and ordering
Conversation: id, unique sorted pairKey, exactly two participant IDs, nextSequence, lastMessage summary, timestamps.
Message: id, conversationId, senderId, clientMessageId UUID, body, sequence, createdAt.
Unique indexes: conversation pairKey; message (conversationId, senderId, clientMessageId); message (conversationId, sequence).
Assign per-conversation monotonic sequence and update lastMessage atomically with insertion in a Mongo transaction. Use existing replica-set test/local infrastructure. No stored message can appear without the corresponding conversation summary update.
Page history by sequence rather than device time. List conversations by stable (last activity, id) cursor. Bound all limits to 50. Opening an empty conversation does not count as activity.
A retry with the same UUID and body returns the original record; a reused UUID with different content returns a conflict. Sender identity always comes from the authenticated session.

## HTTP contracts and authorization
Proposed routes, finalized in the implementation plan:
- POST /api/v1/conversations/direct {contactId}: create or get pair conversation.
- GET /api/v1/conversations?cursor&limit: participant-scoped list.
- GET /api/v1/conversations/:id/messages?beforeSequence&limit: latest/older history.
- GET /api/v1/conversations/:id/messages?afterSequence&limit: ascending catch-up; mutually exclusive cursors.
- POST /api/v1/conversations/:id/messages {clientMessageId,body}: persist or recover retry.

Shared Zod request/response schemas live in contracts; api-client contains transport only. Every route requires a currently valid session. Read requires membership. Open and send additionally require a current accepted Connection and no PersonBlock in either direction. Unauthorized conversation IDs return a uniform not-found response.
Existing participants retain their own saved history when disconnected/blocked, but cannot send. UI says messaging is unavailable without disclosing who blocked whom. Reaccepting a contact reuses history.
Serialize open/send checks against connection/block mutations using the same sorted user locks and transaction strategy as the people service. A block that commits first prevents a later send; a message committed first remains saved.
Bound request size; apply actor and IP limits, including 60 new messages per minute per sender and 120 read/open requests per minute per sender as initial builder defaults. Return retry guidance on 429; do not auto-loop retries.
Do not log message bodies, credentials or private contact information. This milestone adds server-stored messaging, not end-to-end encryption.

## Live updates and recovery
Use authenticated per-user rooms assigned only by the server; clients cannot select a user room or join arbitrary conversations. Notifications contain only a conversation ID and latest sequence, not body or participant details. Recipients fetch the authorized HTTP data.
Emit after commit to all valid devices for both participants. A failed emit never rolls back a saved message. No delivery guarantee is assigned to a socket event.
Check socket session validity before protected emission; disconnect expired/revoked sessions, and reconnect with refreshed credentials. Never rely indefinitely on the initial handshake.
Invalidate/update only account-scoped query caches. Clear private caches and disconnect on logout/account switch.
Subscribe before catch-up, then merge and deduplicate server messages by ID/sequence and optimistic ones by sender/clientMessageId. Catch up after the highest contiguous loaded sequence in bounded pages until current. New events during recovery trigger another pass.
On focus/reconnect fetch history and Chats. While foregrounded, run a 15-second lightweight refresh of Chats and the open conversation as fallback for missed events, including a server crash after commit. Pause in background. Refetch after send and use capped reconnect backoff. No background delivery or push promise.

## Verification and acceptance
Use TDD for new behavior, with relevant Mongo integration tests:
- Non-contact, self, unauthenticated and non-member open/send/read attempts fail.
- Concurrent direct opens create one conversation.
- Concurrent retries create one message; changed-body UUID reuse conflicts.
- Concurrent sends get unique ordered sequences and correct last preview.
- Commit failure leaves neither message nor misleading summary.
- Block/send races follow the shared transaction locks; history policy holds.
- History cursors, cross-account queries and malformed payloads are validated.
- Socket notifications reach both participants' devices but not third parties; expired/revoked sessions receive no protected events.
- Dropped notifications, socket-before-response, timeout-after-commit, reconnect and app foregrounding converge without duplicates.
- Mobile loading, empty, failure/retry, keyboard, pagination and account-switch states work.
Run repository lint, typecheck, unit/integration tests and relevant API/mobile builds/exports, plus existing required CI gates. No claim of completion from generated code alone.
On phone and emulator with Dodomiyake and Sappy: open from People; exchange text both directions; check Chats preview; reopen and confirm history; interrupt connectivity and retry; verify no duplicates; inspect Figma alignment with screenshots at comparable viewport sizes. Native manual checks remain pending until actually performed.

## Boundaries and implementation planning
Implement in a new messaging branch based on the contacts branch; preserve existing branches and Windows local changes. No production deployment, destructive data reset or unrelated refactor.
Plan contracts/storage/security tests first, then HTTP, notifications/recovery, then native UI and device validation. Exact component filenames, indexes beyond those listed, event naming and test utilities are builder choices after inspecting current code. No product code is authorized by this draft alone under the requested design-approval workflow.

## Evidence
- Base commit and branch verified through GitHub on 2026-10-25.
- https://github.com/dodomiyake/Ohun/blob/01819f60b5b6d8f5c24e80227ebe43327a6b5b6d/AGENTS.md
- https://github.com/dodomiyake/Ohun/blob/01819f60b5b6d8f5c24e80227ebe43327a6b5b6d/apps/api/src/socket-auth.ts
- https://github.com/dodomiyake/Ohun/blob/01819f60b5b6d8f5c24e80227ebe43327a6b5b6d/apps/api/src/people-models.ts
- Prior exploration: apps/api/src/server.ts, app.ts, packages/contracts/src/index.ts; Figma session 86738695-3b2a-449b-b444-5894f86e7151.
