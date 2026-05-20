# TypeScript Strictness Report

**Branch:** `aryan/feature/ts-strictness`  
**Date:** 2026-05-19  
**Scope:** `apps/web/src/lib/`, `packages/*/src/`

---

## Changes Applied

| Category | Count |
|---|---|
| `any` → `unknown` replacements | 0 |
| Return types added to exported functions | 5 |

---

## Return Types Added

### `apps/web/src/lib/checkin-validation.ts`
- `validateCheckin(data: unknown)` → added `ReturnType<typeof checkinSchema.safeParse>`

### `apps/web/src/lib/api-helpers.ts`
- `getAuthenticatedUser()` → added `Promise<{ user: typeof users.$inferSelect; error: null } | { user: null; error: NextResponse }>`

### `apps/web/src/lib/analytics.ts`
- `initAnalytics()` → added `: void`

### `apps/web/src/lib/logger.ts`
- `logger.debug(...)` → added `: void`
- `logger.info(...)` → added `: void`
- `logger.warn(...)` → added `: void`
- `logger.error(...)` → added `: void`

---

## Files Touched

- `apps/web/src/lib/checkin-validation.ts`
- `apps/web/src/lib/api-helpers.ts`
- `apps/web/src/lib/analytics.ts`
- `apps/web/src/lib/logger.ts`

---

## Skipped Items

### `any` → `unknown` (none found)
Grep and Explore agent confirmed zero explicit `: any` or `any[]` in function parameter positions across `apps/web/src/lib/` and `packages/*/src/`. The codebase already uses `unknown` for external input and typed parameters everywhere.

### `apps/web/src/lib/tools.ts` — `buildTools` return type
The return type of `buildTools` is a deeply nested object of Vercel AI SDK `CoreTool` instances spanning ~700 lines. Writing the full type inline would add more noise than value. Recommend exporting `export type CareCompanionTools = ReturnType<typeof buildTools>` as a named type alias in a follow-up.

### `apps/web/src/lib/api-response.ts` — `ApiErrors` const
`ApiErrors` is a const object whose methods call the already-typed `apiError` function. TypeScript correctly infers each method's return type as `NextResponse<ApiResponse<never>>`. Adding an explicit type annotation requires either exporting the internal `ApiResponse` type or using `ReturnType<typeof apiError>` repetitively. Low ROI — skip for now.

### `packages/api/src/client.ts` — `createApiClient` return type
`createApiClient` already has `export type ApiClient = ReturnType<typeof createApiClient>` on line 527. Adding `: ApiClient` as the return type annotation would create a circular type reference (the alias depends on the function, the function would depend on the alias). The existing pattern is idiomatic and sufficient.

---

## Recommended Config Changes (human review — not auto-applied)

These tsconfig flags are safe to enable incrementally. Each one should be enabled in isolation with a dedicated typecheck+fix pass.

### 1. `"noUncheckedIndexedAccess": true`
Adds `T | undefined` to array index and record access results. This is the highest-value strictness flag not yet enabled. Catches many latent bugs around `arr[0]` being used without a null check.  
**Risk:** Medium. Will surface many `.map`, `.find`, and `Record` access sites that need guarding. Recommend tackling `apps/web/src/lib/` first.

### 2. `"exactOptionalPropertyTypes": true`
Prevents assigning `undefined` explicitly to optional properties (`{ foo?: string }` no longer accepts `{ foo: undefined }`).  
**Risk:** Low-medium. May affect Drizzle ORM insert/update patterns that spread optional fields.

### 3. `"noImplicitOverride": true`
Requires `override` keyword on class methods that shadow a parent. Zero risk for this codebase (minimal class inheritance), easy win.

### 4. `"noPropertyAccessFromIndexSignature": true`
Requires bracket notation (`obj['key']`) when accessing index signature properties. Improves readability of intent.  
**Risk:** Low. Purely syntactic — no logic changes needed.

### 5. Enable `@typescript-eslint/explicit-module-boundary-types`
Rather than adding return types manually file-by-file, enabling this ESLint rule will enforce return types on all exported functions automatically at lint time. Pair with the existing strict tsconfig for maximum coverage.
