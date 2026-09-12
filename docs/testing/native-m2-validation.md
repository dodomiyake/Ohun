# Native M2 validation

## Automated checks

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm run test
npm run validate:bundles -w @ohun/mobile
npm run test:integration -w @ohun/api
```

The integration suite requires an isolated MongoDB replica set. CI supplies one via MONGO_TEST_URI. Expo export checks Android/iOS JavaScript bundling and assets; it does not produce an installable APK/IPA or exercise native behavior on a device.

## Device setup

Use a local development API backed by a replica set. Set EXPO_PUBLIC_API_BASE_URL in the mobile development environment to the API address reachable from the device; localhost on a phone refers to the phone itself. Use test accounts and the development email adapter only. Keep credentials and verification codes out of screenshots and reports.

Run `npm run dev:mobile` from the repository root. Use an Expo-compatible device client or local development build. Native build/signing and production service provisioning are separate from this validation.

## Required device evidence

Record device model, OS version, commit, actual result, and any redacted screenshot for each scenario. Every item below is pending until executed on Android and iOS.

| Scenario | Expected result |
| --- | --- |
| Cold launch with saved session | One refresh request; rotated credential saved before signed-in UI |
| Repeated restore action | Concurrent callers share rotation; session is not revoked for reuse |
| Cold launch offline | Retry saved session is available; refresh credential retained |
| Revoked saved session | Credential removed and login displayed |
| Register and verify | Link/code works once; success returns to login |
| Profile create/edit | Validation errors are readable; saved fields survive reopening |
| Avatar permission denied/cancelled | Form remains usable; no unexpected upload |
| Avatar upload | Chosen image uploads and error recovery works |
| Active devices | Current device labeled; only own sessions listed |
| Cancel logout confirmation | No revocation request |
| Revoke another device | Its next API request/refresh fails; current device stays signed in |
| Log out all other devices | Current session retained; other sessions revoked |
| Revoke current device | Native credential removed; login shown |
| Large system text | Labels wrap without clipping; controls remain reachable |
| TalkBack / VoiceOver | Logical focus order, named actions, announced errors |
| Keyboard open | Form fields and submission controls remain reachable |

## Outstanding M2 closure work

Physical device verification remains pending. Automatic renewal before expiry and on foreground resume, restoration/sign-out race protection, and profile-aware startup routing are implemented. Provider tests exercise renewal and both network/write sign-out races. Saved avatars now load through an authenticated owner-scoped endpoint with private/no-store caching and a missing-image fallback. The in-memory development storage adapter does not survive API restarts. Durable storage and physical device verification remain outstanding before release readiness. Passing bundle and API tests alone does not close these user journeys.
