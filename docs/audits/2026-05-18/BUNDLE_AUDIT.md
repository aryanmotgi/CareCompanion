# Bundle Size Audit — apps/web

**Date:** 2026-05-18  
**Build status:** ✅ SUCCESS (`next build` completed with warnings)  
**Build command:** `ANTHROPIC_API_KEY="" ANTHROPIC_API_KEY_DISABLED=true npx next build`  
**Warning:** Sentry missing `global-error.js` handler (cosmetic, does not affect bundle).

---

## Summary

Build succeeded. The shared JS baseline is **166 kB** (all pages pay this cost). The two largest contributors to that baseline are chunk `3115` (108 kB) and chunk `1b4eeeea` (53.8 kB) — these contain framework, Next.js internals, framer-motion, and the Vercel AI SDK client runtime.

### Top 20 Pages by First Load JS

| Rank | Route | Page JS | First Load JS |
|------|-------|---------|---------------|
| 1 | `/dashboard` | 28.9 kB | **318 kB** |
| 2 | `/visit-prep` | 135 kB | **301 kB** |
| 3 | `/onboarding` | 66.8 kB | **298 kB** |
| 4 | `/labs` | 8.87 kB | **286 kB** |
| 5 | `/chat` | 10.3 kB | **233 kB** |
| 6 | `/chat/guest` | 5.39 kB | **226 kB** |
| 7 | `/signup` | 18.6 kB | **190 kB** |
| 8 | `/care` | 19.9 kB | **189 kB** |
| 9 | `/about` | 8.35 kB | **182 kB** |
| 10 | `/scans` | 6.08 kB | **182 kB** |
| 11 | `/settings` | 12.4 kB | **178 kB** |
| 12 | `/medications` | 4.88 kB | **177 kB** |
| 13 | `/login` | 5.08 kB | **177 kB** |
| 14 | `/terms` | 7.74 kB | **176 kB** |
| 15 | `/privacy` | 7.74 kB | **176 kB** |
| 16 | `/trials` | 9.92 kB | **176 kB** |
| 17 | `/insurance` | 3.97 kB | **176 kB** |
| 18 | `/community` | 3.9 kB | **176 kB** |
| 19 | `/care-hub` | 6.68 kB | **175 kB** |
| 20 | `/upload` | 8.15 kB | **174 kB** |

**Shared baseline by all pages:** 166 kB (framework 138 kB + chunk-3115 108 kB — but shared chunks are deduplicated on page load).

**Largest outliers above baseline:**
- `/visit-prep` +135 kB page JS → jsPDF bundled directly in client component (`VisitPrepView.tsx`)
- `/onboarding` +66.8 kB page JS → 18 framer-motion components statically imported in `OnboardingShell.tsx`
- `/dashboard` +28.9 kB page JS → large component tree with heavy deps
- `/labs` → recharts loaded via static import in `LabsView.tsx` (286 kB total, includes shared recharts chunk ~366 kB unminified)

---

## Heavy Dependencies

