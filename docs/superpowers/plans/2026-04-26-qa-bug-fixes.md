# QA Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 production bugs found by /qa-only: two critical flow blockers, one global console error, one mobile rendering failure, and two minor UX issues.

**Architecture:** Targeted fixes across middleware, auth config, CSS, system prompt, and nav — no new abstractions, no new files unless noted. Each task is independent and shippable on its own.

**Tech Stack:** Next.js 15 App Router, NextAuth v5 (authjs), Tailwind CSS, Anthropic AI SDK, TypeScript

---

## Chunk 1: Quick wins (Contact nav + chat separator)

These two fixes are pure copy/config changes. Zero risk. Ship first.

---

### Task 1: Add "Contact" to home page nav

**Problem:** `apps/web/src/app/page.tsx` has an inline `<nav>` (around line 513) that lists Features, About, Privacy, Terms — but not Contact. The `PublicNav` component used on login/signup pages does include Contact. Users on the marketing page can't find Contact.

**Files:**
- Modify: `apps/web/src/app/page.tsx` (desktop nav links block ~line 524, mobile menu block ~line 542)

- [ ] **Step 1: Add Contact to desktop nav**

In `apps/web/src/app/page.tsx`, find the desktop nav links block (`hidden md:flex items-center gap-7`). It currently has Features, About, Privacy, Terms. Add Contact after About:

```tsx
// Before (around line 524):
<button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Features</button>
<Link href="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
<Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">Privacy</Link>
<Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">Terms</Link>

// After:
<button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Features</button>
<Link href="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
<Link href="/contact" className="text-sm text-white/50 hover:text-white transition-colors">Contact</Link>
<Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">Privacy</Link>
<Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">Terms</Link>
```

- [ ] **Step 2: Add Contact to mobile menu**

In the same file, find the mobile menu block (`md:hidden border-t ...`). It has About, Privacy, Terms. Add Contact after About:

```tsx
// Before (around line 542):
<button onClick={...}>Features</button>
<Link href="/about" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">About</Link>
<Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Privacy</Link>
<Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Terms</Link>

// After:
<button onClick={...}>Features</button>
<Link href="/about" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">About</Link>
<Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Contact</Link>
<Link href="/privacy" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Privacy</Link>
<Link href="/terms" onClick={() => setMobileMenuOpen(false)} className="text-sm text-white/60 hover:text-white py-2.5">Terms</Link>
```

- [ ] **Step 3: Verify visually**

Start dev server (`npm run dev` from `apps/web/` or `turbo dev` from repo root). Open http://localhost:3000. Confirm Contact appears in desktop nav between About and Privacy. Shrink viewport to mobile — open hamburger menu — confirm Contact is there too.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix: add Contact link to home page nav (desktop + mobile)"
```

---

### Task 2: Fix AI chat response showing literal "---" separator

**Problem:** The guest chat system prompt (`apps/web/src/app/api/chat/guest/route.ts`) instructs the AI: *"Start every session with: 'I'm CareCompanion...' "* The AI follows this, then adds a markdown `---` divider before the actual answer. This divider renders as the literal text `---` in the UI instead of a horizontal rule.

The real fix is to remove the instruction to prepend an intro on every message — it makes conversations awkward (the intro re-appears mid-conversation) and causes the separator artifact.

**Files:**
- Modify: `apps/web/src/app/api/chat/guest/route.ts` (line ~40 in `GUEST_SYSTEM_PROMPT`)

- [ ] **Step 1: Remove the "Start every session with" instruction**

In `GUEST_SYSTEM_PROMPT`, remove this block entirely:

```
- Start every session with: "I'm CareCompanion — an AI assistant for cancer patients and caregivers. I'm not a doctor, but I can help you understand your care. How can I help you today?"
```

The AI will still introduce itself naturally when asked, and the tone/safety rules still apply. The remove is surgical — everything else in the prompt stays.

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/chat/guest. Send a question. Confirm: no preamble intro, no `---` separator, just a clean direct answer. The tone should still feel warm (the rest of the prompt is unchanged).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/chat/guest/route.ts
git commit -m "fix: remove forced intro instruction from guest chat prompt to eliminate --- separator artifact"
```

---

## Chunk 2: RSC MIME error (console noise on every page)

**Problem:** Every page logs `Refused to execute script from 'https://carecompanionai.org/login' because its MIME type ('text/html') is not executable`.

**Root cause:** When an authenticated user is on any page, Next.js prefetches `/login` as an RSC (React Server Component) request. The middleware sees the authenticated user hitting `/login` and redirects them to `/dashboard` (a 307 redirect). The RSC client receives an HTML redirect response, expects a JS payload, and logs the MIME error. Same thing happens with `/set-role` RSC prefetch.

RSC prefetch requests have the `Next-Router-Prefetch: 1` header. The fix: skip the "redirect authenticated user away from /login" logic when it's an RSC prefetch.

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Add RSC prefetch detection**

