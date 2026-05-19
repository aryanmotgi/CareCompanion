# Performance Baseline — CareCompanion
_Static scan, no live site. Date: 2026-05-19._

---

## Web Anti-patterns

### Raw `<img>` (missing `next/image`)
No violations found. All image tags use `next/image`. ✅

### Missing `next/font` (raw Google Fonts `<link>`)
No violations found. `layout.tsx` and `one-pager/page.tsx` both import from `next/font/google`. ✅

### Client Components that should be Server Components
| File | Line | Issue | Fix |
|---|---|---|---|
| `apps/web/src/app/about/page.tsx` | 1 | Entire page is `'use client'` only to run an IntersectionObserver for scroll-reveal animation | Extract `useScrollReveal` into a tiny `<ScrollRevealWrapper>` client component; make the page itself a Server Component |
| `apps/web/src/app/contact/page.tsx` | 1 | Same scroll-reveal pattern, no other client needs | Same extraction |
| `apps/web/src/app/privacy/page.tsx` | 1 | Same scroll-reveal pattern on fully static content | Same extraction |
| `apps/web/src/app/terms/page.tsx` | 1 | Same scroll-reveal pattern on fully static content | Same extraction |
| `apps/web/src/app/page.tsx` | 1 | Entire landing page (47+ state/effect calls) is one giant client component | Split static hero, features, footer into Server Components; keep animated demo + typewriter + FAQ as client islands |
| `apps/web/src/app/(app)/community/page.tsx` | 1 | Client component that fetches via `useEffect`; could be a Server Component shell that prefetches posts | Move initial fetch to a Server Component; keep create-post modal + pagination as a narrow client island |
| `apps/web/src/app/(app)/community/[id]/page.tsx` | 1 | `'use client'` with `use(params)` to unwrap params; all data fetched client-side via `useEffect` | Remove `'use client'`; use async Server Component; keep upvote/reply actions in a `CommunityPostActions` client component |

### Missing `loading.tsx` for slow routes
Routes that execute multiple DB queries but have no `loading.tsx`:

| Route | Issue |
|---|---|
| `(app)/appointments/` | 3 sequential DB queries, no loading skeleton |
| `(app)/health-summary/` | 3+ DB queries, no loading skeleton |
| `(app)/journal/` | Data-fetching route, no loading skeleton |
| `(app)/trials/` | DB + potential AI matching latency, no loading skeleton |
| `(app)/calendar/` | No loading skeleton |
| `(app)/care-team/` | No loading skeleton |
| `(app)/community/` | No loading skeleton (client-fetched so less critical, but shell still flashes) |
| `(app)/community/[id]/` | No loading skeleton |
| `(app)/profile/edit/` | No loading skeleton |
| `(app)/emergency/` | No loading skeleton |
| `(app)/upload/` | No loading skeleton |
| `(app)/sync-status/` | No loading skeleton |
| `login/`, `signup/`, `reset-password/` | Public auth flows have no loading states |

**Fix:** Add a `loading.tsx` returning a skeleton `<div>` next to each `page.tsx`. Existing good examples: `dashboard/loading.tsx`, `labs/loading.tsx`, `timeline/page.tsx` (`TimelineLoading` component).

### Missing Suspense boundaries around data fetches
| File | Line | Issue | Fix |
|---|---|---|---|
| `apps/web/src/app/(app)/appointments/page.tsx` | 8 | Async server page fetches 3 DB tables sequentially; no Suspense wrapping | Extract data-fetching into `<AppointmentsData>` async component; wrap with `<Suspense fallback={<AppointmentsSkeleton />}>` like `timeline/page.tsx` does |
| `apps/web/src/app/(app)/health-summary/page.tsx` | 8 | Same — bare async page | Same pattern |
| `apps/web/src/app/(app)/medications/page.tsx` | 8 | Same — bare async page | Same pattern |
| `apps/web/src/app/(app)/trials/page.tsx` | 8 | Same — bare async page | Same pattern |

**Good existing patterns:** `timeline/page.tsx`, `labs/page.tsx`, `settings/page.tsx`, `care/page.tsx`, `scans/page.tsx` all use the extract-and-suspend pattern correctly. Apply consistently.

### Synchronous fetch without cache hints
All data fetching in Server Components uses Drizzle ORM directly (no `fetch()`), so no missing `cache:` config issues at the data layer. ✅

