# Changelog

All notable changes to CareCompanion will be documented in this file.

## [0.3.1.0] - 2026-05-03

Security hardening, Care Tab reliability, dashboard fixes, trials engine improvements, design system polish, document scan/upload fixes, Settings/Profile/Emergency Card audit, Care Groups/Care Team/Sharing security audit, Insurance/Financial/Compliance/HIPAA security audit, Google Calendar / HealthKit Integrations audit, Community Forum + Sharing Links full security audit, Cron Jobs / Production Monitor / Admin Routes security audit, auth UX polish, Clinical Trials full UX+a11y+security pass, full onboarding flow UX+a11y+bug-fix pass, and Care Groups onboarding deep UX audit.

### Fixed (Care Groups — Onboarding)
- **QR polling timeout extended to 10 min** — previously stopped after 30s while the invite link stays valid for 7 days; partner who took longer than 30s to scan was never detected as joined
- **Post-join loop fixed** — users who joined via QR were redirected back to the care-group creation screen; onboarding page now detects existing membership and skips to the wizard phase
- **Invite error params shown** — `/join` error codes (invite-expired, group-full, invite-revoked, invite-not-found) now translate to warm, human-readable messages instead of a blank screen
- **Null inviteUrl fallback** — if the invite API call failed after group creation, users saw nothing; now shows "Having trouble generating the invite link — tap to try again"
- **Copy link feedback** — copy button now shows "✓ Copied!" with purple highlight for 2 seconds
- **Password strength hint** — live indicator shows characters remaining while typing; submit disabled until ≥4 chars
- **Role-aware QR copy** — patients see "Share with your caregiver"; caregivers see "Share with your patient"
- **Enter key submits care group forms** — wrapped in `<form onSubmit>`; mobile keyboard "Go" button now works
- **Share button hidden on desktop** — `navigator.share` is mobile-only; copy button expands to full width on desktop
- **ConnectedName from real data** — celebration screen now fetches actual display name of the joined partner
- **Focus rings restored** — `focus:outline-none` was hiding keyboard navigation; replaced with brand-colored focus rings
- **Touch targets enlarged** — skip/continue links now have `py-2 px-3` padding for adequate mobile tap area
- **Apple Sign-In onboarding lockout fixed** — user lookup used `session.user.email` (null for Apple users); changed to `session.user.id`

### Added (Care Groups — Onboarding)
- **Confetti celebration effect** — 28 CSS particles in brand colors fire from the avatar connection point when two people connect; marks a meaningful moment
- **Password show/hide toggle** — eye icon with `aria-label` for accessibility and caregiver usability
- **qr-timeout step** — after 10 min, shows "No rush — they can join later" with options to share a new link or continue alone
- **Aria-live on waiting status** — screen readers now announce when a partner joins

### Fixed (Security — Ship review)
- **LLM `visit_frequency` field now type-checked** — `isStr()` guard applied to `visit_frequency` alongside the other required fields in the trials detail route
- **Temporary password no longer logged** — `provision-reviewer` route removed password from `console.log`; it was being written to persistent server logs
- **IP extraction hardened in 3 routes** — `export/csv`, `mobile-care-group-login`, and `share` now use `x-real-ip` with `x-forwarded-for` rightmost-hop fallback, consistent with other routes in the codebase

### Added (Infrastructure)
- **Migration 005** — `ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ` and same for `invites`; required for share token revocation feature

### Added (Tests)
- **25 new tests** — CSRF module validation, `care-group/[id]/status` IDOR guard, `onboarding/complete` ownership 404, invite error message map, `QRCodePanel` role-aware prompt and SSR guard

### Added (Onboarding)
- **Step transition animations** — wizard steps now fade in with a gentle upward slide (250ms) instead of hard-cutting; every advance feels intentional
- **Saving spinner on wizard buttons** — all wizard primary action buttons show an animated spinner while saving; eliminates double-tap on mobile
- **Priority limit feedback** — when 3 priorities are selected in the wizard, remaining items show "(limit reached)" inline instead of silently not responding
- **Spinner fallback in OnboardingShell** — the blank-screen edge case is replaced with a loading spinner for the rare race where the phase state doesn't match any render condition

### Changed (Onboarding)
- **Social sign-up (Google/Apple) now requires role selection** — clicking "Continue with Apple/Google" without choosing a role shows an inline error; role is passed via `?role=` to the onboarding page and saved to DB; previously social users always landed in the PatientWizard regardless of intent
- **Wizard save errors surface to users** — `patchProfile()` calls in PatientWizard and CaregiverWizard now check for failure and show a styled `role="alert"` error message; previously a network failure silently dropped data and continued
- **Welcome banner now fires** — `OnboardingShell` sets `onboarding_just_completed` in localStorage before redirecting to `/dashboard`; the welcome banner with personalized action cards was never shown to newly onboarded users
- **Warm, human copy throughout** — "About your patient" → "About the person you're caring for", "Waiting for your patient to join…" → "Waiting for them to join — this may take a moment.", "Stay informed" → "You're almost set up", "Maybe later" buttons use consistent phrasing, all loading states show context-appropriate copy ("Creating your group…", "Joining…")
- **Care Group form accessibility** — group name and password inputs now have proper `id`/`htmlFor` pairs; error messages use `role="alert"`; back button has `aria-label="Go back"`; password field labels distinguish create vs join context
- **Caregiver wizard labels** — select elements for relationship, cancer type, stage, and treatment phase now have `id` attributes with matching `htmlFor`; select placeholder text reads "Select if known" instead of "Select..."
- **Role selector copy** — "Getting support from a loved one" → "Managing my care with loved ones" (more empowering); "Managing my care on my own" → "Managing my own care journey"

### Added (Clinical Trials)
- **Animated loading skeleton** — initial page load shows a skeleton matching the real card layout instead of a plain "Loading…" string; eliminates layout shift
- **Inline save confirmation** — "Save this trial" button now shows "✓ Saved — we'll notify you if this trial's status changes" for 3 seconds after clicking; users know the save worked
- **Trials skeleton component** — `TrialsSkeleton` matches the real matched-trial card layout (header row, 2 cards with match reasons and action rows)

### Changed (Clinical Trials)
- **Dark theme unified across all trial components** — `CloseMatchCard` and `TrialDetailPanel` were using raw Tailwind light-mode classes (`bg-gray-50`, `text-gray-700`, `text-blue-600`) inside the dark app shell; all colors migrated to design system tokens (`var(--border)`, `var(--bg-card)`, `var(--text)`, `var(--text-muted)`, `#A78BFA` for links, `#6366F1` for CTAs)
- **Microcopy rewritten for cancer patients and caregivers** — 15+ strings updated: "Tell us about the patient" → "Let's find the right trials", "No matching trials found" → "We didn't find a match right now — but trials open every week", "Trials You're Close To" → "Almost There — Trials Worth Watching", "What's blocking eligibility" → "What would need to change", "Close match" badge → "Almost there"
- **Empty states with warmth and next steps** — both empty state variants (never searched / searched with no results) now include reassurance and specific guidance on what to do next
- **TrialDetailPanel section headings** — "Phone call script" → "What to say when you call"; "Share with oncologist" → "Note for your oncologist"; error message now links directly to ClinicalTrials.gov
- **ZipCodePrompt heading** — "Add your zip code to find trials near you" → "Where are you located?" with explanatory subtext

### Fixed (Clinical Trials — Security)
- **CSRF headers missing on all three trial mutations** — `runLive` (`POST /api/trials/match`), `saveTrial` (`POST /api/trials/save`), and `dismissTrial` (`PATCH /api/trials/saved/:nctId`) sent no `x-csrf-token` header; all would 403 in production; fixed to match the pattern used by all other mutations in the app
- **PHI cache persisted across user sessions** — `TrialDetailPanel` previously cached AI-generated trial details (containing patient cancer type, stage, prior treatments) in a module-level Map that survived sign-out; a new user on the same tab could see a prior user's data; removed the cache entirely