In `apps/web/src/middleware.ts`, in the `auth((req) => { ... })` handler, find the block that redirects authenticated users away from `/login` (near the bottom of the handler):

```typescript
// Current code:
if (req.auth && pathname === '/login') {
  const errorParam = req.nextUrl.searchParams.get('error')
  if (!errorParam) {
    const url = req.nextUrl.clone()
    const cb = req.nextUrl.searchParams.get('callbackUrl')
    url.search = ''
    url.pathname = (cb && cb.startsWith('/')) ? cb : '/dashboard'
    return NextResponse.redirect(url)
  }
}
```

Wrap the redirect in an RSC check:

```typescript
// Fixed code:
if (req.auth && pathname === '/login') {
  const errorParam = req.nextUrl.searchParams.get('error')
  const isPrefetch = req.headers.get('Next-Router-Prefetch') === '1' || req.nextUrl.searchParams.has('_rsc')
  if (!errorParam && !isPrefetch) {
    const url = req.nextUrl.clone()
    const cb = req.nextUrl.searchParams.get('callbackUrl')
    url.search = ''
    url.pathname = (cb && cb.startsWith('/')) ? cb : '/dashboard'
    return NextResponse.redirect(url)
  }
}
```

`isPrefetch` is true when Next.js is doing a background prefetch (not a real navigation). We let those pass through so the RSC client gets the proper payload instead of a redirect.

- [ ] **Step 2: Deploy and verify console is clean**

Run dev server. Open the browser console. Navigate between pages. Confirm no more `Refused to execute script from .../login because its MIME type ('text/html') is not executable` errors. The redirect for real navigations (typing `/login` in the URL bar while logged in) should still work.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "fix: skip /login redirect for RSC prefetch requests to eliminate MIME type console error"
```

---

## Chunk 3: Demo flow broken (Critical — /set-role 400 for demo users)

**Problem:** Clicking "Try interactive demo" → `/api/demo/start` creates a demo user with `isDemo: true` in the JWT → redirects to `/dashboard` → middleware should detect `isDemo: true` and skip the role-gate redirect.

**Root cause:** `apps/web/src/middleware.ts` uses `NextAuth(authConfig)` from `auth.config.ts`. That config has no `jwt` or `session` callbacks, so custom token fields (`isDemo`, `role`) are **never mapped to `req.auth.user`** in middleware. Result: `req.auth.user.isDemo` is always `undefined` → `isDemo` is always `false` → demo users get redirected to `/set-role` → clicking Continue fires `/api/auth/set-role` → session may be malformed in this context → 400/failure.

**Fix:** Add a minimal `jwt` + `session` callback to `auth.config.ts` (edge-safe — no DB, no Node.js imports) that propagates `isDemo` and `role` from the token into `req.auth.user`.

**Files:**
- Modify: `apps/web/src/lib/auth.config.ts`

- [ ] **Step 1: Add jwt + session callbacks to auth.config.ts**

Open `apps/web/src/lib/auth.config.ts`. The current `callbacks` block only has `authorized`. Add `jwt` and `session`:

```typescript
// Current callbacks block:
callbacks: {
  authorized({ auth }) {
    return !!auth?.user
  },
},

// Replace with:
callbacks: {
  authorized({ auth }) {
    return !!auth?.user
  },
  jwt({ token }) {
    // Pass through — token already has isDemo and role from auth.ts callbacks
    // or from the demo/start JWT mint. This makes them available to session().
    return token
  },
  session({ session, token }) {
    // Map custom token fields to session.user so middleware can read them.
    // This file is Edge-safe: no DB queries, no Node.js imports.
    if (session.user) {
      session.user.isDemo = (token.isDemo as boolean) ?? false
      session.user.role = (token.role as string | null) ?? null
    }
    return session
  },
},
```

**Why this is safe:** These callbacks run on Edge. They only read fields already on the token — no DB calls, no bcrypt, nothing Node-only. The full `auth.ts` has richer callbacks for server-side use (DB refresh, care group logic). This is the minimal Edge-safe slice.

- [ ] **Step 2: Verify the demo flow end-to-end**

1. Start dev server
2. Open http://localhost:3000 in an incognito window (no session)
3. Click "Try interactive demo"
4. Observe: loading spinner → redirects to `/dashboard` (not `/set-role`)
5. Confirm the Demo banner appears
6. Navigate around the dashboard — no redirect loops, no 400 errors

- [ ] **Step 3: Verify non-demo user role gate still works**

1. Create a fresh test account (or use an existing one that has no role set in DB)
2. Sign in
3. Confirm redirect to `/set-role`
4. Select a role, click Continue
5. Confirm redirect to `/onboarding` or `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth.config.ts
git commit -m "fix: propagate isDemo and role from JWT to session.user in edge auth config so middleware can read them"
```

---

## Chunk 4: Mobile CSS fixes (Critical + High)

Two mobile rendering failures: login page is completely blank, home page hero is mostly invisible.

---

### Task 4a: Fix mobile login page blank

**Problem:** On 375px viewport, the login page (`apps/web/src/app/login/page.tsx`) renders nothing — just the nav bar on a dark background. The form container has `style={{ animation: 'loginFadeUp 0.6s ease both' }}`. The `both` fill-mode means the element starts at `opacity: 0`. If the `@keyframes loginFadeUp` defined in the JSX `<style>` tag doesn't apply before the browser paints (SSR/hydration race), the form stays invisible.

The safe fix: move the keyframes to `globals.css` (always loaded, never affected by hydration timing) and add a CSS fallback.

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Move keyframes to globals.css**

Open `apps/web/src/app/globals.css`. Append at the bottom:

```css
@keyframes loginFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Remove the inline style tag from login/page.tsx**