Client-side `fetch()` calls (community page, consent page) are inside event handlers/effects — cache config is not applicable there.

### `force-dynamic` overuse
| File | Line | Issue | Fix |
|---|---|---|---|
| `apps/web/src/app/shared/[token]/page.tsx` | 7 | `force-dynamic` on a public share page; every render is a full SSR round-trip | Replace with `export const revalidate = 60` (or ISR) if share data changes infrequently; use `force-dynamic` only if realtime accuracy is essential |

API routes (`/api/checkins`, `/api/chat`, etc.) also carry `force-dynamic` but API routes are already dynamic by default — this is redundant noise, not a perf bug. Safe to remove for cleanliness.

---

## Runtime Perf Risks

### `useEffect` with non-empty deps that allocate objects/arrays inline
| File | Line | Issue | Fix |
|---|---|---|---|
| `apps/web/src/app/page.tsx` | 162 | `useState({ x: 3, y: -5 })` — object literal. If this ever appears in a dep array it creates a new reference every render | Convert to two primitive `useState` values: `useTiltX`, `useTiltY` |
| `apps/web/src/app/page.tsx` | 68–100 | Multiple `useEffect` hooks with `setTimeout` cascades driving typewriter + screen-cycler animations on the landing page; each re-render restarts timers | Consolidate into a single `useReducer`-driven animation state machine to avoid redundant effect churn |

### `useState` initializers that run on every render
No violations of the lazy-init pattern found (all initializers are primitive literals or empty containers). ✅

### Components rendering large lists without virtualization
| File | Lines | Issue | Fix |
|---|---|---|---|
| `apps/web/src/app/(app)/community/page.tsx` | 364 | `posts.map()` rendered inside a plain `div` with infinite scroll; no windowing | Add `react-virtual` or swap to a paginated pattern; add `key` with stable post ID |
| `apps/web/src/app/(app)/community/[id]/page.tsx` | 268 | `replies.map()` can grow unbounded | Paginate replies; add virtualization for threads with many replies |

---

## Mobile Anti-patterns

### `FlatList` vs `ScrollView` for long lists
| File | Lines | Issue | Fix |
|---|---|---|---|
| `apps/mobile/app/(tabs)/community.tsx` | 242, 350 | `ScrollView` wrapping `posts.map()` — entire list mounts at once | Replace with `FlatList`; add `keyExtractor`, `initialNumToRender={10}` |
| `apps/mobile/app/appointments.tsx` | 358, 445 | `ScrollView` wrapping `upcoming.map()` and `past.map()` — no ceiling on list size | Replace with `SectionList` (sections: upcoming / past) |
| `apps/mobile/app/notifications.tsx` | 160 | `ScrollView` wrapping `notifications.map()` | Replace with `FlatList` |
| `apps/mobile/app/(tabs)/labs.tsx` | 144 | `ScrollView` wrapping `abnormal.map()` + `normal.map()` | Replace with `SectionList` (abnormal / normal sections) |
| `apps/mobile/app/(tabs)/trials.tsx` | 310 | `ScrollView` wrapping `matched.map()` + `close.map()` | Replace with `SectionList` |
| `apps/mobile/app/timeline.tsx` | 40 | `ScrollView` wrapping timeline events | Replace with `FlashList` (from `@shopify/flash-list`) for smoother large histories |

### `FlatList` missing optimization props
| File | Lines | Issue | Fix |
|---|---|---|---|
| `apps/mobile/app/(tabs)/chat.tsx` | 746, 804, 854 | Three `FlatList` instances (suggestions, history, messages) missing `initialNumToRender`, `windowSize`, `maxToRenderPerBatch`, `removeClippedSubviews` | Add `initialNumToRender={20}`, `windowSize={5}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}` to the messages list |

### `Image` without `resizeMode` / cache hints
| File | Line | Issue | Fix |
|---|---|---|---|
| `apps/mobile/app/(tabs)/scan.tsx` | 142 | `<Image source={{ uri: capturedImage }} style={styles.capturedImage} />` — no `resizeMode` | Add `resizeMode="cover"` (or `"contain"` depending on design intent) |

---

## Config Recommendations