### Fixed (Clinical Trials — Bugs)
- **Wrong profile served on trials page** — `trials/page.tsx` used `.limit(1)` without `ORDER BY`; for users with multiple profiles, an arbitrary profile was selected; fixed with `.orderBy(desc(careProfiles.createdAt))`
- **Share email sent empty URL when trialUrl is null** — `shareTrial` passed `props.trialUrl ?? ''`, producing a malformed mailto body; now falls back to `https://clinicaltrials.gov/study/${nctId}`

### Fixed (Clinical Trials — Accessibility)
- **Error messages not announced to screen readers** — all error `<p>` elements in `ProfileDataPrompt`, `ZipCodePrompt`, and `TrialsTab` lacked `role="alert"`; added throughout
- **Form labels not linked to inputs** — cancer type, stage, and age inputs in `ProfileDataPrompt` had visual labels with no `htmlFor`/`id` pairing; added `useId()` for each field pair; `ZipCodePrompt` input now has `aria-invalid` on error state
- **Live search overlay not announced** — fullscreen search overlay lacked `role="status"` and `aria-label`; rotating phase text is now read aloud by screen readers
- **Trial results area had no live region** — when live search completed, screen readers received no announcement; added `aria-live="polite"` on the results container
- **Trial card expand/collapse not accessible** — title button lacked `aria-expanded` and a descriptive label; both the title button and chevron button now carry `aria-expanded` and `aria-label`
- **Loading spinner used emoji** — `⏳` was announced as "hourglass" by screen readers; replaced with CSS `animate-spin` + `aria-busy="true"` container
- **Section elements unlabeled** — matched trials and close match sections now have `aria-label`; page wrapper upgraded from `div` to `main`

### Added (Auth UX)
- **Apple and Google sign-in on the signup page** — social login buttons are now available on `/signup` (matching `/login`), so users can create an account with Apple or Google without navigating to the login page first
- **Shared `AuthPageBackground` component** — all four auth pages (`/login`, `/signup`, `/reset-password`, `/reset-password/confirm`) now use a single shared background component; eliminates ~60 lines of duplicated layout markup

### Changed (Auth UX)
- **Warmer page headlines and copy across auth flow** — "CareCompanion" → "Welcome back" on login, "Create your account" → "You're in good hands" on signup, "Reset Password" → "Forgot your password?" on reset, "Set New Password" → "Set your new password" on confirm; subtitles updated throughout
- **Warmer error messages** — "Invalid email or password" → "That doesn't look right — please check your email and password"; "Invalid Care Group name or password" → "We couldn't find that Care Group — double-check the name and password"; server error messages made human and specific
- **Role selector updated for cancer patients** — removed 🤒 sick-face emoji from the Patient role (replaced with 💙); 👤 self-care replaced with 🌟; role descriptions reworded to be warmer ("Caring for someone I love", "Getting support from a loved one", "Managing my care on my own")
- **Error appears above submit button** — `LoginForm` previously showed errors below trust badges, requiring scroll to see; error now displays immediately before the submit button
- **Password reset success screens warmed** — "Your password has been reset successfully" → "You're all set! Your password has been updated. Sign in to continue where you left off."; reset-sent screen adds "Can't find it? Check your spam folder too."
- **`xs` breakpoint added to Tailwind** — `xs: 480px` registered in `tailwind.config.ts`; unblocks the role selector and `BottomTabBar` responsive layout (both used `xs:` classes that were silently dropped before this fix)

### Fixed (Auth UX)
- **Password show/hide button keyboard-inaccessible** — `tabIndex={-1}` on the show/hide toggle in all password inputs meant keyboard users could not reveal their password; changed to `tabIndex={0}` in `LoginForm`, `SignupForm`, and `ResetConfirmForm`
- **`role="alert"` + `aria-live="polite"` conflict** — `role="alert"` implicitly sets `aria-live="assertive"`; the redundant `aria-live="polite"` was contradictory and could confuse assistive technology; removed from all four auth form error divs
- **Social login `callbackUrl` not sanitized** — Apple/Google `signIn()` calls in `LoginForm` passed the raw `callbackUrl` query param; now uses the same `safeCallback` guard as the credentials flow
- **`reset-password/confirm` page not using `AuthPageBackground`** — the confirm page retained ~15 lines of inline background markup; migrated to the shared component

### Added (UX)
- **Active share links management** — Settings page now shows all active share links with per-link revoke buttons; no more need to hunt for links created earlier
- **Share confirmation gate** — `ShareHealthCard` now shows a two-step confirm before generating a new link, preventing accidental shares from a misclick
- **Refill status last-updated timestamp** — `RefillStatusCard` shows the time data was last fetched so caregivers know how fresh the information is
- **Lab trend units in AI chat** — "Tell me about my WBC trend" prompts now include the unit (e.g. `5000 cells/mcL`), making AI responses clinically accurate instead of unitless

### Fixed (Cron Jobs — follow-up)
- **`/api/cron/weekly-summary` only processed first 200 users** — replaced `.limit(200)` hard cap with cursor-based pagination using `cronState` table; all users now receive weekly summaries across successive Sunday runs
- **`/api/cron/radar` N+1 query in caregiver-awareness loop** — per-profile queries for `careTeamMembers` and per-member queries for `careTeamActivityLog` inside the cron loop; replaced with two bulk pre-fetch queries and in-memory Maps before the loop
- **`/api/cron/trials-match` gap-closure swallowed all LLM errors** — empty `catch {}` meant a misconfigured Anthropic key silently skipped every profile every night; now logs `console.error` with profileId and error
- **`/api/cron/trials-match` malformed LLM response crashed gap-closure** — `output.resolved` was not guarded; an undefined value would throw; fixed with `output?.resolved ?? []`

### Fixed (Security — follow-up)
- **Doctor phone numbers exposed on public share page** — `buildShareData` included `phone` in the `care_team` payload; phone numbers rendered as `<a href="tel:...">` on an unauthenticated public URL; phone now omitted from all share payloads
- **`/api/share/` middleware path matched nothing** — trailing slash caused `startsWith('/api/share//')` double-slash check that never matched `/api/share/abc123`; changed to `/api/share` so public token routes are correctly exempted from the auth redirect
- **`/api/admin/provision-reviewer` returned generated password in response body** — temporary password logged server-side (Vercel logs only) and response now returns `'[see server logs]'`

### Fixed (Dead code, config)
- **`/api/cron/sync` stub still scheduled** — placeholder cron that always returned `{synced: 0}` was firing daily and burning a cron invocation; removed from `vercel.json`
- **`/api/notifications/generate` and `/api/reminders/check` undocumented POST handlers** — both routes exposed an undocumented `POST` that just called `GET(req)`; POST handlers removed
- **`searchByEligibility` dead code** — function in `lib/trials/tools.ts` ignored its `age` and `sex` params and called the same endpoint as `searchTrials`; no callers since the agent refactor; deleted
- **`TrialsTab` carried 3 unused props** — `cancerStage`, `patientAge`, `patientName` were declared in `Props` type and passed at call site but never used in the component body; removed

