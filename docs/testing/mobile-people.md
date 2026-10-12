# Native People and contact requests

This branch combines the existing auth/settings alignment and contacts API with native People screens. It is not merged into main.

## Two-device check

1. Run the updated API and Expo app. Sign in with different verified accounts and complete both profiles.
2. Open People on each device. Enable “Let people find me by username” on each account.
3. Search the other account's exact username, then Send request.
4. On the recipient device, open People → Contact requests. Accept the incoming request.
5. Return to People on both devices. The other account should appear under Your contacts.
6. Test Ignore and Cancel with separate account pairs; ignored requests remain pending to the sender by design. Existing invitation records prevent repeated invitations.

Lists refresh when entering the screen. Requests are not pushed in real time. Pagination is available for contacts and requests. Search requires a full username, not a display name. Discovery is opt-in and private by default.

## Design and scope

Based on Figma username search 6:4189 and requests 6:4349: background, 28px heading, 56px search field/avatar, rounded cards and pill buttons. Native layout reflows rather than reproducing clipped absolute positions. Touch targets are at least 44px. Brand is Ohun.

Photos in Figma are sample user data; API currently exposes only display name and username to discovery, so initials are shown. Existing bundled Material Symbols remain outlined, whereas Figma uses filled Material Icons. No exact-match claim. Native visual/device verification is still required.

Requests are contact invitations, not messages: no fake message previews, online status, mutual-contact counts, QR controls or privacy claims are presented. Messaging, address-book import and QR discovery remain future work. The old fake chat rows are replaced with an explicit messaging-not-available state.

## Automated verification

42 mobile tests and 45 API unit/HTTP tests pass, with mobile/API lint and mobile typecheck passing. The 8 MongoDB integration tests could not start locally because the test MongoDB process exits with code 100; the CI replica-set job must pass before merge. Native export results are reported in the PR.
