# Testing Strategy: Full QA Infrastructure

**Date:** 2026-04-23
**Status:** Approved
**Team:** 4 people (Aryan + 3 co-founders), all iOS

## Overview

Comprehensive testing strategy for CareCompanion covering manual QA, automated testing, beta distribution, error monitoring, visual regression, mobile E2E, analytics, and bug reporting — across both web and iOS apps.

## Data Privacy & HIPAA

This applies across ALL phases. CareCompanion handles PHI-adjacent data (cancer type/stage, medications, lab results, chat messages). Every tool that touches user data must be configured accordingly:

- **Sentry:** `beforeSend` hook scrubs PHI fields (medication names, diagnoses, lab values, chat messages) from error payloads. US data center. BAA required on paid plan.
- **PostHog:** Session replay disabled on authenticated pages (only enabled on landing/login). Event tracking captures flow completion (boolean), not content. US data hosting. BAA required.
- **Test data:** All seeded data must be obviously synthetic (e.g., "Test User Alpha", fictional medication schedules). Never use real patient names or realistic-looking MRNs.
- **Test credentials:** Stored in GitHub Secrets and environment variables, never committed to the repo.
- **Bug report button:** Server-side API route proxies to GitHub Issues API. GitHub PAT lives server-side only, never exposed to the client.

## Phase 1: Unblock the Team (Day 1)

### 1. Test Mode Banner

- Small, unobtrusive popup/toast on app load when running in staging/test environment
- Shows "Staging" or "Test Mode" briefly, then dismisses — does not obstruct the UI
- Web: small fixed badge in corner or brief toast notification
- Mobile: same approach — small indicator, auto-dismisses after a few seconds
- Only visible in non-production environments (driven by env var)
- Prevents anyone from confusing staging with production

### 2. Test Accounts & Seed Data

- Create `scripts/seed-test-users.ts`
- 4 accounts with known credentials + realistic (but obviously synthetic) patient data
- Seed: medications, labs, appointments, doctors, insurance, symptom journal entries
- Test users distinguished by `isDemo: true` flag (same pattern as existing demo accounts)
- Seed script is idempotent — deletes existing test data by email, then re-creates
- Environment guard: script refuses to run if `NODE_ENV=production` without explicit `--force` flag
- Credentials stored in GitHub Secrets (`QA_TEST_EMAIL_1`, `QA_TEST_PASSWORD`, etc.)
- Reuses existing `/api/e2e/signin` infrastructure for automated test auth

### 3. One-Tap Data Reset

- Button in settings (test/staging builds only, hidden in production)
- Wipes the current user's data back to the original seeded state
- Server-side API route (`/api/test/reset`) — guarded by environment check
- Partners can reset their own account without asking Aryan
- Reuses the seed script logic for the specific user

### 4. Staging Environment

- Vercel preview branch (`staging`) with dedicated config
- Separate Aurora Serverless database (or isolated schema) for staging data
- Separate Cognito user pool for staging auth (prevents test users from polluting production pool)
- Environment variables managed via Vercel environment configuration (preview vs production)
- All manual testing happens on staging, not production
- Promote staging → production after QA passes

### 3. TestFlight Distribution

- EAS production build for iOS
- Upload to App Store Connect
- Invite 3 teammates by email
- They tap install → sign in → start testing
- Mobile app pointed at staging URL during QA phase

### 4. Sentry Error Monitoring

- Install `@sentry/nextjs` on web app
- Install `@sentry/react-native` on mobile app
- Configure error boundaries, source maps, performance tracing
- `beforeSend` hook to scrub PHI from error payloads (deny-list: medication names, cancer types, patient names, chat messages, lab values)
- US data center, BAA on paid plan
- Set up Slack/email alerts for new errors
- Auto-captures crashes, unhandled rejections, slow transactions

### 5. Manual QA Checklist

- Save as `docs/qa-checklist.md`
- 30+ steps covering every critical flow
- Sections: Auth, Onboarding, Dashboard, Medications, Labs, AI Chat, Notifications, Settings, Caregiver
- Separate notes for web vs iOS-specific behavior
- Pass/fail checkboxes for each step

## Phase 2: Automated Safety Net (Days 2-4)

### 6. In-App Bug Report Button

- Floating feedback button on web (bottom-right corner)
- Floating feedback button on mobile (settings screen)
- Shake-to-report on mobile: shake the phone → bug report form appears with screenshot auto-attached
- Captures: user description, current page/screen URL, device info, user agent, timestamp, user email
- Server-side API route (`/api/feedback`) proxies to GitHub Issues API — PAT never exposed to client
- Labels created issues with `bug` + `qa`
- Web: React component in root layout
- Mobile: React Native component in navigation wrapper