### Fixed (UX — follow-up)
- **`DocumentScanner` forced camera on mobile** — `capture="environment"` attribute opened camera instead of file picker, conflicting with PDF support added in the scan flow; attribute removed
- **Re-categorize menu showed current category** — `DocumentOrganizer` bulk re-categorize dropdown included the document's current category; now filters it out when viewing a single-category tab
- **Grid view "Scanned" label hardcoded** — all grid cards showed "Scanned" regardless of source; label removed (no source column exists to show accurate data)
- **Lab trend `chatPrompt` sent value without unit** — clicking "Ask AI" on a trend card sent `"WBC is currently declining at 3500"` with no unit; fixed to `"3500 cells/mcL"`
- **Conditions not trimmed/deduped after scan extraction** — extracted condition strings could include leading/trailing whitespace and duplicates; now trimmed and deduped with `Set` before insert
- **Insurance "Unknown" provider silently saved** — OCR fallback wrote `provider: 'Unknown'` to the DB when extraction failed; changed to `undefined` so the field is left blank instead
- **`fsaHsa.accountType` case-insensitive FSA check** — `=== 'fsa'` comparison missed `'FSA'` from uppercase storage; changed to `.toLowerCase() === 'fsa'`
- **`RefillStatus` double-fallback on API response shape** — `json.data?.medications ?? json.data ?? []` could silently accept a non-array; normalized to `json.data?.medications ?? []`
- **Community replies returned no pagination signal** — `GET /api/community/[id]` capped replies at 100 with no `hasMoreReplies` or `totalReplies` field; clients couldn't show a "load more" indicator; both fields now returned

### Fixed (Schema & DB)
- **`refillDate` column typed as `text` not `date`** — Drizzle schema declared `text('refill_date')` but the field stores ISO dates; changed to `date()` with a safe migration that casts valid date strings and nulls malformed values
- **`claims.userId` missing index** — full table scan on every insurance page load for users with many claims; index added via migration `004`

### Fixed (Cron Jobs, Production Monitor & Admin Routes)
- **`/api/health` detail leak when `CRON_SECRET` unset** — In production, full diagnostic details (DB columns, env var presence, memory) were exposed to any caller when `CRON_SECRET` was not configured. Now production requires the secret to be both present and matched; dev behavior unchanged
- **`/api/health` `sql.raw()` footgun** — Schema integrity check interpolated table names via `sql.raw()`; replaced with parameterized array binding
- **`/api/test/reset` used client-visible env var as security gate** — Guard checked `NEXT_PUBLIC_TEST_MODE` which is bundled into client JS; changed to server-only `TEST_MODE` env var
- **`/api/e2e/signin` GET liveness probe unauthenticated** — `GET /api/e2e/signin` returned `{ready:true}` to any caller with no auth, confirming the session-minting endpoint exists in production; now requires `x-e2e-secret` header matching `E2E_AUTH_SECRET`
- **`/api/cron/weekly-summary` unbounded profile query** — No `.limit()` meant all onboarded users were loaded and fanned out to Claude on every Sunday run; capped at 200 per run to prevent OOM and Anthropic rate exhaustion
- **`/api/cron/trials-match` queued incomplete profiles** — Nightly matching enqueued all care profiles regardless of `onboardingCompleted`; incomplete profiles have no cancer data, generating empty/garbage Claude prompts; now filtered to completed profiles only
- **CI liveness probes sent unauthenticated GET** — `production-monitor.yml` and `api-health-ping.yml` polled `GET /api/e2e/signin` without the `x-e2e-secret` header; both updated to pass the secret

### Added (Community Forum)
- **Community forum rate limiting** — post creation (5/min), reply creation (10/min), and upvote toggle (30/min) are now rate-limited per user via Redis/in-memory limiter
- **Post deletion** — `DELETE /api/community/[id]` lets users retract their own posts with CSRF + ownership verification and cascade delete of replies
- **Unique upvote constraint** — database-level `uniqueIndex` on `(userId, targetId, targetType)` prevents race-condition double-upvotes that were possible with concurrent requests
- **Community forum error states** — feed and post detail pages now show inline error messages and retry affordances on fetch failures, replacing silent empty states
- **Community pagination** — feed page has a load-more button that appends results via offset-based pagination; no more hard cut at 20 posts
- **Reply character count and length validation** — client-side min/max enforcement matches backend Zod schema (min 5, max 1000); submit disabled when too short

### Fixed (Community Forum)
- **Reply POST leaked `userId` to caller** — bare `.returning()` on the reply insert returned every column including the user's ID; replaced with explicit column projection
- **`replyCount` drift on DB error** — count increment and reply insert now run in a single transaction; previously the count could increment without a successful insert
- **`cancerType` accepted arbitrary strings** — POST body now validates against the `CANCER_TYPES` enum; GET filter validates against the allowlist before DB query
- **`offset` parameter accepted negative values** — clamped to `Math.max(0, ...)` to prevent unexpected Postgres OFFSET behavior
- **UUID not validated on `id` path params** — non-UUID strings caused DB errors surfaced as 500; now returns 400 before reaching the database
- **Upvote could target moderated/nonexistent posts** — added pre-transaction existence + `isModerated=false` check for both post and reply targets
- **CSRF tokens missing on all community client mutations** — create post, upvote, and reply fetches now include `X-CSRF-Token` header
- **Optimistic upvote not reverted on failure** — snapshot + revert pattern added; UI no longer shows wrong count on API error

### Added (Sharing Links)
- **Link revocation** — `POST /api/share/[token]/revoke` lets users invalidate a share link before expiry; revoked links return HTTP 410; public page renders "Link Revoked" state
- **Active links list** — `GET /api/share` returns all non-revoked, non-expired links for the authenticated user; `ShareHealthCard` reuses existing active link instead of creating a new one on every click
- **Share page loading + error boundaries** — `loading.tsx` with animated skeleton and `error.tsx` with retry button added for the public shared page

### Fixed (Sharing Links)
- **`userId`/`careProfileId` present in public API response** — `GET /api/share/[token]` used `db.select()` without column projection; owner identity was being fetched into memory and could appear in RSC stream; replaced with explicit projection
- **Same issue on public page** — `shared/[token]/page.tsx` fetched all columns including PII; fixed with explicit projection
- **`x-forwarded-for` not split on POST** — rate limiter keyed on full comma-chain header; attacker with different proxy chain got fresh bucket; fixed to use first segment only
- **No per-user rate limit on share creation** — IP-only limit allowed 20 links/minute; added per-user limit of 5/min
- **Token returned in POST response alongside URL** — raw token removed from response body (URL already contains it)
- **Relative URL in weekly share response** — changed to use `NEXT_PUBLIC_APP_URL` base, consistent with the create endpoint
- **Clipboard copy error silently swallowed** — `ShareHealthCard` now catches `navigator.clipboard.writeText` failures and shows a "copy manually" message
- **`weekly_summary` data cast without runtime check** — added `typeof link.data !== 'object'` guard before cast to prevent crash on malformed DB data
- **Unused `vi` import in token-encryption tests** — removed; unused `CheckinInput` type removed from checkin-validation

### Added (Integrations)
- **Google Calendar integration UI** — Settings page now shows a connected apps section: connect, sync now, and disconnect buttons for Google Calendar; last-synced timestamp; expired-token warning banner
- **Disconnect endpoint** — `DELETE /api/integrations/[source]` revokes a connected app connection with CSRF protection, session auth, and audit log
- **`decryptToken()` function** — AES-256-GCM decrypt counterpart for stored OAuth tokens; previously tokens were stored encrypted but never decrypted before use, making Google Calendar sync permanently broken
- **Re-authentication flow** — sync errors that indicate token expiry now show a specific toast and orange banner prompting the user to reconnect
- **Token encryption test suite** — 9 tests covering encrypt/decrypt round-trip, legacy plaintext passthrough, malformed ciphertext rejection, HMAC state sign/verify, and tamper detection