### `apps/web/next.config.mjs`
| Issue | Fix |
|---|---|
| No `images` block at all | Add `images: { formats: ['image/avif', 'image/webp'], remotePatterns: [...] }`. AVIF gives ~20% better compression than WebP. |
| No `experimental.optimizePackageImports` | Add `experimental: { optimizePackageImports: ['date-fns', 'lucide-react', '@radix-ui/react-icons'] }` to tree-shake icon/utility libs at compile time. |
| No Turbopack config | Add `turbopack: {}` under `experimental` (Next 16+) to speed up local dev rebuilds. |
| `aggressiveFrontEndNavCaching: true` in `@ducanh2912/next-pwa` | Review intent. Aggressive nav caching can serve stale HTML across deploys if SW cache busting is not wired to build hash. Ensure `cacheId` or `buildExcludes` are set. |
| No `compress` key | Explicit `compress: true` documents intent; harmless but clarifies that Gzip/Brotli is enabled. |
| No `output: 'standalone'` | If deploying to containers (non-Vercel), add `output: 'standalone'` to cut Docker image size by ~80%. Skip if on Vercel. |

---

## Top 10 Wins by Estimated Impact

| # | Win | Estimated Impact | Effort |
|---|---|---|---|
| 1 | Add `loading.tsx` to `appointments`, `health-summary`, `medications`, `trials` routes | Eliminates blank-page flash (~500ms perceived) on every navigation to these core routes | Low (copy existing skeleton pattern) |
| 2 | Wrap async page data in `<Suspense>` (appointments, health-summary, medications, trials) | Enables streaming; first byte arrives before DB queries finish | Low (follow `timeline/page.tsx` pattern) |
| 3 | Convert `community/[id]/page.tsx` to a Server Component | Removes client-side waterfall fetch on post load; improves LCP on community posts | Medium |
| 4 | Split `about`, `contact`, `privacy`, `terms` pages — extract scroll-reveal into `<RevealWrapper>` | Turns 4 static pages from client bundles into zero-JS Server Components; reduces JS parse time | Low |
| 5 | Replace `ScrollView` + `.map()` with `FlatList`/`SectionList` in community, appointments, notifications, labs, trials (mobile) | Prevents full list mount; removes jank on screens with 20+ items | Medium |
| 6 | Add `images.formats: ['image/avif', 'image/webp']` to `next.config.mjs` | AVIF reduces image payload ~20% vs WebP; immediate win for any page with `next/image` | Low (1 config line) |
| 7 | Add `experimental.optimizePackageImports` for `date-fns`, `lucide-react` | Cuts JS bundle by 15–30 kB for icon-heavy pages | Low (2 config lines) |
| 8 | Add `removeClippedSubviews`, `windowSize`, `maxToRenderPerBatch` to chat `FlatList` | Reduces memory pressure and frame drops during chat scroll | Low |
| 9 | Evaluate `force-dynamic` removal on `shared/[token]/page.tsx` → ISR `revalidate=60` | Turns every share-link visit from a full SSR into a cached edge response | Low–Medium |
| 10 | Consolidate landing page (`page.tsx`) animation `useEffect` cascade into a `useReducer` state machine | Eliminates redundant re-renders during the typewriter/demo cycle; reduces CPU use on landing page | Medium |

---

## Suggested Next Steps

1. **Set up Lighthouse CI** — Add `@lhci/cli` to the repo and run `lhci autorun` in CI on every PR targeting `main`. Gate on Performance ≥ 80, CLS ≤ 0.1, LCP ≤ 2.5 s. Config file: `lighthouserc.js`.

2. **Add `web-vitals` reporting** — Install `web-vitals` and wire `onCLS`, `onFID`, `onLCP`, `onFCP`, `onTTFB` into PostHog (already in the CSP allowlist) or Vercel Speed Insights to get real-user data rather than lab numbers.

3. **Bundle analysis** — Run `ANALYZE=true next build` (via `@next/bundle-analyzer`) and share the treemap. The landing page is a single `'use client'` component with 47+ hooks and likely pulls in heavy dependencies.

4. **React DevTools Profiler pass** — Profile the chat page and community feed in development to confirm the FlatList and list-rendering fixes actually reduce render counts.

5. **React Native Performance — FlashList migration** — Consider `@shopify/flash-list` as a drop-in FlatList replacement across all mobile list screens; it significantly outperforms FlatList for heterogeneous item heights (appointments, labs, community posts).

6. **DB query parallelisation audit** — Several server pages (`appointments/page.tsx`, `health-summary/page.tsx`) issue DB queries sequentially. `timeline/page.tsx` already shows the right pattern (`Promise.all`). Apply the same pattern to remaining pages.
