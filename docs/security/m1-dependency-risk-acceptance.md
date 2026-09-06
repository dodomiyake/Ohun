# Milestone 1 dependency risk acceptance

## Review metadata

| Field | Value |
|-------|-------|
| Date of review | 2026-08-09 |
| Branch | `m1/v2-foundation` |
| Expo | 57.0.11 |
| React Native | 0.86.2 |
| React / React DOM | 19.2.3 |
| Node.js | 22.23.2 (engine requirement `>=22.13`) |
| npm | 11.3.0 (`packageManager`: `npm@11.3.0`) |
| Audit command | `npm audit --workspaces` |

## Audit severity totals

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 14 |
| Moderate | 8 |
| Low | 0 |
| Info | 0 |
| **Total** | **22** |

## Confirmations

- No **critical** finding exists in the current workspace audit.
- No safe **Expo SDK 57–compatible** remediation was available for the remaining findings at review time.
- `npm audit fix --force` was **not** used.
- npm’s suggested remediations that downgrade Expo to 53.x or React Native to 0.72.x are **invalid** for this baseline: they break the approved SDK 57 / React Native 0.86 / React 19.2.3 stack.

## Root advisories

These GitHub Security Advisories are the only leaf advisories reported with identifiers by `npm audit`. Other high/moderate package entries inherit exposure through the dependency graph below.

| Advisory ID | Severity | Package | Summary |
|-------------|----------|---------|---------|
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | High | `image-size` | ICNS parser denial of service via infinite loop |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | High | `image-size` | JXL/HEIF parser denial of service via infinite loops |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate | `uuid` | Missing buffer bounds check in v3/v5/v6 when `buf` is provided |

## Remaining high findings

| Package | Direct? | Dependency path | Usage | Why tooling-scoped | Why suggested fix is invalid |
|---------|---------|-----------------|-------|--------------------|------------------------------|
| `image-size` | No | `expo` → `@expo/metro` / Metro → `image-size` **and** `react-native` → `@react-native/community-cli-plugin` → Metro → `image-size` | Build / development (Metro bundler asset sizing) | Invoked by Metro while bundling; not part of Ohun auth, API, or message processing | npm suggests Expo 53.x major downgrade; incompatible with SDK 57 |
| `metro` | No | `expo` → `@expo/metro` → `metro`; `react-native` → community CLI plugin → `metro` | Build / development | JavaScript bundler for Expo/RN local and CI native tooling | Same invalid Expo 53 / RN 0.72 suggestions |
| `metro-config` | No | `metro` ↔ `metro-config`; `@react-native/metro-config` → `metro-config` | Build / development | Metro configuration loader | Same invalid downgrades |
| `metro-transform-worker` | No | `metro` → `metro-transform-worker` | Build / development | Metro transform worker process | Same invalid downgrades |
| `@expo/metro` | No | `expo` → `@expo/cli` / `@expo/metro-config` → `@expo/metro` | Build / development | Expo’s Metro integration | Same invalid Expo downgrade |
| `@expo/metro-config` | No | `expo` → `@expo/metro-config` | Build / development | Expo Metro config | Same invalid Expo downgrade |
| `@expo/cli` | No | `expo` → `@expo/cli` | Development / native build tooling | Expo CLI; not shipped as Ohun API/web production runtime | Same invalid Expo downgrade |
| `@react-native/community-cli-plugin` | No | `react-native` → `@react-native/community-cli-plugin` | Development / native build tooling | RN CLI/Metro plugin | npm suggests RN 0.72.x downgrade; breaks SDK 57 |
| `@react-native/metro-config` | No | community CLI plugin / worklets → `@react-native/metro-config` | Build / development | RN Metro config package | Same invalid RN downgrade |
| `@react-native/virtualized-lists` | No | `react-native` → `@react-native/virtualized-lists` (audit edge via RN tooling graph) | Flagged via RN package graph; no separate leaf advisory beyond Metro/`image-size` chain | Remains accepted only as part of the Expo/RN tooling graph for M1; not an auth/API/browser-message path | RN 0.72 downgrade invalid |
| `react-native` | Yes | `apps/mobile` → `react-native@0.86.2` | Direct app dependency, but **audit edges are via CLI/Metro tooling packages** above | High severity inheritance is from Metro/`image-size` tooling chain, not a separate app-network advisory in this audit output | RN 0.72 downgrade invalid for SDK 57 |
| `expo` | Yes | `apps/mobile` → `expo@57.0.11` | Direct app dependency; audit edges via `@expo/cli`, Metro, config packages | High severity inheritance is Expo CLI/Metro/config tooling | Expo 53 downgrade invalid |
| `react-native-reanimated` | No | Transitive via Expo Router / RN ecosystem → `react-native-reanimated` | Native animation tooling dependency graph; not used by M1 static shells’ auth/API/message logic | Flagged through RN tooling/peer graph | No SDK 57–safe non-breaking bump identified; force fix refused |
| `react-native-worklets` | No | `react-native-reanimated` → `react-native-worklets` | Build/native worklets support path | Tooling/native helper graph | Same as reanimated |