### Fixed (Integrations)
- **Google Calendar sync always returned 401** — sync route passed the encrypted token string as a Bearer header to Google API; every API call failed. Fixed by calling `decryptToken()` before use
- **Token refresh stored plaintext** — refreshed access token written to DB without re-encrypting. Fixed with `encryptToken()` on the new value
- **Initial post-OAuth sync never ran** — CSRF check rejected all internal server-to-server calls (OAuth callback → sync); internal secret bypass now runs before CSRF validation
- **Calendar dedup matched title only, not date** — recurring events with the same summary were permanently deduplicated after first import. Fixed: dedup now matches on `doctorName + dateTime`
- **OAuth state unsigned in production** — missing `OAUTH_STATE_SECRET` silently returned unsigned state; OAuth CSRF protection was absent. Changed to throw in production
- **Status route leaked encrypted tokens to client** — `GET /api/sync/status` returned full rows including token fields. Fixed with explicit column projection
- **Sync route IDOR** — `user_id` body param was not validated against session for browser callers. Fixed: browser calls derive user from session

### Removed
- **`TimelineEvent` / `CheckinInput` / `EligibilityGap` unused re-exports** — removed from `TreatmentTimeline.tsx`, `checkin-validation.ts`, and `gapAnalysis.ts`
- **`babel.config.js` + `babel-preset-expo`** — unused Babel config and dependency removed from mobile app

### Fixed (Insurance, Financial, Compliance, HIPAA)
- **Account deletion no-op** — `DELETE /api/delete-account` queried `WHERE providerSub = userId` (wrong column); deletes silently matched nothing for most users; PHI was never actually removed. Changed to `WHERE id = userId`
- **Audit log written before delete** — `logAudit('delete_account')` fired before `db.delete(users)`; a failed delete appeared as a successful deletion in the audit trail. Moved to after the successful delete
- **HIPAA audit log retention 1 year → 6 years** — retention cron purged audit logs after 365 days; HIPAA 45 CFR §164.530(j) requires 6-year minimum. Changed to `365 × 6` days
- **Stored XSS in PDF care summary export** — every DB-sourced PHI field (patient name, conditions, medications, lab values, doctor names, etc.) was interpolated raw into the HTML template; any `<script>` tag stored in profile fields would execute when the user opened the download. Added `escapeHtml()` and applied to all fields
- **Appeal generator CSRF missing** — `AppealGenerator` POSTed to `/api/insurance/appeal` without `x-csrf-token`; the backend validates CSRF and rejected every request with 403, making the feature entirely broken. Added `useCsrfToken()` hook and header
- **Soft-deleted claims visible in Insurance view** — claims query lacked `isNull(claims.deletedAt)` filter; deleted claims appeared in the claim list and stats. Fixed
- **Soft-deleted claims included in PDF export** — same missing filter in the PDF export route. Fixed
- **Appeal route accepted raw string as claim_id** — no UUID format validation; malformed input reached the DB query directly. Added `z.string().uuid()` via Zod schema
- **Appeal route unbounded additional_context** — `additional_context` was interpolated verbatim into the AI prompt with no length limit; enabled prompt injection and API cost abuse. Added `z.string().max(2000)` validation
- **Negative monetary values accepted in insurance upload** — `deductible_limit`, `deductible_used`, `oop_limit`, `oop_used` had no `.nonnegative()` constraint; negative values corrupted the insurance display and calculations. Fixed
- **Claim status field accepted arbitrary strings** — `save-scan-results` ClaimSchema accepted any string for `status`; unknown values broke filter tabs. Changed to `z.enum(['paid','pending','denied','in_review'])`
- **Insurance re-scan always created duplicate rows** — document scan always INSERTed a new insurance row; rescanning the same card created stale duplicates. Changed to upsert (select + update/insert)
- **Compliance tracker worst_time format mismatch** — `worst_time` was stored as a full ISO timestamp (`2026-05-02T14:30:00.000Z`) but the frontend `formatTime24()` expected `HH:MM`; the field rendered as `NaN:05 AM`. Changed to `.substring(11, 16)`
- **CSV export had no audit log and no rate limiting** — PHI could be exported repeatedly with no record. Added `logAudit('export_data')` and `rateLimit({ maxRequests: 5 })`
- **Audit log pagination offset not validated** — `parseInt('abc')` returned NaN; Postgres treated `OFFSET null` as no offset and returned the full table. Added `Math.max(0, parseInt(...) || 0)` guard
- **EOB URL rendered as raw href** — `claim.eobUrl` was used as an anchor href without scheme validation; a `javascript:` URI stored in the field would execute on click. Added `startsWith('https://')` guard
- **Share URL hardcoded to production domain** — `shareUrl` was hardcoded to `https://carecompanionai.org`; share links in staging/dev resolved to the wrong environment. Changed to `process.env.NEXT_PUBLIC_APP_URL` with fallback
- **Compliance report and calendar access not audited** — both endpoints read PHI-derived medication adherence data with no audit trail. Added `logAudit` to both
- **Consent acceptance not audited** — consent accept only `console.log`'d; no durable record in the audit log. Replaced with `logAudit('hipaa_consent_accepted')` including consent version
- **NaN totals in AnalyticsDashboard financial calculations** — `parseFloat` on non-numeric claim amount strings produced NaN that silently corrupted the total billed/paid display. Added `|| 0` NaN guard

### Fixed (Care Groups, Care Team, Sharing)
- **Care group invite CSRF missing** — `POST /api/care-group/invite` had no CSRF check; any page could forge group invite requests
- **Care group status polling IDOR** — `GET /api/care-group/[id]/status` returned member data to any authenticated user who guessed a group UUID; added membership check with 403
- **Care group join race condition** — membership insert and invite mark-as-used were separate DB writes; concurrent requests could double-join; wrapped in transaction + added member-limit guard on invite path
- **Mobile care group login rate limit bypassable** — rate limiter key was IP-only; attacker could rotate IPs; changed to IP+groupName
- **Care group frontend CSRF headers missing** — all three POST calls in `CareGroupScreen` lacked `x-csrf-token`; all mutations silently failed with 403
- **QRCodePanel unhandled AbortError** — `navigator.share()` called without catch; user cancelling share sheet threw unhandled promise rejection
- **Care team accept non-atomic** — member insert and invite-status update were not in a transaction; if update failed, user became member with re-acceptable pending invite; now wrapped in `db.transaction`
- **Care team acceptInvite CSRF missing** — `acceptInvite` fetch in `CareTeamView` lacked `x-csrf-token`; every email-link accept silently failed with 403
- **Checkin share CSRF missing** — `POST /api/checkins/share` had no CSRF validation
- **Checkin share IDOR** — any authenticated user could pass any `checkinId` and trigger push notifications to a different patient's care team; ownership now verified via `careProfileId → careProfiles.userId`
- **Shared page empty state** — health profile share pages with no data rendered only header/footer; now shows "No health data has been added yet" card
- **Weekly summary empty narrative** — `WeeklySummaryPage` rendered empty container when narrative was blank; now shows "No summary available yet" placeholder

### Changed (Dead Code)
- Removed `bcryptjs` and `expo-image-picker` from root `package.json` (already in workspace packages)
- Added 4 missing mobile dependencies to `apps/mobile/package.json`: `@sentry/react-native`, `expo-system-ui`, `posthog-react-native`, `react-native-shake`
- Removed `export` keyword from 22 symbols confirmed to have no external importers across mobile and web

