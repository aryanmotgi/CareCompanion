# BAA & Vendor PHI Map — CareCompanion

**Generated:** 2026-05-22  
**Scope:** All `package.json` files across monorepo root, `apps/web`, `apps/mobile`, `packages/*`  
**Standard:** HIPAA 45 CFR §164.308(b) — Business Associate Agreement required before any PHI-touching vendor goes to production.

> **Key:** ✅ Yes · ❌ No · ⚠️ Conditional · 🔍 Verify · — N/A

---

## Vendor PHI Map

| Vendor | SDK & Version (found in) | What data flows to vendor | Touches PHI? | BAA available? | BAA on file? | PHI-free mode possible? | Launch blocker? |
|--------|--------------------------|--------------------------|:---:|:---:|:---:|:---:|:---:|
| **Anthropic** (via `@ai-sdk/anthropic`) | `^3.0.64` · apps/web | Full AI chat turns — patient messages, medication queries, symptom descriptions, health history sent as prompt context | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Conditional¹ | 🚨 YES |
| **Google AI** (via `@ai-sdk/google`) | `^3.0.74` · apps/web | Same as Anthropic — routed to Gemini API; any AI feature using this model sends full prompt context | ✅ Yes | ⚠️ Vertex AI only² | ❌ No | ⚠️ Conditional¹ | 🚨 YES |
| **Sentry** (`@sentry/nextjs`) | `^10.50.0` · apps/web | Error payloads, stack traces, request bodies — may capture PHI in API error context, form state, URL params | ✅ Yes | ✅ Yes (Business+) | ❌ No | ✅ Yes³ | 🚨 YES |
| **Sentry** (`@sentry/react-native`) | `^6.3.0` · apps/mobile | Same as above for mobile — crash reports may include screen state containing health data | ✅ Yes | ✅ Yes (Business+) | ❌ No | ✅ Yes³ | 🚨 YES |
| **Resend** | `^6.10.0` · apps/web | Transactional email content — appointment reminders, medication alerts, verification emails; sender/recipient PII always present | ✅ Yes | ❌ No BAA | ❌ No | ❌ No⁴ | 🚨 YES |
| **PostHog** (`posthog-js`) | `^1.371.2` · apps/web | Page views, click events, session recordings — autocapture and session replay can ingest form values, health data on page | ✅ Yes | ❌ Cloud: No BAA⁵ | ❌ No | ⚠️ Conditional⁶ | 🚨 YES |
| **PostHog** (`posthog-react-native`) | `^3.3.3` · apps/mobile | Same as above for mobile app — screen names, tapped UI elements, session data | ✅ Yes | ❌ Cloud: No BAA⁵ | ❌ No | ⚠️ Conditional⁶ | 🚨 YES |
| **Vercel Analytics** (`@vercel/analytics`) | `^2.0.1` · apps/web | Page-level analytics — URL paths may expose patient-facing routes (e.g. `/dashboard/medications`) | ⚠️ Indirect | ✅ Yes (Enterprise) | ❌ No | ⚠️ Conditional⁷ | ⚠️ Blocker if not Enterprise |
| **AWS RDS Data API** (`@aws-sdk/client-rds-data`) | `^3.1030.0` · apps/web | All Aurora DB queries — this IS the PHI datastore (patient records, medications, FHIR resources) | ✅ Yes | ✅ Yes (AWS BAA) | ❌ No | — N/A | 🚨 YES |
| **expo-notifications** | `~0.29.14` · apps/mobile | Push notification payloads relayed through Apple APNs / Google FCM — content may include medication names, appointment times | ✅ Yes (if payload has PHI) | ⚠️ APNs: conditional⁸ / FCM: No | ❌ No | ✅ Yes⁹ | ⚠️ Conditional |
| **drizzle-orm** | `^0.45.2` · apps/web, packages/types | ORM library — executes queries locally; no data transmitted to Drizzle/vendor servers | — Local only | — N/A | — N/A | — N/A | ❌ No |
| **postgres** (postgres.js) | `^3.4.9` · apps/web | PostgreSQL wire-protocol client — runs locally against Aurora; no data sent to vendor | — Local only | — N/A | — N/A | — N/A | ❌ No |
| **@anthropic-ai/sdk** (direct) | Not found in any package.json | — | — | — | — | — | — |
| **@google/genai** (direct) | Not found in any package.json | — | — | — | — | — | — |
| **voyageai** | Not found in any package.json | — | — | — | — | — | — |
| **openai** | Not found in any package.json | — | — | — | — | — | — |
| **expo-server-sdk** | Not found in any package.json | — | — | — | — | — | — |
| **mixpanel** | Not found in any package.json | — | — | — | — | — | — |
| **amplitude** | Not found in any package.json | — | — | — | — | — | — |
| **datadog** | Not found in any package.json | — | — | — | — | — | — |
| **aws-sdk** (v2) | Not found — using `@aws-sdk` v3 only | — | — | — | — | — | — |
| **@aws-sdk/client-cognito-identity-provider** | Not found in package.json — verify if used transitively via `next-auth`¹⁰ | User identity tokens, auth flows — may handle user PII | 🔍 Verify | ✅ Yes (AWS BAA) | ❌ No | — N/A | 🔍 Verify |
| **pg** (node-postgres) | Not found — using `postgres` (postgres.js) instead | — | — | — | — | — | — |
| **Upstash Redis** (`@upstash/redis`) | `^1.37.0` · apps/web | Cache keys / session tokens — if session data contains user IDs or health context, PHI may be cached | ⚠️ Indirect | ✅ Yes (contact Upstash) | ❌ No | ✅ Yes (PHI-free keys) | ⚠️ Conditional |

