# Ohun V2 — Agent Instructions

## Product

Ohun V2 is an accessible, secure, private real-time messaging application for friends and family.

Supported platforms:

- Android phones and tablets
- iPhone and iPad
- Desktop and laptop browsers
- Installable desktop PWA on supported browsers
- Mobile browsers as a fallback

## Delivery priority

Ohun V2 is a native mobile app first. Android and iOS are the primary product targets. Build and validate the Expo/React Native experience before implementing functional browser authentication or messaging. The existing web/PWA shell may remain buildable, but new web product functionality is deferred until the native mobile application is stable.

## Approved design

Use only the approved Ohun V2 Stitch project:

https://stitch.withgoogle.com/projects/16264346330507370332

Approved inventory:

- 29 mobile screens
- 6 desktop screens
- 1 interaction-state board
- 1 design-system board

Do not create duplicate screens, dark-theme screens, public rooms, or unapproved functionality.
Do not blindly copy generated Stitch HTML or CSS. Recreate designs with maintainable, accessible components.

## Architecture

npm-workspaces TypeScript monorepo:

- `apps/web` — React, Vite, and PWA
- `apps/mobile` — React Native and Expo
- `apps/api` — Express and Socket.IO
- `packages/contracts` — Zod schemas and shared TypeScript types
- `packages/api-client` — shared HTTP and socket clients (transport only)
- `packages/design-tokens` — colours, typography, spacing, and breakpoints
- `packages/config` — shared TypeScript and lint configuration
- `tests/e2e` — Playwright tests

Persistence: MongoDB and Mongoose.

Server state: TanStack Query for remote server state. Local React state for temporary interface state.

Styling:

- Web: CSS Modules
- Mobile: React Native `StyleSheet` with shared design tokens

Presentation components stay platform-specific. Share only platform-neutral contracts, validation, API behaviour, utilities, and design tokens.

## Security requirements

- Authenticate every HTTP request and Socket.IO connection.
- Derive the sender identity from the verified session.
- Never trust a client-supplied sender ID or username.
- Authorise conversation membership before joining rooms, reading messages, or sending messages.
- Validate HTTP payloads and socket events with Zod.
- Use HTTP-only secure cookies on the web.
- Use secure credential storage on native mobile.
- Store refresh sessions server-side and support revocation.
- Rate-limit authentication, discovery, invitation, and messaging endpoints.
- Validate file type and size before uploading media.
- Do not store production secrets in source control or client bundles.
- Do not log access tokens, passwords, private messages, or sensitive contact data.

## Accessibility requirements

Target WCAG 2.2 AA.

- Use semantic HTML on web.
- Ensure complete keyboard navigation.
- Provide visible focus indicators.
- Give every control an accessible name.
- Maintain minimum 44×44px touch targets.
- Support screen readers and live announcements.
- Support text resizing and reduced motion.
- Do not communicate state using colour alone.
- Provide accessible loading, empty, offline, validation, and error states.

## Testing and verification

For every behaviour change:

- Add or update tests
- Run lint
- Run TypeScript type-check
- Run unit tests
- Run relevant builds

Do not claim completion based only on generated code. Report files changed, tests run, results, and remaining risks.

## Development rules

- Work on one milestone at a time.
- Inspect existing files before changing them.
- Do not rewrite unrelated code.
- Do not add features outside the current milestone.
- Do not commit generated builds, dependencies, or secret files.
- Do not commit, push, deploy, or connect production services without explicit approval.
- Preserve Git history; V1 prototype is recoverable via tag `legacy-v1-prototype`.

## Explicit prohibitions

- Public chat rooms (including General / Sports / Tech / Gaming)
- Duplicate Stitch screens
- Dark-theme screens
- Unapproved features
- Functional authentication, contacts, messaging, or push notifications until their milestone
