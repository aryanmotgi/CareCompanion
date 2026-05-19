# Dependency Audit + Outdated Report

> Generated: 2026-05-19 | Package manager: bun 1.3.11 | Monorepo: apps/web, apps/mobile, apps/video, packages/{api,types,utils,design-tokens}

---

## Vulnerabilities by Severity

`bun audit` reports **36 vulnerabilities** across the monorepo (18 high, 14 moderate, 4 low).

### Critical — 0

None.

### High — 18

| CVE/Advisory | Package | Affected Range | Fixed In | Introduced Via |
|---|---|---|---|---|
| GHSA-34x7-hfp2-rc4v | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-8qq5-rm4j-mr97 | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-83g3-92jg-28cx | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-qffp-2rhf-9h96 | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-9ppj-qmqm-q256 | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-r6q2-hw4h-h46w | `tar` (node-tar) | <7.5.7 | 7.5.7 | `apps/mobile → expo` |
| GHSA-5j98-mcp5-4vw2 | `glob` | >=10.2.0 <10.5.0 | 10.5.0 | react-native, expo, eslint, tailwindcss, @sentry/nextjs, @ducanh2912/next-pwa |
| GHSA-wh4c-j3r5-mjhp | `@xmldom/xmldom` | <0.8.12 | 0.8.12 | `apps/mobile → expo*` |
| GHSA-2v35-w6hq-6mfw | `@xmldom/xmldom` | <0.8.12 | 0.8.12 | `apps/mobile → expo*` |
| GHSA-f6ww-3ggp-fr8h | `@xmldom/xmldom` | <0.8.12 | 0.8.12 | `apps/mobile → expo*` |
| GHSA-x6wf-f3px-wcqx | `@xmldom/xmldom` | <0.8.12 | 0.8.12 | `apps/mobile → expo*` |
| GHSA-j759-j44w-7fr8 | `@xmldom/xmldom` | <0.8.12 | 0.8.12 | `apps/mobile → expo*` |
| GHSA-8h8q-6873-q5fj | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` (pinned 14.2.35) |
| GHSA-c4j6-fc7j-m34r | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` (pinned 14.2.35) |
| GHSA-36qx-fr4f-26g5 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` (pinned 14.2.35) |
| GHSA-h25m-26qc-wcjf | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` (pinned 14.2.35) |
| GHSA-q4gf-8mx6-v5v3 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` (pinned 14.2.35) |
| GHSA-5c6j-r48x-rmvq | `serialize-javascript` | <=7.0.2 | 7.0.3 | `apps/web → @ducanh2912/next-pwa` |

**Summary of HIGH issues:**
- `tar`: 6 path traversal / arbitrary file overwrite CVEs — all transitive through `expo` in mobile. Fixed by upgrading Expo SDK.
- `next 14.2.35`: 5 HIGH CVEs including SSRF (WebSocket), DoS (Server Components ×2), Middleware bypass (i18n), and RSC HTTP deserialization DoS. **Next.js is pinned to 14 with no `^`/`~`, meaning it will not auto-update.** Must manually bump to ≥15.5.16.
- `@xmldom/xmldom`: 5 XML injection/DoS CVEs — all transitive through Expo. Fixed by upgrading Expo SDK.
- `glob`: Command injection in CLI mode — transitive dev-tool dep. Low runtime risk but should be cleared.
- `serialize-javascript`: RCE via RegExp — transitive in `@ducanh2912/next-pwa` (a community fork).

### Moderate — 14

| CVE/Advisory | Package | Affected Range | Fixed In | Introduced Via |
|---|---|---|---|---|
| GHSA-ffhc-5mcf-pf4q | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-gx5p-jg67-6x7h | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-h64f-5h5j-jqjh | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-wfc6-r584-vfw7 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-9g9p-9gw9-jx7f | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-ggv3-7p47-pfv8 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-3x4c-7xq6-9pq8 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-2g4f-4pwh-qvx6 | `ajv` | >=7.0.0-alpha.0 <8.18.0 | 8.18.0 | eslint, expo-dev-client, expo-router, next-pwa, @remotion/cli, @sentry/nextjs |
| GHSA-qx2v-qp2m-jg93 | `postcss` | <8.5.10 | 8.5.10 | apps/web (direct), next, tailwindcss, @vitejs/plugin-react, vitest |
| GHSA-4w7w-66w2-5vf9 | `vite` | <=6.4.1 | 6.4.2 | `apps/web → @vitejs/plugin-react`, `apps/mobile → vitest` |
| GHSA-58qx-3vcg-4xpx | `ws` | >=8.0.0 <8.20.1 | 8.20.1 | react-native, expo, @remotion/cli |
| GHSA-67mh-4wv8-2f99 | `esbuild` | <=0.24.2 | 0.24.3 | drizzle-kit, @remotion/cli, @vitejs/plugin-react, vitest, tailwindcss |
| GHSA-gh4j-gqv2-49f6 | `fast-xml-parser` | <5.7.0 | 5.7.0 | react-native, @aws-sdk/client-cognito-identity-provider, @aws-sdk/client-rds-data |
| GHSA-qj8w-gfj5-8c6v | `serialize-javascript` | <=7.0.2 | 7.0.3 | `apps/web → @ducanh2912/next-pwa` |

### Low — 4

| CVE/Advisory | Package | Affected Range | Fixed In | Introduced Via |
|---|---|---|---|---|
| GHSA-3g8h-86w9-wvmq | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-vfv6-92ff-j949 | `next` | >=13.0.0 <15.5.16 | 15.5.16 | `apps/web` |
| GHSA-8fgc-7cc6-rx7x | `webpack` | >=5.49.0 <=5.104.0 | 5.104.1 | @ducanh2912/next-pwa, @remotion/cli, @sentry/nextjs |
| GHSA-38r7-794h-5758 | `webpack` | >=5.49.0 <=5.104.0 | 5.104.1 | @ducanh2912/next-pwa, @remotion/cli, @sentry/nextjs |

---

## Outdated by Workspace

### Root (`carecompanion-monorepo`)

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| knip (dev) | 6.14.0 | 6.14.1 | 6.14.1 | patch |
| lint-staged (dev) | 16.4.0 | 16.4.0 | 17.0.5 | **major** |
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |

### `apps/web`

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| @ai-sdk/google | 3.0.74 | 3.0.75 | 3.0.75 | patch |
| @ai-sdk/react | 3.0.185 | 3.0.187 | 3.0.187 | patch |
| @aws-sdk/client-cognito-identity-provider | 3.1048.0 | 3.1049.0 | 3.1049.0 | patch |
| @aws-sdk/client-rds-data | 3.1048.0 | 3.1049.0 | 3.1049.0 | patch |
| ai | 6.0.183 | 6.0.185 | 6.0.185 | patch |
| date-fns | 4.1.0 | 4.2.1 | 4.2.1 | minor |
| framer-motion | 11.18.2 | 11.18.2 | 12.39.0 | **major** |
| **next** | **14.2.35** | **14.2.35** | **16.2.6** | **major ×2 — CVEs** |
| posthog-js | 1.373.5 | 1.374.2 | 1.374.2 | patch |
| **react** | **18.3.1** | **18.3.1** | **19.2.6** | **major** |
| **react-dom** | **18.3.1** | **18.3.1** | **19.2.6** | **major** |
| @types/node (dev) | 20.19.41 | 20.19.41 | 25.9.0 | **major** |
| @types/react (dev) | 18.3.28 | 18.3.28 | 19.2.14 | **major** |
| @types/react-dom (dev) | 18.3.7 | 18.3.7 | 19.2.3 | **major** |
| eslint (dev) | 8.57.1 | 8.57.1 | 10.4.0 | **major** |
| eslint-config-next (dev) | 14.2.35 | 14.2.35 | 16.2.6 | **major** |
| knip (dev) | 6.14.0 | 6.14.1 | 6.14.1 | patch |
| tailwindcss (dev) | 3.4.19 | 3.4.19 | 4.3.0 | **major** |
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |

> `next` is pinned without `^` — it will never auto-update via `bun update`. Must be manually bumped.
> `eslint-config-next` is also pinned to 14.2.35 and must move in lockstep with `next`.

### `apps/mobile`

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| @expo/metro-runtime | 4.0.1 | 4.0.1 | 55.0.11 | **major** |
| @expo/vector-icons | 14.0.4 | 14.0.4 | 15.1.1 | **major** |
| @react-native-async-storage/async-storage | 1.23.1 | 1.23.1 | 3.0.2 | **major** |
| @sentry/react-native | 6.22.0 | 6.22.0 | 8.11.1 | **major** |
| **expo (SDK)** | **52.0.49** | **52.0.49** | **55.0.24** | **major ×3** |
| expo-apple-authentication | 7.1.3 | 7.1.3 | 55.0.13 | **major** |
| expo-asset | 11.0.5 | 11.0.5 | 55.0.17 | **major** |
| expo-auth-session | 6.0.3 | 6.0.3 | 55.0.16 | **major** |
| expo-background-fetch | 13.0.6 | 13.0.6 | 55.0.16 | **major** |
| expo-blur | 14.0.3 | 14.0.3 | 55.0.14 | **major** |
| expo-camera | 16.0.18 | 16.0.18 | 55.0.18 | **major** |
| expo-constants | 17.0.8 | 17.0.8 | 55.0.16 | **major** |
| expo-crypto | 14.0.2 | 14.0.2 | 55.0.15 | **major** |
| expo-dev-client | 5.0.20 | 5.0.20 | 55.0.34 | **major** |
| expo-device | 7.0.3 | 7.0.3 | 55.0.17 | **major** |
| expo-haptics | 14.0.1 | 14.0.1 | 55.0.14 | **major** |
| expo-image-picker | 16.0.6 | 16.0.6 | 55.0.20 | **major** |
| expo-linear-gradient | 14.0.2 | 14.0.2 | 55.0.14 | **major** |
| expo-linking | 7.0.5 | 7.0.5 | 55.0.15 | **major** |
| expo-notifications | 0.29.14 | 0.29.14 | 55.0.23 | **major** |
| expo-router | 4.0.22 | 4.0.22 | 55.0.14 | **major** |
| expo-secure-store | 13.0.2 | 13.0.2 | 55.0.14 | **major** |
| expo-sensors | 14.0.2 | 14.0.2 | 55.0.15 | **major** |
| expo-system-ui | 4.0.9 | 4.0.9 | 55.0.18 | **major** |
| expo-task-manager | 12.0.6 | 12.0.6 | 55.0.16 | **major** |
| expo-updates | 0.27.5 | 0.27.5 | 55.0.22 | **major** |
| posthog-react-native | 3.16.1 | 3.16.1 | 4.45.10 | **major** |
| react | 18.3.1 | 18.3.1 | 19.2.6 | **major** |
| react-dom | 18.3.1 | 18.3.1 | 19.2.6 | **major** |
| react-native | 0.76.5 | 0.76.5 | 0.85.3 | minor (breaking) |
| react-native-reanimated | 3.16.7 | 3.16.7 | 4.3.1 | **major** |
| react-native-safe-area-context | 4.12.0 | 4.12.0 | 5.8.0 | **major** |
| react-native-screens | 4.0.0 | 4.0.0 | 4.25.1 | minor |
| react-native-shake | 5.6.2 | 5.6.2 | 6.8.5 | **major** |
| react-native-web | 0.19.13 | 0.19.13 | 0.21.2 | minor |
| @types/react (dev) | 18.3.28 | 18.3.28 | 19.2.14 | **major** |
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |
| vitest (dev) | 2.1.9 | 2.1.9 | 4.1.6 | **major** |

> All Expo packages must move together — they are SDK-versioned. SDK 52 → SDK 55 is a coordinated upgrade; do not bump individual packages in isolation. Assign to Shreyash (mobile owner).

### `apps/video`

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| @remotion/cli | 4.0.290 | 4.0.290 | 4.0.462 | patch (within v4) |
| remotion | 4.0.290 | 4.0.290 | 4.0.462 | patch (within v4) |
| react | 18.3.1 | 18.3.1 | 19.2.6 | **major** |
| react-dom | 18.3.1 | 18.3.1 | 19.2.6 | **major** |
| @types/react (dev) | 18.3.28 | 18.3.28 | 19.2.14 | **major** |
| @types/react-dom (dev) | 18.3.7 | 18.3.7 | 19.2.3 | **major** |
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |

> `remotion` and `@remotion/cli` must be bumped together. The 4.0.x series has ~172 patch releases since 4.0.290.

### `packages/api`

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |
| vitest (dev) | 2.1.9 | 2.1.9 | 4.1.6 | **major** |

### `packages/design-tokens`

| Package | Current | Latest | Type |
|---|---|---|---|
| typescript (dev) | 5.9.3 | 6.0.3 | **major** |

### `packages/types`

| Package | Current | Latest | Type |
|---|---|---|---|
| typescript (dev) | 5.9.3 | 6.0.3 | **major** |

### `packages/utils`

| Package | Current | Compatible Update | Latest | Type |
|---|---|---|---|---|
| date-fns | 4.1.0 | 4.2.1 | 4.2.1 | minor |
| zod | 3.25.76 | 3.25.76 | 4.4.3 | **major** |
| typescript (dev) | 5.9.3 | 5.9.3 | 6.0.3 | **major** |
| vitest (dev) | 2.1.9 | 2.1.9 | 4.1.6 | **major** |

> **`zod` version mismatch**: `packages/utils` pins `^3.0.0` (resolved: 3.25.76) while `apps/web` uses `^4.3.6` (resolved: 4.4.3). This means the monorepo has two zod major versions in flight simultaneously. This should be unified to v4 across all packages when `packages/utils` is migrated.

---

## High-Impact Stale Deps

| Package | Workspace | Current | Latest | CVE Risk | Notes |
|---|---|---|---|---|---|
| **next** | apps/web | 14.2.35 | 16.2.6 | HIGH (×5) | Pinned without `^`. Two major versions behind. Fixes 12 known CVEs total. |
| **react / react-dom** | apps/web, apps/mobile, apps/video | 18.3.1 | 19.2.6 | None | Required for Next.js 15+/16. Concurrent mode APIs stable in v19. |
| **expo (SDK)** | apps/mobile | 52.0.49 | 55.0.24 | HIGH (indirect) | 3 SDK versions behind. Fixes tar, @xmldom/xmldom, and other transitive HIGH CVEs. |
| **ai (Vercel AI SDK)** | apps/web | 6.0.183 | 6.0.185 | None | Patch-only gap; safe to update. Active release cadence. |
| **@ai-sdk/anthropic** | apps/web | pinned ^3.0.64 | 3.x latest | None | Patch-level; doc-only guard prevents major bumps per session instructions. |
| **tailwindcss** | apps/web | 3.4.19 | 4.3.0 | None | Tailwind v4 is a complete rewrite (no config file, Lightning CSS). High migration effort. |
| **drizzle-orm** | apps/web | 0.45.2 | latest 0.x | None | Check for minor updates; schema changes require migration SQL. |
| **remotion / @remotion/cli** | apps/video | 4.0.290 | 4.0.462 | None | 172 patch releases; safe to bump within 4.x. |
| **@aws-sdk v3** | apps/web | 3.1048.x | 3.1049.x | None | Patch-level; weekly AWS SDK releases. |
| **postgres** | apps/web | ^3.4.9 | 3.x | None | Verify no breaking changes in any 3.x minor. |
| **next-auth** | apps/web | 5.0.0-beta.31 | beta ongoing | None direct | **Still in beta.** Auth.js v5 has been in beta for an extended period; monitor for stable release. |

---

## Deprecated Packages

| Package | Status | Used In | Replacement / Notes |
|---|---|---|---|
| `next-pwa` (original) | Archived/deprecated on npm | — (not directly in use) | The project uses `@ducanh2912/next-pwa`, an active community fork. However, this fork introduces `serialize-javascript` (RCE, HIGH) and `webpack` (SSRF, LOW) vulnerabilities. Consider evaluating whether PWA is still needed or migrating to Next.js native PWA features. |
| `next-auth@5.0.0-beta.*` | Pre-release / beta | `apps/web` | `auth.js` / `@auth/nextjs` stable release expected. Pinned to `-beta.31`; this is a production dependency on an unstable package. Monitor for GA. |
| `expo-live-activity@^0.4.2` | Unverified third-party | `apps/mobile` | Not an official Expo SDK package. Verify it's maintained and source is trusted before each SDK upgrade. |
| `@upstash/redis` | Active but sunset risk | `apps/web` | Vercel sunset their own KV product (`@vercel/kv` backed by Upstash). Upstash SDK itself remains supported. No action needed now, but watch for changes. |
| `eslint@8` | ESLint 8 reached EOL | `apps/web` | ESLint 9+ uses the flat config format. Upgrade requires rewriting `.eslintrc`. Deferred but planned. |

---

## Recommended Bump Plan (Minor/Patch First)

These changes carry minimal to no breaking risk and can be done in a single PR per workspace.

### Immediate — Patch Bumps (no breaking changes)

**`apps/web`** (owner: Aryan):
```
@ai-sdk/google       3.0.74  → 3.0.75
@ai-sdk/react        3.0.185 → 3.0.187
@aws-sdk/client-cognito-identity-provider  3.1048.0 → 3.1049.0
@aws-sdk/client-rds-data                   3.1048.0 → 3.1049.0
ai                   6.0.183 → 6.0.185
posthog-js           1.373.5 → 1.374.2
knip (dev)           6.14.0  → 6.14.1
```

**`apps/video`**:
```
@remotion/cli   4.0.290 → 4.0.462
remotion        4.0.290 → 4.0.462
```

**Root**:
```
knip (dev)   6.14.0 → 6.14.1
```

### Soon — Minor Bumps (semver-compatible, low risk)

**`apps/web` + `packages/utils`**:
```
date-fns   4.1.0 → 4.2.1
```

**`apps/mobile`** (owner: Shreyash):
```
react-native-screens   4.0.0 → 4.25.1   (minor within 4.x)
react-native-web       0.19.13 → 0.21.2  (minor within 0.x)
```

### Recommended but Verify — Security Patches via Dev-Tool Upgrades

The following vuln-carrying transitive deps (`postcss`, `vite`, `esbuild`) can be resolved by updating the direct dev tools that bring them in:

| Vuln Package | Fixed By Updating | Direct Dep |
|---|---|---|
| `postcss <8.5.10` | `tailwindcss` or `postcss` direct → latest 3.x patch | `apps/web` (also add `postcss` override if needed) |
| `vite <=6.4.1` | `@vitejs/plugin-react ^6.0.x` → >=6.0.2 | `apps/web` |
| `esbuild <=0.24.2` | Update `drizzle-kit` to latest 0.31.x; update `vitest` if v2 patch is available | `apps/web` |

---

## Risky Major Bumps (Deferred)

These require dedicated planning, migration guides, and cross-team coordination.

| Package | Current | Target | Risk Level | Blocker / Notes |
|---|---|---|---|---|
| **next** | 14.2.35 | ≥15.5.16 (or 16.x) | CRITICAL-RISK but CRITICAL-REWARD | Fixes 12 CVEs including 5 HIGH. App Router APIs changed; `middleware.ts` → verify `proxy.ts` compatibility; `next/server` edge runtime changes. Requires React 19 for Next.js 16. **Top priority upgrade despite complexity.** |
| **react / react-dom** | 18.3.1 | 19.x | High | Must accompany Next.js 15/16. Breaking: `ReactDOM.render` removed, act() changes, StrictMode double-invoke. |
| **eslint** | 8.57.1 | 9+ or 10+ | High | Flat config format (eslint.config.js); all plugins must support flat config. Requires rewriting `.eslintrc*`. |
| **tailwindcss** | 3.4.19 | 4.x | High | Complete config format rewrite. CSS-first config, no `tailwind.config.js`. Very high migration effort. |
| **expo (SDK)** | 52.0.49 | 55.x | High | Assign to Shreyash. Use `npx expo-doctor` + `npx expo install --fix` for guided migration. All expo-* packages must move together. Resolves 11 HIGH CVEs transitively. |
| **react-native** | 0.76.5 | 0.85.3 | High | RN new architecture required for Expo 55. Coordinate with Expo SDK upgrade. |
| **react-native-reanimated** | 3.16.7 | 4.x | High | New animation architecture; some APIs changed. Must upgrade with RN + Expo together. |
| **typescript** | 5.9.3 | 6.0.3 | Medium | TypeScript 6 removes some older config options; strictness changes. Audit `tsconfig.json` files before bumping. |
| **vitest** | 2.1.9 | 4.1.6 | Medium | Skips v3; config format changed in v3+. Review `vitest.config.ts` files. |
| **framer-motion** | 11.18.2 | 12.x | Medium | Some animation API changes. Audit motion components in `apps/web/src/components/`. |
| **zod** (`packages/utils`) | 3.25.76 | 4.x | Medium | Breaking API changes in refinements and transform. Also resolves the v3/v4 split across the monorepo (web already on v4). Coordinate with utils consumers. |
| **@react-native-async-storage/async-storage** | 1.23.1 | 3.x | Medium | Async API changes; check for breaking removals. |
| **posthog-react-native** | 3.16.1 | 4.x | Low-Medium | Analytics SDK; verify event names and capture API unchanged. |
| **lint-staged** | 16.4.0 | 17.x | Low | Check changelog for hook format changes. |
| **@sentry/nextjs** | 10.50.0 (approx) | 10.x latest | Low | Patch/minor gap likely; verify Sentry SDK changelog. |
| **@types/node** | 20.19.41 | 25.x | Low | Types-only; safe to update but may expose new TS errors in server-side code. |

---

## Additional Notes

1. **`next` is pinned without range operator**: `"next": "14.2.35"` in `apps/web/package.json`. This means `bun update` will NOT touch it. The fix requires a manual edit of `package.json` — this is intentional per no-auto-bump policy, but must be tracked.

2. **`zod` version split**: `packages/utils` uses `^3.0.0` while `apps/web` uses `^4.3.6`. Two major versions in the same monorepo introduces subtle type incompatibilities if zod-validated types flow between packages. Unify to v4 when upgrading `packages/utils`.

3. **`next-auth` in beta**: `^5.0.0-beta.31` is a production dependency. No known active CVEs, but a beta package in production is inherently higher risk. Monitor for stable GA release.

4. **`@ducanh2912/next-pwa` vulnerability footprint**: This single package brings in 4 CVEs (serialize-javascript HIGH, serialize-javascript moderate, webpack LOW ×2). Evaluate whether PWA manifest + service worker is actively used; if not, removing this package clears those 4 CVEs immediately.

5. **`expo-live-activity`**: Not part of the official Expo SDK. Must be manually vetted on each Expo SDK upgrade to ensure compatibility.

6. **AWS SDK patch cadence**: AWS SDK v3 packages (`@aws-sdk/*`) release weekly patches. The current gap is 1 patch version — low risk but should be included in any routine update pass.