---

## Footnotes

1. **PHI-free mode for AI providers:** Technically possible by redacting all PHI before sending prompts, but defeats the core product purpose. BAA is the correct path for a health AI.
2. **Google Gemini BAA:** The standard Google Cloud BAA (via Google Cloud Console → IAM → Data Processing Addendum) covers **Vertex AI** and its Gemini models. The `@ai-sdk/google` SDK can be pointed at Vertex AI endpoint — confirm this is configured, not the direct `generativelanguage.googleapis.com` endpoint which is **not** covered.
3. **Sentry PHI-free mode:** Implement `beforeSend` (web) and `beforeSend`/`beforeSendTransaction` (React Native) hooks to scrub known PHI fields before any event is transmitted. This is required even if a Sentry BAA is obtained, to meet minimum necessary standard.
4. **Resend has no HIPAA BAA** as of 2026-05-22. There is no contractual mechanism to make Resend HIPAA-compliant. Replace with **AWS SES** (covered under AWS BAA, HIPAA-eligible service).
5. **PostHog Cloud has no HIPAA BAA.** PostHog self-hosted on your own AWS infrastructure can be HIPAA-compliant (you control the data). If staying on PostHog Cloud, all tracked events must contain zero PHI/PII — disable autocapture, disable session recording, and use only anonymous aggregate events.
6. **PostHog PHI-free mode:** Disable `autocapture`, `session_recording`, and `capture_pageview` on all authenticated/health pages. All `posthog.capture()` calls must use non-PHI event names and properties. This is fragile — prefer self-hosted or a HIPAA-eligible alternative.
7. **Vercel Analytics:** Only collects aggregated page-view metrics (no PII by default). Risk is route-path leakage (e.g. `/patients/123`). Either (a) upgrade to Vercel Enterprise + sign BAA, or (b) redact dynamic route segments before they reach Vercel.
8. **Apple APNs + HIPAA:** Apple supports HIPAA-compliant push if the BAA with Apple is established via the Apple Business Manager agreement and payloads contain no PHI. See [Apple Developer HIPAA guidance](https://developer.apple.com/documentation/healthkit/protecting_user_privacy). **Google FCM is not HIPAA-eligible** — use data-only/silent notifications that trigger the app to fetch content locally.
9. **expo-notifications PHI-free mode:** Send silent/data-only push notifications (no `body` containing health info). The app fetches the actual content from your API on receipt. This is the correct architecture for HIPAA-compliant mobile push.
10. **next-auth + Cognito:** `next-auth` ^5 can use AWS Cognito as an OAuth provider. If configured this way, `@aws-sdk/client-cognito-identity-provider` is used at runtime (pulled in transitively). Run `grep -r "cognito" apps/web/src` to confirm. Cognito is covered under the AWS BAA once signed.

---

## ACTION ITEMS — BAAs to Sign Before Launch

### 🔴 Critical Path (must be done before any PHI enters production)

| # | Action | Vendor | Contact / Link | Owner | Priority |
|---|--------|--------|---------------|-------|----------|
| 1 | Accept AWS HIPAA BAA | AWS (covers RDS/Aurora, Cognito, SES, and all HIPAA-eligible services) | AWS Console → My Account → [AWS Artifact](https://console.aws.amazon.com/artifact/home) → Agreements → AWS HIPAA BAA | Aryan | P0 |
| 2 | Request Anthropic HIPAA BAA | Anthropic | Email **privacy@anthropic.com** — subject: "HIPAA BAA Request for API Customer". Mention your use case (health AI assistant). BAA is available for API customers; may require enterprise agreement. | Aryan | P0 |
| 3 | **Replace Resend with AWS SES** | Resend → AWS SES | No BAA path exists with Resend. AWS SES is covered under the AWS BAA (step 1). Migration: replace `resend` SDK with `@aws-sdk/client-ses`; update `apps/web/src` email-sending code. | Aryan | P0 |
| 4 | Implement Sentry `beforeSend` PHI scrubbing (web + mobile) | Sentry | Sentry docs: [Filtering Events](https://docs.sentry.io/platforms/javascript/configuration/filtering/) · [React Native filtering](https://docs.sentry.io/platforms/react-native/configuration/filtering/). Scrub: names, DOBs, diagnoses, medications, MRNs, phone numbers from `event.user`, `event.request.data`, `event.extra`, and breadcrumb messages. Required before OR instead of BAA. | Aryan | P0 |
| 5 | Sign Sentry HIPAA BAA (after step 4) | Sentry | Requires **Business or Enterprise plan**. Contact [sales@sentry.io](mailto:sales@sentry.io) or open a support ticket requesting the HIPAA DPA/BAA. See [Sentry HIPAA](https://sentry.io/security/#hipaa). | Aryan | P0 |
| 6 | Disable PostHog PHI event capture OR migrate to self-hosted | PostHog | PostHog Cloud: disable `autocapture`, `session_recording`, `capture_pageview` on all health pages. Audit every `posthog.capture()` call. See [PostHog privacy](https://posthog.com/docs/privacy). Self-hosted alternative: deploy PostHog on your AWS VPC — then covered by your own infrastructure controls. | Aryan | P0 |

### 🟡 Required Before Launch (can parallelize with above)

| # | Action | Vendor | Contact / Link | Owner | Priority |
|---|--------|--------|---------------|-------|----------|
| 7 | Confirm Google AI routes through Vertex AI (not direct Gemini API) | Google | Check `@ai-sdk/google` configuration in `apps/web/src/lib/`. If using `google.generateText(...)` with `GOOGLE_GENERATIVE_AI_API_KEY`, it routes to `generativelanguage.googleapis.com` — NOT BAA-covered. Switch to Vertex AI endpoint using `GOOGLE_VERTEX_PROJECT` + `GOOGLE_VERTEX_LOCATION`. Then accept Google Cloud BAA via [Google Cloud Console → IAM → Data Processing Addendum](https://console.cloud.google.com/iam-admin/privacy). | Aryan | P1 |
| 8 | Accept Google Cloud BAA (after step 7) | Google Cloud | [Google Cloud HIPAA compliance](https://cloud.google.com/security/compliance/hipaa) · Sign DPA via Cloud Console. Covers Vertex AI, Cloud SQL, GCS, and other HIPAA-eligible services. | Aryan | P1 |
| 9 | Make push notifications PHI-free | Apple APNs / Google FCM | Audit all `expo-notifications` `scheduleNotificationAsync` and server-side push calls. Notification `body` / `title` must not contain PHI. Use silent/data-only notifications to trigger in-app fetch. See footnote 9. | Shreyash | P1 |
| 10 | Verify Cognito usage and ensure covered under AWS BAA | AWS Cognito | Run `grep -r "cognito\|CognitoIdentity" apps/web/src`. Confirm `next-auth` Cognito provider is used. Cognito is covered once AWS BAA (step 1) is accepted. | Aryan | P1 |
| 11 | Sign Vercel HIPAA BAA or remove analytics from PHI pages | Vercel | Enterprise BAA: contact [vercel.com/contact/sales](https://vercel.com/contact/sales). Or, as mitigation, configure `@vercel/analytics` to exclude health-route page views. | Aryan | P1 |
| 12 | Upstash Redis — confirm no PHI in cache keys/values | Upstash | Audit what's stored: session tokens, rate-limit keys, AI conversation cache. Contact [Upstash support](https://upstash.com/docs/common/help/support) for BAA if PHI-adjacent data is cached. | Aryan | P2 |

### 🟢 Informational (no action needed)

| Vendor | Reason no action needed |
|--------|------------------------|
| `drizzle-orm` | ORM library runs locally; zero data transmitted to Drizzle Inc. servers. |
| `postgres` (postgres.js) | Database wire-protocol client; zero data transmitted to vendor. |
| `next-auth` | Auth framework runs in your infra; session storage is your responsibility. |

---

## Summary Scorecard

| Status | Count | Vendors |
|--------|-------|---------|
| 🚨 BAA needed, not signed | 5 | Anthropic, AWS (RDS+Cognito), Sentry (×2), Google AI |
| 🚫 No BAA available — must replace/mitigate | 2 | Resend, PostHog Cloud |
| ⚠️ BAA available, pending upgrade/confirmation | 2 | Vercel Analytics, Upstash |
| ✅ No BAA needed | 2 | drizzle-orm, postgres.js |
| 🔍 Verify usage | 1 | @aws-sdk/client-cognito-identity-provider (transitive) |
| — Not present in codebase | 9 | @anthropic-ai/sdk, @google/genai, voyageai, openai, expo-server-sdk, mixpanel, amplitude, datadog, pg |

**Launch is blocked until all P0 items are resolved.**
