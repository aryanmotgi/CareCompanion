# TODOS

Deferred work from gstack plan reviews. One item per section. Priority: P1 (blocking), P2 (next sprint), P3 (when data suggests).

---

## ~~[P1] Install @vercel/analytics~~ DONE

**What:** Add `@vercel/analytics` to package.json and wire `<Analytics />` into `src/app/layout.tsx`. Remove or convert the local stub at `src/lib/analytics.ts`.

**Why:** The funnel analytics spec uses `track()` from `@vercel/analytics`. The current `src/lib/analytics.ts` is a stub — all funnel events (`chat_started`, `conversion_banner_shown`, `signup_clicked`, etc.) silently no-op until this package is installed.

**Pros:** Unblocks all funnel measurement. One install + one layout line.

**Cons:** None. It's a Vercel first-party package with zero setup friction.

**Context:** This came up during the launch funnel redesign CEO review. Every analytics event in the spec depends on it. Do this before writing any `track()` calls.

**Effort:** S (human: ~30 min / CC: ~5 min)
**Priority:** P1 — prerequisite for all funnel analytics
**Depends on:** Nothing

---

## ~~[P1] Verify DB table name before building migrate-guest~~ DONE

**What:** Read `src/lib/db/schema.ts`, confirm the exact table name (Codex flagged `messages`, not `chat_messages`) and column list. Confirm whether a `source` column exists or needs a Drizzle migration. Update the CEO plan spec with the real column names.

**Why:** Writing the migrate-guest API against the wrong table name causes a runtime Drizzle error on first login. Subtle and confusing to debug.

**Pros:** 2-minute read eliminates an entire class of runtime bugs.

**Cons:** None.

**Context:** Codex review of the launch funnel plan flagged this discrepancy. The CEO plan now says "verify before building" but the actual verification hasn't happened yet.

**Effort:** S (human: ~10 min / CC: ~2 min)
**Priority:** P1 — must do before implementing migrate-guest
**Depends on:** Nothing. First task in migration implementation.

---

## ~~[P2] HIPAA ToS explicit acceptance on signup~~ DONE (shipped at P1 scope)

**What:** Add an explicit ToS + Privacy Policy acknowledgment to `LoginForm.tsx` before the Cognito OAuth redirect. Simplest form: a line of text "By continuing, you agree to our [Terms of Service] and [Privacy Policy]." with links. Optionally a checkbox for stronger legal posture.

**Why:** Currently ToS acceptance is implicit (clicking Sign In = acceptance). That's fine while guest chat is client-side only. Once the conversation migration ships, user messages are stored server-side on first login. Implicit acceptance for server-side storage of health conversations is a legal gray area.

**Pros:** Cleaner legal posture. Reassures privacy-conscious caregivers (cancer patients/caregivers are often privacy-aware). Small change.

**Cons:** Adds one more thing to the signup flow. Marginal friction.

**Context:** Flagged during the launch funnel CEO review. Not blocking Phase 1 launch, but should ship before Phase 2 (medication tracking), which stores more structured PHI-adjacent data.

**Effort:** M (human: ~2h / CC: ~10 min)
**Priority:** P2 — before Phase 2 medication tracking
**Depends on:** Conversation migration shipping first (no point before server-side storage exists)

---

## [P2] A/B test landing page CTA copy

**What:** Wire a simple variant system on the landing page primary CTA. Two variants minimum: current ("Ask your care question") vs. alternatives ("Get free cancer care guidance", "Talk to a cancer care AI"). Measure click-through to `/chat/guest` per variant using `@vercel/analytics` `track()`.

**Why:** CTA copy is one of the highest-leverage variables on a landing page. A 20% conversion lift from copy alone is realistic and free (no engineering cost at this point, just testing).

**Pros:** Data-driven optimization. Could meaningfully improve guest chat activation rate.

**Cons:** Results are noisy without 2+ weeks of baseline data. Building before baseline exists wastes the test.

**Context:** From the launch funnel CEO review. Explicitly deferred until analytics are installed and running for at least 2-4 weeks.

**Effort:** M (human: ~4h / CC: ~20 min)
**Priority:** P2 — after analytics baseline (2-4 weeks post-launch)
**Depends on:** @vercel/analytics installed + `chat_started` events firing

---

## [P3] Multi-session guest conversation migration

**What:** Instead of overwriting `sessionStorage['carecompanion_guest_chat']` on each message update, append sessions to a list. On migration, send all sessions and merge them chronologically before storing.

**Why:** The current plan migrates only the most recent guest session. If a user chatted on mobile and then desktop (or two browser tabs), only one session is preserved.