| Dependency | Est. min+gz size | Import count | Issue | Suggestion |
|------------|-----------------|--------------|-------|------------|
| `framer-motion` v11 | ~100 kB | 18 files | Entire library in shared chunk; loaded on every page | Use CSS animations or `motion/react` lazy bundle; dynamic-import animation wrappers only for onboarding/marketing routes |
| `recharts` v3 | ~80 kB | 2 files (`LabTrendChart`, `HealthDataChart`) | Ends up in large shared chunk (366 kB unmin) because both files are client components in the shared component tree | Dynamic-import `LabTrendChart`/`HealthDataChart`; they appear in non-critical paths |
| `jspdf` v4 | ~240 kB | 1 file (`VisitPrepView.tsx`) | Directly imported in a client component that is statically imported by `/visit-prep/page.tsx` — drives +135 kB page JS | Replace static `import jsPDF from 'jspdf'` with a dynamic import triggered only on PDF generation button click |
| `posthog-js` v1 | ~35 kB | 2 files (`lib/analytics.ts`, `lib/analytics/onboarding-events.ts`) | Bundled into client; appears in shared chunk via `onboardingAnalytics` import in `OnboardingShell.tsx` | Wrap posthog init behind `typeof window !== 'undefined'` + dynamic import; or use `@vercel/analytics` which is already present and lighter |
| `ai` (Vercel AI SDK) v6 | ~30 kB client | 2 client files (`ChatInterface.tsx`, `chat/guest/page.tsx`) | `DefaultChatTransport` from `'ai'` is imported in client components, pulling AI SDK runtime into browser bundle | This is expected for streaming chat; keep but verify tree-shaking is working (import only `{ useChat }` from `@ai-sdk/react`, not `DefaultChatTransport` unless needed) |
| `axios` v1 | ~13 kB | 1 file (`lib/trials/tools.ts`) | Server-side lib file; no client bundle impact — but unnecessary when `fetch` is available | Replace `axios` with native `fetch` in `tools.ts`; remove `axios` from `dependencies` |
| `date-fns` v4 | ~10 kB per fn | 2 files | Named imports `{ formatDistanceToNow }` — tree-shaking works correctly | No action needed; import pattern is correct |
| `@aws-sdk/client-cognito-identity-provider` | ~200 kB server | 4 API route files | Server-only (API routes) — no client bundle impact | No action needed |
| `@aws-sdk/client-rds-data` | ~180 kB server | `lib/db/index.ts` | Server-only — no client bundle impact | No action needed |
| `web-push` v3 | ~15 kB server | `lib/push.ts` | Server-only — no client bundle impact | No action needed |
| `qrcode.react` v4 | ~10 kB | `QRCodePanel.tsx` (client) | Only used in care-group flow — currently loads with `CareGroupScreen` | Dynamic-import `QRCodePanel` inside `CareGroupScreen`; it's conditionally rendered |
| `@sentry/nextjs` v10 | ~40 kB | Instrumentation files | Missing `global-error.js` handler (warning at build time) | Add `apps/web/src/app/global-error.tsx` with Sentry instrumentation |
| `bcryptjs` v3 | ~25 kB server | 6 API route files + 2 lib files | Server-only — no client bundle impact | No action needed |

---

## Import Anti-patterns

| File | Line | Pattern | Fix |
|------|------|---------|-----|
| `src/lib/__tests__/extract.test.ts` | 2 | `import * as ai from 'ai'` | Test file only — low priority; use named imports in tests |
| `src/lib/db/index.ts` | 3 | `import * as schema from './schema'` | Acceptable for Drizzle ORM schema registration; no bundle impact (server-only) |
| `src/lib/__tests__/memory.snapshot.test.ts` | 2 | `import * as MemoryBefore from '@/lib/memory'` | Test file only — low priority |
| `src/components/OnboardingShell.tsx` | 5–17 | 12 framer-motion components imported statically inside a client component | Each of these (WelcomeCarousel, HealthConsent, etc.) loads framer-motion eagerly; defer with `dynamic()` for steps not immediately visible |
| `src/components/VisitPrepView.tsx` | 6 | `import jsPDF from 'jspdf'` | 240 kB library loaded on page mount; move to `const { default: jsPDF } = await import('jspdf')` inside the PDF generation handler |
| `src/components/LabTrends.tsx` | (static import of recharts) | Recharts statically imported via `LabTrends` → `LabTrendChart` → `recharts` | `LabTrends` is already dynamic in `CareView.tsx` but is static in `LabsView.tsx` — add dynamic import |
| `src/lib/trials/tools.ts` | 1 | `import axios from 'axios'` | Replace with `fetch`; `axios` adds 13 kB for no benefit on a server-side lib |
| `src/lib/analytics/onboarding-events.ts` | 5 | `import posthog from 'posthog-js'` | posthog-js (~35 kB) is pulled into the onboarding client bundle; lazy-init or replace with `@vercel/analytics` events |

---

## Client Bundle Pollution

No server-only secrets or credentials leaked to client. AWS SDK, bcryptjs, resend, web-push, jose, and database code all appear exclusively in `/api/` routes or `lib/` files without `'use client'` consumers.