In `apps/web/src/app/login/page.tsx`, delete the `<style>` block at the bottom of the JSX:

```tsx
// Remove this entire block:
<style>{`
  @keyframes loginFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`}</style>
```

The `animation` inline styles on the divs stay as-is — they reference the keyframe by name, which is now defined globally.

- [ ] **Step 3: Test on mobile viewport**

Open http://localhost:3000/login at 375px viewport width. Confirm the form is visible: logo, Email/Care Group tabs, social auth buttons, email and password inputs, Sign In button. Both tabs should switch correctly.

- [ ] **Step 4: Test on desktop — confirm nothing broke**

Open http://localhost:3000/login at 1280px. Confirm the fade-up animation still plays, the form looks identical to before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/login/page.tsx
git commit -m "fix: move loginFadeUp keyframes to globals.css to fix invisible login form on mobile"
```

---

### Task 4b: Fix mobile home page hero invisible

**Problem:** At 375px, the home page hero section is mostly dark empty space — stats row and CTAs aren't visible.

The home page (`apps/web/src/app/page.tsx`) is 758 lines. The hero section (Section 1, around line 560+) needs investigation. Likely causes: overflow-hidden clipping content, a decorative element with a large fixed height pushing content off-screen, or a gradient overlay covering the hero text on narrow viewports.

**Files:**
- Modify: `apps/web/src/app/page.tsx` (hero section)

- [ ] **Step 1: Inspect hero section structure**

Read lines 560–680 of `apps/web/src/app/page.tsx` (Section 1 — HERO). Look for:
- Any decorative elements with fixed `w-[...]` or `h-[...]` large values that overflow on mobile
- Gradient overlays with `absolute inset-0` that might cover text
- Elements that are `hidden sm:block` or `md:hidden` that affect layout
- The phone/mockup image that sits "on the right" — on mobile it may stack and push text down or be sized too large

- [ ] **Step 2: Fix the hero layout**

Based on what you find, apply the minimal fix. Common patterns:

**If a decorative element is too large:**
```tsx
// Change fixed size to responsive:
// Before: className="absolute w-[800px] h-[600px]"
// After:  className="absolute w-[400px] sm:w-[800px] h-[300px] sm:h-[600px]"
```

**If the phone mockup pushes content down on mobile:**
```tsx
// Make it hidden on mobile or reduce its size:
// Before: className="..."
// After:  className="hidden md:block ..." // or add max-h and overflow-hidden
```

**If content is covered by absolute overlays:**
```tsx
// Ensure the content has higher z-index:
// Add z-10 to the text/CTA container
```

- [ ] **Step 3: Verify on mobile**

Open http://localhost:3000 at 375px. Confirm: headline visible, CTA buttons visible, stats row (50+ Chemo drugs tracked, etc.) visible. Scroll down — confirm the rest of the page also renders correctly.

- [ ] **Step 4: Verify desktop unchanged**

Open http://localhost:3000 at 1280px. Confirm the hero looks identical to before the fix.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix: repair mobile hero section rendering so headline and CTAs are visible at 375px"
```

---

## Execution order

Ship in this order — each is independent but earlier ones have lower blast radius:

1. **Task 1** (Contact nav) — pure copy change, 2 min
2. **Task 2** (chat separator) — one line removed from system prompt, 2 min
3. **Task 3** (RSC MIME) — middleware guard, 5 min
4. **Task 4a** (mobile login) — move keyframes, 5 min
5. **Task 5** (auth config) — edge callbacks, 10 min + manual QA of demo flow
6. **Task 4b** (mobile hero) — inspect-then-fix, 10–20 min depending on root cause

Issues 3 (RSC MIME) and 5 (auth config) touch auth-critical code — test manually after each before deploying.

## What's explicitly out of scope

- **ISSUE-007 (Features button):** Clicking it calls `scrollIntoView` on `#features` which exists at line 626. Working correctly — the QA screenshot was captured before the scroll animation completed. Not a bug.
- The `---` in chat may also appear if the frontend Markdown renderer doesn't handle `---` as `<hr>`. If removing the system prompt instruction doesn't fully fix it, also check the `ReactMarkdown` config in the chat component.