**Pros:** Full conversation history for users who use multiple sessions before signing up.

**Cons:** More complex storage pattern. More data to send to the migration API. Edge case at launch volume.

**Context:** Flagged during launch funnel review. Not needed at launch — revisit after first 100 users when you have data on whether multi-session behavior is actually happening.

**Effort:** M (human: ~3h / CC: ~15 min)
**Priority:** P3 — revisit after first 100 users
**Depends on:** Core conversation migration shipping first

---

## ~~[P1] Set up vitest + Playwright for testing~~ DONE

**What:** Install `vitest`, `@testing-library/react`, and `playwright`. Add basic config files. Write the tests specified in the eng review test plan.

**Why:** 24 new code paths from the funnel redesign have zero test coverage. The migration API handles auth, DB writes, idempotency, and AI extraction — all untested code paths with real failure modes.

**Pros:** Prevents silent migration failures from reaching users. Catches regression if sessionStorage key name changes. E2E test catches Cognito redirect issues before they cause lost conversions.

**Cons:** One-time setup investment. First test in the codebase sets the convention.

**Context:** From /plan-eng-review. Test plan artifact written to `~/.gstack/projects/aryanmotgi-CareCompanion/aryanmotgi-main-eng-review-test-plan-*.md`. The migrate-guest API is the highest-value test target.

**Effort:** L (human: ~2 days / CC: ~30 min)
**Priority:** P1 — commit to before shipping funnel redesign
**Depends on:** Funnel implementation (need the code to exist before testing it)

---

---

## [P2] Mark-as-taken when no reminderLog exists

**What:** When a medication has no `reminderLog` for today (user added med manually, never set up a reminder), `logId` is `undefined`. Disable the check button with "No reminder set" label instead of silently doing nothing.

**Why:** Manually added medications are a real caregiving scenario. Silent no-op on tap is confusing.

**Pros:** Closes the full mark-as-taken loop. Users understand why the button isn't working.

**Cons:** Full fix requires `POST /api/reminders/create-and-respond` (new endpoint). Phase 1 handles via disabled button.

**Context:** From /plan-eng-review, mobile parity sprint. Phase 1 disables the button when `logId` is missing.

**Effort:** S (human: ~2h / CC: ~15 min)
**Priority:** P2 — after Phase 1 ships
**Depends on:** Mobile parity Phase 1 (care.tsx wired with real data)

---

## [P3] AbortController signal threading in apiFetch

**What:** Thread `signal?: AbortSignal` through `apiFetch()` in `packages/api/src/client.ts`, pass it to the underlying `fetch()` call.

**Why:** Proper cancellation for all API calls. Prevents state updates on unmounted components across future screens.

**Context:** From /plan-eng-review, mobile parity sprint. Current workaround: `Promise.race` timeout.

**Effort:** S (human: ~30 min / CC: ~5 min)
**Priority:** P3 — nice-to-have DX improvement
**Depends on:** Nothing

---

## Deferred from Plan Reviews

| Item | Source | Status |
|------|--------|--------|
| Magic link at rate limit | Launch funnel CEO review | Deferred indefinitely — users motivated enough to hit 15 msgs/hr will sign up normally |
| Medications schema (Phase 2) | Launch funnel CEO review | Deferred to Phase 2 when med tracking is a feature |
| Offline caching + network banner | Mobile parity CEO review | Phase 3 — needs React Query or AsyncStorage cache layer first |
| Aurora 503 retry handling | Mobile parity CEO review | Phase 3 — retry-after with backoff when cold-start 503s during API calls |

---

### Trials: saveMatchResults transaction safety

**What:** Wrap `saveMatchResults` snapshot SELECT + upserts + gap-closed notification inserts in a single DB transaction. Alternatively, add a unique constraint on `(userId, type, nctId-substring)` in the notifications table and rely on insert-on-conflict to prevent duplicates instead of the manual 24h dedup check.

**Why:** Two concurrent calls (live `/api/trials/match` POST + background queue worker) can both read the same pre-update snapshot and both fire gap-closed notifications, since the 24h dedup check is itself a TOCTOU race without a transaction. Found in pre-landing review of clinical trials feature.

**Context:** The `enqueueMatchingRun` UPDATE-first pattern already prevents concurrent queue rows. The risk is a user clicking "Refresh" while the nightly queue worker is also running.

**Effort:** M (human: ~2h / CC: ~15 min)
**Priority:** P2
**Depends on:** Aurora Serverless v2 migration (Data API v1 has limited transaction support)