### Fixed (Settings, Profile, Emergency Card)
- **Notification preferences never saved** — component sent camelCase keys (`quietHoursStart`, `refillReminders`) but the API checks snake_case (`quiet_hours_start`, `refill_reminders`); every save returned 400 silently
- **Notification preferences CSRF missing** — `PATCH /api/records/settings` called without `x-csrf-token`; all saves rejected by the API
- **AI personality never saved** — settings PATCH sent `{ aiPersonality }` but API expects `{ ai_personality }`; personality dropdown had no effect since launch
- **AI personality CSRF missing** — same endpoint, same issue
- **Change-password form missing current password field** — API requires `{ currentPassword, password }` but form only sent `{ password }`; every password change returned 400
- **Change-password CSRF missing** — POST to `/api/account/change-password` lacked `x-csrf-token`
- **Password min length mismatch** — frontend checked 6 chars but API requires 8; users could pass frontend validation then fail server validation
- **Import data CSRF missing** — POST to `/api/import-data` lacked `x-csrf-token`; imports silently failed
- **Edit Profile linked to /onboarding** — Settings "Edit Profile" button relaunched the onboarding wizard instead of navigating to `/profile/edit`
- **All profile mutations missing CSRF** — all 8 ProfileEditor write paths (save patient info, save conditions, add/remove medication, add/remove doctor, add/remove appointment) had no `x-csrf-token`; every edit was rejected by the API
- **Conditions & Allergies section always blank** — state initialized to `''` instead of `profile.conditions / profile.allergies`; users who clicked Save without re-entering would silently clear existing data
- **Profile edit showed soft-deleted records** — medications, doctors, and appointments queries lacked `isNull(deletedAt)`; removed records appeared in the edit form
- **Emergency card showed wrong profile for multi-profile users** — page used `WHERE userId = ? LIMIT 1` (creation order) instead of `getActiveProfile()`; care team members saw the wrong patient's emergency data
- **Emergency card share/clipboard had no error handling** — `navigator.share()` rejection and `clipboard.writeText()` throw on HTTP pages were uncaught; now wrapped with fallback

### Removed (Dead Code)
- Deleted 4 unused files: `apps/mobile/src/components/OnboardingJourney.tsx`, `apps/mobile/src/lib/feature-flags.ts`, `apps/video/remotion.config.ts`, `apps/video/src/components/CalloutLabel.tsx`
- Removed 3 unused dependencies from mobile: `@babel/runtime`, `@carecompanion/utils`, `expo-web-browser`
- Removed 2 unused devDependencies from root: `dotenv`, `tsx`
- Removed 4 unused `export` keywords: `trackEvent` (analytics.ts), `DetailContent` (TrialDetailPanel.tsx), `AgentMatchOutput` (clinicalTrialsAgent.ts), `SUPPORTED_HOSPITALS` (hospitals.ts)

### Added
- **knip dead-code scanner** — `npm run deadcode` now available via knip; catches unused exports across the monorepo

### Fixed (Care Tab)
- **Lab trends status never matched UI** — `overall_status: 'warning'` and `'stable'` from the API had no entry in `STATUS_CONFIG`; any user with warning-level labs crashed the Trends UI. Now maps to `'concerning'` and `'monitor'` respectively
- **Doctor name always blank on new appointments** — frontend sent `doctorName` (camelCase), API reads `doctor_name` (snake_case); all appointments saved with a null doctor since the feature launched
- **Drug interactions checked against deleted medications** — soft-deleted medications were included in the interaction check query; users could see warnings for drugs they had already removed
- **Refill status showed deleted medications** — same missing `isNull(deletedAt)` filter; removed medications still appeared with overdue refill alerts
- **Treatment cycle divide-by-zero** — `totalCycles: 0` or `cycleLengthDays: 0` in notes caused `Infinity%` progress; both now guarded with `Math.max(1, ...)`
- **Day-in-cycle overflow when refill overdue** — `dayInCycle` could exceed `cycleLengthDays` when next infusion date was past; now clamped to `[1, cycleLengthDays]`
- **Cycle tracker vanished with no message** — when no medication notes matched the cycle regex, the whole component returned null; now shows an empty state with setup instructions
- **Medication add/edit/delete failures were silent** — all three mutation flows swallowed errors and closed their UI without feedback; each now shows an inline error message
- **Saving one refill date disabled all rows** — `savingRefill` was a single boolean shared across all medications; replaced with `savingRefillId` (string | null) so only the affected row is disabled
- **Lab value exponential notation parsed wrong** — `1.5e-3` was stripped to `1.5` (the `e` was removed), producing values 1000× too large for any sub-1 lab result
- **Lab trend rapid-rise of tumor markers misclassified** — CEA/PSA/CA-125 rising 20%+ showed as "Declining" instead of "Rapid Decline"; higherIsWorse flip logic now checks `changePercent` magnitude directly
- **Lab 1-point chart rendered as invisible line** — Recharts draws nothing with a single data point; now shows a message asking for more results
- **Lab sparkline gradient ID collision** — all `stable` sparklines shared the same SVG gradient ID; one overwrote the other's color. Fixed with `useId()` per instance
- **Lab change_percent null when exactly 0%** — `changePercent ? ... : null` treated zero as falsy, hiding the `0.0%` indicator
- **Lab date UTC off-by-one in Recent filter** — bare `YYYY-MM-DD` strings parsed as UTC midnight fell on the previous day in US timezones; now appended with `T00:00:00` for local-time parsing
- **Lab date heading showed "Invalid Date"** — malformed `dateTaken` values fell through to `toLocaleDateString()` which returned the literal string "Invalid Date"; now guarded
- **No DELETE endpoint for treatment cycles** — cycles could only be deactivated via PATCH; a true DELETE handler is now available at `DELETE /api/cycles/[id]`
- **Medication API: no input length limits** — name, dose, frequency, and notes fields were unbounded; now capped (name 200, dose 100, frequency 200, notes 2000 chars)
- **Medication API: unvalidated refill_date** — any string including `"injection attempt"` was written to the DB; now validated against `YYYY-MM-DD` format before insert/update
- **Medication API: bulk PUT stored literal "undefined"** — `String(undefined)` when `m.name` was missing silently inserted rows with name `"undefined"`; now filtered before insert
- **Medication API: soft-deleted medication editable** — PATCH and DELETE ownership lookups didn't filter `deletedAt IS NULL`, allowing updates to already-deleted records
- **Interaction check skips LLM when no other meds** — previously fired a paid LLM call even with 0 current medications to compare against; now returns early
- **Appointment add errors were silent** — failed POSTs closed the form with no message; error now shown inline

### Security (post-adversarial review)
- **debug-auth route deleted** — `GET /api/debug-auth` exposed a password-reset-via-query-param endpoint active on Vercel preview deployments; route removed entirely
- **CSRF added to 5 mutation routes** — `POST /api/trials/save`, `POST /api/trials/match`, `PATCH /api/trials/saved/[nctId]`, `POST /api/care-group`, and `POST /api/auth/set-role` lacked `validateCsrf()` guards, making group creation and role assignment exploitable via cross-site POST; all now consistent with the rest of the codebase
- **Care group join race condition fixed** — `POST /api/care-group/join` checked membership then inserted in two separate queries; concurrent requests could both pass the check and double-join; wrapped in a `db.transaction()` 
- **Cron profile scan capped at 500** — `GET /api/cron/trials-match` loaded every care profile with no `LIMIT`; would OOM Lambda at scale
- **Cycles rate-limit IP hardened** — `DELETE/PATCH /api/cycles/[id]` used leftmost `x-forwarded-for` (attacker-controlled); now uses `x-real-ip` with rightmost XFF fallback, matching the register route fix
- **Drug interaction safe default on LLM parse failure** — `checkDrugInteractions()` and `checkAllInteractions()` returned `undefined` when structured output parsing failed; now return a conservative safe default (`safe_to_combine: false`)

### Security
- **Check-in API now verifies ownership** — `GET /api/checkins` returned any profile's check-in data to any authenticated user; fixed: caller must own the profile or be a care team member
- **Consent route uses user ID not email** — `POST /api/consent/accept` used `WHERE email =` which silently skips Apple Sign-In users with null email; fixed to use `WHERE id =` matching session user ID
- **Open redirect in login callback URL blocked** — `//evil.com` passed the `/` startsWith check; added `!startsWith('//')` guard
- **Registration rate limited** — `POST /api/auth/register` now enforces 5 attempts/hour per IP, returning 429 on excess
- **Trials search rate limited** — `POST /api/trials/match` now enforces 3 live searches/hour per user; unguarded endpoint was an LLM cost-amplification attack vector
- **Onboarding complete uses user ID throughout** — `POST /api/onboarding/complete` looked up the user by email (breaking Apple Sign-In) and used `session.user.id` instead of the DB-resolved ID for care group membership lookup; both fixed
- **Care group join validates token ownership** — `/join` page used the URL `group` param for inserts; an attacker with a valid token for one group could join any group by crafting the URL; now uses `invite.careGroupId`
- **Onboarding complete route verifies profile ownership** — any authenticated user could mark any care profile as complete by sending a foreign `careProfileId`; ownership check added