## Remaining moderate findings

| Package | Direct? | Dependency path | Usage | Why tooling-scoped | Why suggested fix is invalid |
|---------|---------|-----------------|-------|--------------------|------------------------------|
| `uuid` | No | `xcode` → `uuid` (advisory GHSA-w5hq-g745-h8pq) | Development / native iOS project tooling | Used by the `xcode` project utility during config/prebuild flows | npm suggests Expo 53 downgrade |
| `xcode` | No | `@expo/config-plugins` → `xcode` → `uuid` | Development / prebuild | Parses/writes Xcode projects | Same invalid Expo downgrade |
| `@expo/config-plugins` | No | `expo` / `expo-splash-screen` → `@expo/config-plugins` → `xcode` | Development / config plugins | Expo config plugin runtime for native project generation | Same invalid Expo downgrade |
| `@expo/config` | No | `expo` → `@expo/config` → `@expo/config-plugins` | Development / config | Reads app config for Expo tooling | Same invalid Expo downgrade |
| `@expo/prebuild-config` | No | Expo prebuild toolchain → `@expo/prebuild-config` | Development / native prebuild | Prebuild configuration | Same invalid Expo downgrade |
| `@expo/inline-modules` | No | `@expo/cli` → `@expo/inline-modules` → `@expo/config-plugins` | Development | Expo CLI helper | Same invalid Expo downgrade |
| `@expo/local-build-cache-provider` | No | `expo` → `@expo/local-build-cache-provider` → `@expo/config` | Development / local build cache | Local Expo build cache provider | Same invalid Expo downgrade |
| `expo-splash-screen` | Yes | `apps/mobile` → `expo-splash-screen` → `@expo/config-plugins` → `xcode` → `uuid` | Direct dependency for splash config plugin; moderate inheritance via config-plugins/`uuid` | Config-plugin path at build/prebuild time; M1 does not expose splash tooling to API/auth/message runtimes | Suggested splash-screen 55.x / Expo 53 remediations are incompatible with SDK 57 |

## Accepted exposure

Accepted for Milestone 1 only:

- Local development machines
- Metro bundling
- Expo CLI and Expo config/prebuild tooling
- Native build tooling paths used before or during EAS/native compilation

## Explicitly unaccepted exposure

This acceptance does **not** cover:

- Authentication flows or credential handling
- API request handling or Socket.IO message processing
- Browser / PWA production runtime for end users
- Uploaded content processing
- Production server execution

If a future advisory demonstrates a path into those surfaces on the approved stack, this document is immediately obsolete and must be replaced.

## Review triggers

Re-open this assessment when any of the following occur:

- Every milestone completion review
- Any Expo or React Native patch/minor release usable with the current SDK line
- Before the first EAS or native binary build
- Before private beta
- Before production release

## Exit criteria

This risk acceptance ends when one of the following is completed and documented:

1. Upgrade to patched packages compatible with the then-current approved Expo/RN baseline, **or**
2. Remove the affected dependency path, **or**
3. Replace this document with a new written assessment for the updated dependency graph

## Decision

The Milestone 1 foundation may proceed with the Expo SDK 57 / React Native 0.86 tooling audit debt described above. Force-fixing or downgrading away from SDK 57 is rejected.