One borderline case:
- `src/components/ChatInterface.tsx` (client) imports `{ DefaultChatTransport } from 'ai'`. The `ai` package is designed for universal use and its client entrypoint is tree-shakable. However, `DefaultChatTransport` is a concrete class that adds overhead beyond what `useChat` from `@ai-sdk/react` requires. Verify whether `DefaultChatTransport` can be replaced with the simpler fetch transport built into `useChat`.

---

## Recommended Dynamic Imports (Top 10)

Priority ordered by estimated bundle impact:

1. **`jspdf` in `VisitPrepView.tsx`** — Move to dynamic import inside the PDF button handler. Saves ~135 kB from `/visit-prep` page JS.
   ```ts
   // Before
   import jsPDF from 'jspdf';
   // After (inside async handler only)
   const { default: jsPDF } = await import('jspdf');
   ```

2. **`LabTrends` / `LabTrendChart` in `LabsView.tsx`** — Already dynamically imported in `CareView.tsx`; replicate for `LabsView`.
   ```ts
   const LabTrends = dynamic(() => import('@/components/LabTrends').then(m => m.LabTrends));
   ```

3. **`WelcomeCarousel` in `OnboardingShell.tsx`** — Framer-motion heavy; loads before user interaction.
   ```ts
   const WelcomeCarousel = dynamic(() => import('./onboarding/WelcomeCarousel').then(m => m.WelcomeCarousel));
   ```

4. **`DisclaimerModal` in `OnboardingShell.tsx`** — Only shown conditionally; delay load.
   ```ts
   const DisclaimerModal = dynamic(() => import('./onboarding/DisclaimerModal').then(m => m.DisclaimerModal));
   ```

5. **`ShareInvite` in `OnboardingShell.tsx`** — Last onboarding step; no reason to load at page mount.
   ```ts
   const ShareInvite = dynamic(() => import('./onboarding/ShareInvite').then(m => m.ShareInvite));
   ```

6. **`QRCodePanel` in `CareGroupScreen.tsx`** — Conditionally rendered; dynamically import.
   ```ts
   const QRCodePanel = dynamic(() => import('./QRCodePanel').then(m => m.QRCodePanel));
   ```

7. **`HealthDataChart` in its consumers** — Recharts-based; lives in dashboard. Dynamic-import if not above the fold.
   ```ts
   const HealthDataChart = dynamic(() => import('./HealthDataChart').then(m => m.HealthDataChart));
   ```

8. **`HealthConsent` / `HealthConnect` in `OnboardingShell.tsx`** — Later onboarding steps using framer-motion; defer.

9. **`CareGroupScreen` in `OnboardingShell.tsx`** — Contains QRCodePanel; delay until care-group step is reached.

10. **posthog-js initialisation in `onboarding-events.ts`** — Wrap in `typeof window !== 'undefined'` guard and lazy-load:
    ```ts
    if (typeof window !== 'undefined') {
      const posthog = (await import('posthog-js')).default;
      posthog.capture(event, props);
    }
    ```

---

## Notes

- **`axios` removal** is the easiest win with zero user-visible impact — it's used in a single server-side file and can be replaced with `fetch`.
- **`jspdf` dynamic import** is the highest-impact single fix: it cuts `/visit-prep` from 135 kB page JS down to near-zero (load only on demand).
- **framer-motion tree-shaking** works when you import `{ motion }` — the library does support named exports. However, having 18 files pull from it means it's hoisted to the shared chunk, paying its cost on every route. Consider moving framer-motion components off critical paths (dashboard, login, medications) by only using it in routes where animation adds clear value (onboarding, marketing).
- The **166 kB shared baseline** is high; approximately 108 kB of it comes from chunk `3115` which includes Next.js internals and framework code. The remaining ~58 kB is framer-motion + AI SDK client runtime. Eliminating framer-motion from shared (by lazy-loading all motion wrappers) could reduce the shared baseline by an estimated 40–60 kB.