### Fixed (Trials)
- **Vercel build crash on 9 API routes** — `DYNAMIC_SERVER_USAGE` error during static page generation; 9 authenticated routes missing `export const dynamic = 'force-dynamic'` (`chat/search`, `compliance/*`, `cycles/current`, `notifications/preferences`, `refills/status`, `search`, `share/weekly`)
- **Trial detail panel fetched in render body** — `fetch()` call was inside the React render function, firing twice per mount in Strict Mode and leaking the in-flight request on unmount; moved to `useEffect` with `cancelled` flag
- **saveTrial had no rollback on API error** — optimistic `setSaved` updated UI before the request; `.catch(()=>{})` swallowed failures permanently; now rolls back to previous state (mirrors dismissTrial pattern)
- **Trial phase always showed "Phase N/A" from cache** — `phase` field was in the in-memory `TrialMatchResult` type but not persisted to `trial_matches` DB table; added column + migration
- **NCT ID not validated in 4 API endpoints** — `save`, `saved/[nctId]`, `[nctId]`, and `[nctId]/detail` routes accepted any string and passed it to CT.gov API + DB; now validates `/^NCT\d{4,}$/`
- **Cron close-trials query unbounded** — `SELECT * FROM trial_matches WHERE matchCategory='close'` loaded all rows with no limit; OOM risk at scale; capped at 200 per cron run
- **Trial status change notifications fired on every cron run** — no dedup; oscillating enrollment status spammed users; added 24h dedup matching `matchingQueue.ts` pattern
- **Trial load lost matches when saved-trials fetch failed** — `Promise.all([matches, saved])` discarded all results if either fetch threw; replaced with `Promise.allSettled` (saved badge absence on failure, not full error screen)
- **Lab date was blank string in trial scoring prompt** — `dateTaken ?? ''` sent empty string to Claude; changed to `'Date unknown'`
- **ContactBlock fallback linked to `href="#"`** — scroll-to-top instead of trial page; now uses `trial.url`

### Fixed
- **Daily check-in "Med" energy always returned 400** — `CheckinModal` sent `energy: 'med'` but the server validates `z.enum(['low', 'medium', 'high'])`; every medium-energy check-in silently failed since launch
- **Appointment cards no longer show past same-day visits** — `Math.ceil()` on a small negative fraction rounds to 0, so a 2-hour-past appointment showed as "Today at X"
- **Analytics page null email guard** — `session.user.email!` non-null assertion caused DB query with `undefined` for Apple Sign-In users, silently redirecting them away
- **Notification dismiss rolls back on API error** — optimistic removal fired before the fetch; on failure the notification was gone from the UI but still unread in the DB
- **CheckinCard skeleton during load** — card previously returned `null` while fetching today's status, causing a layout shift when it appeared
- **dismissTrial rolls back on API failure** — trial was removed from the UI immediately; on fetch error it now restores the previous matched/close arrays
- **Manual health entry in patient wizard now saves medications** — medications collected in "Enter manually" step were excluded from the API call
- **Care profile creation failure shows an error, not a redirect loop** — silent dashboard redirect with no completed profile caused AppLayout to bounce back to onboarding
- **QR polling interval cleaned up on unmount** — `setInterval` and `setTimeout` in CareGroupScreen leaked when the user navigated away before the 30s timeout
- **Trials search surfaces CT.gov API errors** — timeouts and rate-limit responses silently returned empty results; errors now shown in the UI with retry
- **CT.gov search now fetches up to 40 results** — was capped at 20; CT.gov API cap raised to 100 for future use
- **TEST suffix stripped from cancerType in Claude scoring prompt** — the system prompt was seeing raw test strings after CT.gov search already stripped them
- **Trial phase field propagates to UI** — Haiku scoring output now includes the phase value
- **Dark design system applied to TrialMatchCard** — all color tokens rewritten; cards were rendering with light-mode colors in the dark app
- **Dashboard microcopy** — gradient CTAs replaced with solid tokens, celebratory language replaced with clinical register, symptom pills use neutral styling

### Changed
- **staleThreshold reduced from 90 to 30 days** — trial match results older than 30 days are flagged as stale (enrollment status changes frequently)
- **Trials agent refactored to single-call search** — removed duplicate `searchByEligibility` call; single search with `pageSize: 40` is faster and avoids dedup overhead

### Security (Chat & Notifications audit)
- **CSRF missing on notification dismiss and mark-all-read** — `NotificationsView` and `NotificationBell` were POSTing to `/api/notifications/read` without the `x-csrf-token` header; backend CSRF check rejected every call silently; users could dismiss or mark notifications but changes never persisted
- **PHI in chat URL parameters from notification links** — "Ask AI" links embedded medication names, lab values, and appointment info in `?prompt=` URL query parameters, exposing patient data in server logs, browser history, and Referer headers; replaced with generic type-based prompts
- **CSRF missing on POST /api/care-group/join** — state-mutating endpoint added users to care groups without CSRF validation; now consistent with POST /api/care-group
- **LIKE wildcard injection in trials-status cron** — `nctId` was interpolated into a LIKE pattern without escaping `%` and `_` metacharacters; defensively escaped before interpolation

### Fixed (Chat & Notifications)
- **"Ask AI" from notifications never auto-sent** — `NotificationsView` used `"Tell me more about: {title}"` which doesn't match `isAllowedPrompt()`; all notification links now use type-based prompts that match the allowlist and auto-send
- **Soft-deleted items generated spurious notifications** — `generateNotificationsForUser` queried medications and appointments without `isNull(deletedAt)` filters; deleted medications still generated refill alerts, past appointments still generated prep reminders
- **markAllRead showed success toast on API failure** — `NotificationsView` called `showToast` before checking `res.ok`; state is now rolled back and an error toast is shown on failure
- **NotificationBell dismiss had no error handling** — notification disappeared from UI on failure with no rollback or feedback; now rolls back optimistic state on non-ok response
- **Notification cron timed out for large user bases** — `generateNotificationsForAllUsers` processed users in a serial loop; at ~500ms/user this hit Vercel's 60s cron limit at 120+ users; now runs in parallel batches of 10 via `Promise.allSettled`
- **Orchestrator rate limiter never enforced** — `rateLimit()` was instantiated inside `orchestrate()` per request, creating a fresh in-memory store each call; limit was never shared across requests; moved to module scope
- **Orchestrator polluted patient memory store** — multi-agent queries were logged as `category: 'other'` rows in the `memories` table; the memory extraction LLM treated these system events as patient facts; insert block removed

### Fixed (Document Scan & Upload)
- **Scan requests silently failing with 403** — DocumentScanner, CategoryScanner, and CategoryUploadCard were posting to `/api/scan-document` without the `x-csrf-token` header; the backend CSRF check rejected every scan. Now all three components read the CSRF cookie via `useCsrfToken()` and include the header
- **Bulk document delete was a no-op** — the Delete button in the document organizer ran `exitBulkMode()` and nothing else (a "// In a real app..." comment marked the gap). Now calls `DELETE /api/documents/:id` for each selected document and shows success/error counts
- **No delete endpoint for documents** — new `DELETE /api/documents/[id]` route with CSRF validation, auth check, ownership verification via care profile, and soft-delete (`deletedAt`)
- **Document list stale after scan+save** — after saving scan results the document list stayed frozen until a manual page reload. ScanCenter now calls `router.refresh()` on save to re-fetch from the server component
- **No client-side file size check** — users uploading files over 10 MB got no feedback until the server returned 413 after the full upload. Now validates `file.size > 10 MB` before the request and shows a toast immediately
- **PDFs rejected despite "Upload photo or PDF" UI text** — file inputs in DocumentScanner and CategoryScanner were `accept="image/*"` only; changed to `accept="image/*,.pdf,application/pdf"` to match the described capability
- **DELETE ownership TOCTOU** — the document ownership check and the soft-delete were two separate queries; added `careProfileId` to the UPDATE WHERE clause so the delete cannot affect documents that changed ownership between checks