### 7. API Integration Tests

- Test critical API routes with mocked auth but real DB queries (against staging Aurora)
- Cover: medication CRUD, lab retrieval, chat message handling, care profile updates
- Run in CI alongside unit tests
- Catches data layer bugs that unit tests miss and E2E tests are too slow to find

### 8. Expand Playwright E2E (Web)

- Add tests for: full registration flow, medication CRUD, lab viewing, AI chat send/receive, settings changes, password reset, onboarding completion, caregiver features
- Target: mirror every section of the QA checklist
- Configure to run in CI on every PR
- Use existing `/api/e2e/signin` for test authentication

### 9. Maestro Mobile E2E

- Install Maestro CLI
- Write flows: login, dashboard nav, add medication, view labs, open chat, settings
- Run locally on macOS dev machines initially (free)
- Evaluate Maestro Cloud pricing for CI later — start with local runs on self-hosted runner if needed
- Add to GitHub Actions workflow

### 10. Feature Flags

- Simple feature flag system (env var or config-based, no third-party service needed)
- Toggle unfinished features on/off per environment (staging vs production)
- Ship to staging for testing without exposing half-built features to production users
- Config file: `apps/web/src/lib/feature-flags.ts` with flags like `{ NEW_CHAT_UI: true }` driven by env vars
- Mobile: same flags passed via `EXPO_PUBLIC_` env vars

### 11. Slow Network Simulator

- Toggle in test/staging builds that throttles API calls (adds artificial delay)
- Simulates bad hospital/clinic wifi — catches loading state bugs, spinners, timeouts
- Web: middleware or fetch wrapper that adds configurable delay
- Mobile: same approach via API client wrapper
- Only available when `NODE_ENV !== 'production'`

## Phase 3: Polish (Days 4-5)

### 10. Visual Regression Testing (Playwright Screenshots)

- Use Playwright's built-in `expect(page).toHaveScreenshot()` — no extra tool needed
- Snapshot key pages: login, dashboard, medications, labs, chat, settings
- Baselines committed to repo, diffs flagged in PR checks
- Simpler than Chromatic, leverages existing Playwright setup

### 11. Analytics (PostHog)

- Install `posthog-js` on web, `posthog-react-native` on mobile
- Instrument key flows: onboarding completion, medication add, lab view, chat usage, settings changes
- Set up funnel dashboards: onboarding → first medication → first chat
- Session replay DISABLED on authenticated pages (HIPAA) — only enabled on landing/login
- Event tracking captures flow completion booleans, not PHI content
- US data hosting, BAA on paid plan

### 14. QA Checklist Versioning

- Checklist has a version number at the top (e.g., `v1`, `v2`)
- When checklist is updated, a small in-app notification shows "New QA checklist available"
- Driven by a simple version check against a stored value (localStorage/AsyncStorage)
- Ensures partners always test against the latest checklist

### 15. Daily Slack/Email Digest

- Automated daily summary sent to a shared channel or email group
- Contents: new bugs filed (count + titles), new Sentry errors, Playwright/Maestro CI status, latest TestFlight build number
- GitHub Actions workflow on daily cron that aggregates data from GitHub Issues API + Sentry API
- Everyone stays in the loop without checking 4 different tools

## What Teammates Experience

1. Receive TestFlight invite (iOS) or staging URL (web)
2. Sign in with their test credentials
3. Follow the QA checklist (`docs/qa-checklist.md`)
4. Tap bug report button when something's wrong → auto-creates GitHub Issue
5. Everything else (Sentry, Playwright, Maestro, PostHog) is automated and invisible

## Future: Partner Testing Guide

- Create a simple, shareable document (`.docx` or PDF) explaining how to test
- Covers: how to install TestFlight, how to sign in, how to use the QA checklist, how to report bugs
- Written for non-technical partners — no dev jargon
- To be created after implementation is complete

## Existing Infrastructure (Keep)

- 30 unit test files (Vitest) — keep and expand
- 9 Playwright E2E tests — keep as base, expand in Phase 2
- Production monitor (every 4h cron) — keep running
- Demo account system (`/api/demo/start`) — keep for public demos
- CI pipeline (lint → typecheck → test → build) — extend with new checks
- E2E signin endpoint (`/api/e2e/signin`) — reuse for test auth

## Tech Decisions

| Tool | Why |
|------|-----|
| Sentry | Industry standard error monitoring, Next.js + React Native SDKs, BAA available |
| Maestro | Simplest mobile E2E tool, YAML-based, free locally |
| Playwright Screenshots | Visual regression using existing tool — no extra dependency |
| PostHog | Open source, self-hostable, generous free tier, BAA available |
| GitHub Issues | Already using GitHub, zero new tools for bug tracking |