## [0.3.0.0] - 2026-04-29

Full clinical trials matching feature. Caregivers can now search thousands of active trials against a patient's real medical profile, see what they're close to qualifying for, get notified when an eligibility gap closes, and share a clinical-tone summary with their oncologist.

### Added
- **Clinical Trials tab** — new bottom nav item (flask icon, between Care and Scan) routes to `/trials`
- **Profile data prompt** — inline form on the Trials tab to enter cancer type, stage, and age without leaving the page; auto-triggers a search on save
- **Inline zip code input** — replaced the amber banner linking to Settings with an in-place form that saves without navigation
- **Cache-first results** — trial matches load instantly from the DB on mount, showing the last-run results with a relative timestamp ("Updated 3h ago") before any live search
- **Full-screen loading overlay** — when "Find trials now" is clicked, a dark-gradient overlay with rotating phase messages ("Reviewing your medical profile…", "Scoring trial matches…") replaces the tab during the search
- **Gap closure notifications** — when a trial moves from "close" to "matched" (an eligibility gap was resolved), a push notification fires naming the specific criterion met; 24h dedup prevents repeat alerts
- **Oncologist share panel** — each matched trial's detail view includes a clinical-tone referral note (doctor-to-doctor language, ECOG/staging abbreviations, matching rationale) with a copy button and mailto link
- **16 new unit tests** — `clinicalTrialsAgent.test.ts` covers parallel fetch, dedup, JSON parse fallback chain, NCT ID validation, score clamping, and matched/close split; two additional `saveMatchResults` notification-branch tests

### Changed
- **5-10x speed improvement** — replaced sequential agentic tool-call loop with parallel CT.gov pre-fetch (`Promise.all`) + single Haiku scoring call; search time dropped from 60s+ to 5-15s
- **Switched to Haiku model** for trial scoring (`claude-haiku-4-5-20251001`), staying under the 30k TPM org limit while reducing cost ~20x vs Sonnet
- **Error surfacing** — match route now catches all errors and returns `{error, matched:[], close:[]}` instead of an empty 500 body; UI renders the error message inline
- **Enqueue safety** — `enqueueMatchingRun` uses UPDATE-first (resets any pending/claimed row to pending) instead of `onConflictDoNothing`, which was silently dropping trigger runs when the nightly cron had a row claimed
- **Duplicate notification guard** — `saveMatchResults` deduplicates gap-closed notifications with a 24h lookback before inserting

### Fixed
- **LLM nctId validation** — trial objects with malformed or hallucinated NCT IDs are now filtered before DB upsert (`/^NCT\d{8}$/`)
- **LLM output field validation** — `detail` route validates that parsed JSON fields are strings before returning to client; falls back to static defaults on type mismatch
- **Email header injection** — `\r\n` stripped from `clinical_summary` before embedding in `mailto:` body parameter

## [0.2.2.0] - 2026-04-27

Full security hardening pass based on an automated OWASP audit (5 findings, all resolved).

### Security
- **Rate limiting on mobile auth endpoints** — `POST /api/auth/mobile-login` and `POST /api/auth/mobile-care-group-login` now enforce 5 attempts per hour per IP, closing brute-force account takeover vectors against patient medical data
- **Memory prompt injection protection** — user-derived memories are now sanitized before injection into the system prompt: low-confidence facts are excluded, and facts matching AI behavioral directive patterns (`always recommend`, `never suggest`, `ignore`, etc.) are dropped before they reach Claude
- **CSP `unsafe-eval` removed** — `next.config.mjs` no longer includes `unsafe-eval` in `script-src`, tightening XSS defense for all users
- **`apps/mobile/.env` untracked** — removed from git history staging, `.gitignore` expanded to cover `.env` and `*/.env` patterns, `.env.example` added to document the public URL

## [0.2.1.4] - 2026-04-26

Third attempt at the MIME console error. Instead of rewriting to the login page (which Vercel's edge layer was overriding), unauthenticated RSC prefetch requests to protected routes now return 204 No Content. No content = nothing for the browser to parse as a script = no MIME error. Next.js falls back gracefully.

### Fixed
- **MIME console error (final fix)** — unauthenticated RSC prefetch to protected routes returns `204 No Content` instead of an HTML redirect; browser sees no content and logs no error

## [0.2.1.3] - 2026-04-26

Root cause fix for the MIME console error. The `authorized` callback was returning `false` for unauthenticated RSC prefetch requests, causing NextAuth to redirect before our middleware handler ran. Now prefetch requests pass through to the handler, which rewrites them to the login page as RSC payload.

### Fixed
- **MIME console error (root cause)** — `authorized` callback in `auth.config.ts` now returns `true` for `Next-Router-Prefetch` requests so the middleware handler can apply `NextResponse.rewrite()` instead of NextAuth applying a redirect

## [0.2.1.2] - 2026-04-26

Eliminates the MIME type console error for unauthenticated users. Protected routes prefetched by Next.js now get the login page served as RSC payload instead of an HTML redirect, which is what the browser expected.

### Fixed
- **MIME console error (unauthenticated prefetch)** — middleware now uses `NextResponse.rewrite()` instead of `NextResponse.redirect()` for RSC prefetch requests to protected routes, eliminating the "text/html is not executable" browser error

## [0.2.1.1] - 2026-04-26

Two polish fixes from the post-ship QA scan: chat markdown now renders `---` as a visual divider instead of literal text, and the Contact link is in the footer alongside the header nav.

### Fixed
- **Chat `---` rendering** — AI responses using `---` as section dividers now render as a styled `<hr>` instead of literal dashes in the message bubble
- **Contact link missing from footer** — footer now has About / Contact / Privacy / Terms, matching the header nav

## [0.2.1.0] - 2026-04-26

Production bug fixes across mobile rendering, auth flow, and the guest chat experience — all found and fixed via automated QA testing.

### Fixed
- **Mobile login blank** — login, signup, and reset-password pages were invisible at 375px; moved `@keyframes loginFadeUp` from JSX inline style tags to `globals.css` so the animation runs before hydration
- **Mobile home hero invisible** — the 360×720px phone mockup was stacking above the hero text on mobile, pushing the headline and CTAs off-screen; now hidden below the `lg` breakpoint
- **Interactive demo stuck on role screen** — demo users were always redirected to `/set-role` because the edge auth config had no session callback to surface `isDemo` from the JWT; added callbacks so the middleware can correctly detect demo sessions
- **Console MIME error on every page** — Next.js was prefetching `/login` as an RSC payload, middleware redirected it to `/dashboard`, browser logged a MIME type error; added `isPrefetch` guard using the official `Next-Router-Prefetch` header
- **Chat response showing literal `---` separator** — forced intro instruction in the guest chat system prompt caused the AI to prepend a preamble and markdown separator before every answer; removed the instruction
- **Contact link missing from home page nav** — Contact was in the login/signup nav but not the marketing page nav; added to both desktop and mobile menu

### Changed
- **JWT type declarations** — extended the NextAuth JWT interface with `isDemo`, `dbUserId`, and `displayName` fields that were being written to tokens but not declared in the TypeScript types
- **Auth session shape** — edge auth config now maps `id` and `displayName` from token to session, matching the server-side auth config

## [0.2.0.0] - 2026-04-25

Complete redesign of the auth and onboarding experience. Caregivers and patients now select their role at signup, connect through a shared Care Group, and get a personalized onboarding wizard with role-aware AI from day one.

### Added
- **Role selection at signup** — users pick Caregiver, Patient, or Self-care on the signup form; role persists through Google/Apple OAuth via short-lived cookie
- **Care Group** — family name + shared password to link accounts; create (generates QR + invite link) or join (name + password); ConnectedCelebration screen when second member joins
- **QRCodePanel** — 10-minute countdown, blur-on-expiry overlay, tap-to-regenerate, Share + Copy link buttons
- **CaregiverWizard** (6 steps) — patient info, relationship, caregiving experience, primary concern (personalizes AI), Apple Health invite explainer, diagnosis placeholder, priorities, notifications
- **PatientWizard** (4 steps) — hospital search, Apple Health connect → confirm records (with field overrides), manual entry fallback, priorities, notifications
- **WizardProgressBar** — segmented step indicator with clickable back-navigation on completed steps
- **Role-aware AI** — `buildRoleContext()` prepends role, primaryConcern, and caregivingExperience to every `/api/chat` system prompt
- **Onboarding recap email** — `POST /api/onboarding/complete` marks completion and sends branded HTML summary with diagnosis, care group name, and dashboard link
- **Care Group API routes** — create, join (with 10-member cap), invite (with 5-token cap and 7-day expiry), status polling, deep-link `/join` page
- **`/set-role` page** — role selector for pre-existing users with no role; middleware redirects them there before any authenticated page
- **Care Group login tab** — LoginForm now has an Email / Care Group toggle; group login resolves to the owner's account
- New DB tables: `care_groups`, `care_group_members`, `care_group_invites`; new columns: `role` on users, `caregivingExperience`, `primaryConcern`, `fieldOverrides` on care_profiles

### Changed
- `OnboardingWizard` reduced to a thin role router delegating to `CaregiverWizard` or `PatientWizard`
- `OnboardingShell` now shows Care Group setup as the first phase before the wizard
- `SignupForm` includes `RoleSelector` above name/email; role validates before credential or OAuth submit
- HealthKit sync insert loop wrapped in per-record try/catch — one bad FHIR record no longer aborts the entire batch

## [0.1.2.0] - 2026-04-06

Complete onboarding overhaul. New users now get a guided tour, personalized dashboard, and a unified setup flow that replaces three separate paths.

### Added

- **Post-onboarding guided tour** — 5-step spotlight walkthrough covering dashboard cards, AI chat, care tab, scan tab, and navigation. CSS mask-based cutout with pulse animation.
- **Profile completeness indicator** — SVG circular progress ring scoring 11 weighted fields. Shows top 3 "next steps" action cards linking to relevant pages. Celebration state at 100%.
- **Priorities-driven dashboard** — cards reorder based on onboarding priorities. "Priority" badges on matched cards. Quick-ask prompts personalized per selection.
- **Re-engagement nudges** — dismissable and snoozeable cards for users who skipped adding health records, medications, appointments, emergency contacts, or scans. 1-day grace period after onboarding. 3-day snooze option.
- **Structured cancer type picker** — 13 tappable pill buttons replacing free-text input. "Other" reveals custom text field. Cancer-specific contextual tips on selection.
- **Unified 6-step onboarding wizard** — merged wizard, data connection, and manual setup into one flow with inline data entry (medications, doctors, appointments) and summary/welcome screen.

### Changed

- Manual setup page now redirects to onboarding for users who haven't completed it
- Bottom tab bar has data-tour attributes for guided tour targeting
- Dashboard page fetches additional profile data (doctors count, connected apps, emergency contacts, scanned documents) for completeness scoring and nudge logic

## [0.1.1.0] - 2026-04-03

Backend hardening, test coverage, and new API endpoints. The extraction engine is now unified, sync routes are locked down, and 84 tests catch regressions before they ship.

### Added

- **Unified document extraction engine** — single Zod-validated pipeline powers all scanning (prescriptions, labs, insurance, EOBs, doctor notes). Now extracts appointments and diagnoses too.
- **Rate limiting** on extraction and medication import APIs (10 req/min per user)
- **Cron endpoint security** — all cron routes verify CRON_SECRET Bearer token in production
- **Health check endpoint** (`GET /api/health`) — tests DB connectivity and env var status, returns 200 or 503
- **Chat history API** (`GET/DELETE /api/chat/history`) — paginated message retrieval with cursor-based pagination
- **Journal delete** (`DELETE /api/journal`) — remove symptom entries by date
- **Health summary caching** — generated summaries are saved and retrievable via `GET /api/health-summary`
- **84 unit tests** covering FHIR parsing, conflict detection, extraction schema, rate limiting, cron auth, system prompt building, and reminder utilities

### Fixed

- **Auth on sync routes** — `/api/sync/google-calendar`, `/api/sync/health-system`, and `/api/sync/insurance` previously had zero auth checks. Now require authentication and verify user_id ownership.
- **Visit prep ownership** — appointment must belong to the authenticated user's care profile
- **Medication import validation** — max 50 medications per import, array required
- **Document extraction duplicates** — medications and lab results are checked against existing records before importing
- **Higher confidence threshold** (0.85) for auto-importing safety-critical data (medications, labs)
- **Memory extraction guards** — skips greetings and trivial messages, 60-second dedup window, capped at 150 memories loaded

### Changed

- **Tool input validation** — all AI chat tool schemas now have `.min()/.max()` length constraints
- **Env validation** — ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY warn in production if missing
- **Memory loading** capped at 150 most-recent memories (was unlimited)

## [0.1.0.0] - 2026-04-02

Scan a medical document and get structured data back. Delete a medication without worrying you'll accidentally lose it. See a spinning gradient border on urgent refill cards. The frontend now tells you what's happening while it works.

### Added

- **AI Document Extraction** — scan prescriptions, lab reports, insurance cards, and EOBs with Claude Vision. Auto-imports extracted data into your care profile with a confidence threshold.
- **Confirmation dialogs** on all destructive actions (delete medication, remove appointment, delete account). No more accidental data loss.
- **Loading spinners** on every async operation — adding medications, appointments, saving settings, exporting data, changing passwords.
- **Visual upgrades** — spinning gradient borders on urgent cards, material-style ripple on buttons, animated greeting gradient on dashboard, enhanced ambient background with 4 floating orbs, upgraded skeleton loading animations, page blur-in transitions.
- **CI/CD pipeline** — GitHub Actions running lint, typecheck, test, and build on every push. Husky pre-commit hooks with lint-staged.
- **E2E tests** — Playwright tests for auth flow, navigation, and dashboard rendering.
- **Environment validation** — fail-fast on missing env vars with clear error messages.
- **Notification engine** respects user settings toggles (refill reminders, appointment reminders, lab alerts, claim updates).

### Changed

- **DashboardView** cards array memoized with `useMemo` — no longer rebuilds every render.
- **MessageBubble** markdown now handles inline code, code blocks, and italic text. Tool loading uses proper spinner instead of emoji.
- **MedicationsView** refetches from Supabase after scan instead of reloading the entire page.
- **SettingsPage** debounce timeout cleaned up on unmount. Password form shows inline validation. Toggle switches have proper `aria-label`. Clickable rows support keyboard navigation.
- **error.tsx** matches app dark theme instead of jarring light background.
- **PriorityCard** urgent variant gets pulsing dot and spinning gradient border.
- **Button** component adds hover shadows and ripple effect on click.
- **ExpandableCard** and **PriorityCard** use consistent `·` separator instead of `•`.

### Fixed

- Greptile review findings — ownership check on document extraction, input size limit (10MB), improved test assertions.
