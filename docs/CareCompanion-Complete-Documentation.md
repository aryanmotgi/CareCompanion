# CareCompanion — Complete Technical Documentation

**Version:** April 2026
**Platform:** Web (Next.js) + Mobile (Expo/React Native)
**Domain:** AI-powered cancer care management for family caregivers

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Architecture](#2-monorepo-architecture)
3. [Web Application (Next.js)](#3-web-application-nextjs)
4. [Database Schema](#4-database-schema)
5. [Authentication & Security](#5-authentication--security)
6. [API Routes & Endpoints](#6-api-routes--endpoints)
7. [AI / LLM System](#7-ai--llm-system)
8. [Memory System](#8-memory-system)
9. [Frontend Components](#9-frontend-components)
10. [Design System & Styling](#10-design-system--styling)
11. [Providers & Context](#11-providers--context)
12. [Hooks](#12-hooks)
13. [TypeScript Types & Interfaces](#13-typescript-types--interfaces)
14. [Mobile Application (Expo)](#14-mobile-application-expo)
15. [Notifications & Reminders](#15-notifications--reminders)
16. [Cron Jobs & Scheduled Tasks](#16-cron-jobs--scheduled-tasks)
17. [Email System](#17-email-system)
18. [Rate Limiting](#18-rate-limiting)
19. [Environment Variables](#19-environment-variables)
20. [Deployment & Infrastructure](#20-deployment--infrastructure)
21. [Testing Infrastructure](#21-testing-infrastructure)
22. [Demo Mode](#22-demo-mode)
23. [Shared Packages](#23-shared-packages)
24. [Scripts & Tooling](#24-scripts--tooling)
25. [Monitoring & Analytics](#25-monitoring--analytics)
26. [HIPAA & Compliance](#26-hipaa--compliance)
27. [Architectural Decisions](#27-architectural-decisions)
28. [Current Priorities & Roadmap](#28-current-priorities--roadmap)

---

# 1. Project Overview

## What Is CareCompanion?

CareCompanion is an AI-powered assistant built specifically for family caregivers managing the care of loved ones with cancer. It centralizes scattered healthcare information — medications, appointments, insurance claims, lab results, and health records — into a single intelligent platform that proactively alerts caregivers to what needs attention.

## Mission

To reduce the cognitive burden on cancer caregivers by providing a trusted, HIPAA-aware AI companion that understands oncology workflows, medication interactions, insurance navigation, and the emotional toll of caregiving.

## Core Value Propositions

- **Medication Management:** Track prescriptions, refill dates, drug interactions (CYP450 pathway awareness), and adherence with daily reminders.
- **Appointment Coordination:** Schedule visits, generate pre-visit question lists, capture post-visit notes, and sync with calendars.
- **Insurance Navigation:** Track claims, denials, prior authorizations, appeals, FSA/HSA balances, and estimate out-of-pocket costs.
- **Lab Result Interpretation:** Explain lab values in plain English with trend analysis, flag abnormal results, and contextualize for the patient's specific cancer type.
- **AI Chat:** Multi-agent conversational AI (Claude Sonnet 4.6) with long-term memory, cancer-specific knowledge, and 16 callable tools.
- **Care Team Collaboration:** Invite family members with role-based access (owner, editor, viewer) to share the care burden.
- **Caregiver Support:** Burnout detection, emotional support, wellness resources, and anonymous community forum.
- **Document Scanning:** Photograph pill bottles, lab reports, insurance cards — AI extracts structured data automatically.
- **Emergency Card:** One-tap ICE (In Case of Emergency) card with allergies, medications, emergency contacts, and a 911 button.

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Web Framework | Next.js 14.2 (App Router) |
| Mobile Framework | Expo 52 (React Native 0.76.5) |
| Language | TypeScript 5 |
| Database | PostgreSQL (AWS Aurora Serverless v1) |
| ORM | Drizzle 0.45.2 |
| Auth | NextAuth v5 (Auth.js) + AWS Cognito |
| AI | Vercel AI SDK v6 + Anthropic Claude |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts 3.8 |
| Package Manager | Bun 1.3.11 |
| Build Orchestration | Turbo 2.0 |
| Deployment | Vercel (serverless) |
| Monitoring | Sentry + PostHog + Vercel Analytics |

---

# 2. Monorepo Architecture

## Directory Structure

```
carecompanion/
├── apps/
│   ├── web/              # Next.js 14 full-stack application (primary)
│   └── mobile/           # Expo (React Native) mobile application
├── packages/
│   ├── types/            # Shared TypeScript types (inferred from DB schema)
│   ├── api/              # Shared API client for cross-app communication
│   └── utils/            # Shared utility functions
├── docs/
│   └── superpowers/      # Architecture plans, specs, and design documents
├── supabase/             # Legacy Supabase migration files
├── scripts/              # Seed data generators, utility scripts
├── drizzle/              # Drizzle ORM config and migration files
├── turbo.json            # Turborepo build pipeline configuration
├── tsconfig.base.json    # Shared TypeScript configuration
├── vercel.json           # Vercel deployment + cron configuration
├── package.json          # Root workspace configuration
├── bun.lock              # Dependency lockfile
├── CLAUDE.md             # AI assistant instructions
├── PLAN.md               # Architecture plan
├── TODOS.md              # Deferred work items
├── CHANGELOG.md          # Version history
├── README.md             # Setup guide + feature overview
└── HIPAA_Compliance_Report.md  # Security posture documentation
```

## Build Pipeline (turbo.json)

Turborepo orchestrates parallel builds across the monorepo:

- **`dev`** — Starts all dev servers concurrently (web on port 3000, mobile via Expo)
- **`build`** — Builds all packages and apps in dependency order
- **`typecheck`** — TypeScript type checking across all workspaces
- **`lint`** — ESLint across all workspaces
- **`test:run`** — Vitest unit tests across all workspaces

## Package Manager

Bun 1.3.11 is used for dependency management. Workspaces are defined in the root `package.json` with `workspace:*` protocol for internal package references.

---

# 3. Web Application (Next.js)

## Overview

The web app is the primary interface, built with Next.js 14 using the App Router pattern. It serves as both the frontend and backend (via API routes).

**Location:** `apps/web/`

## Directory Structure

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (app)/                    # Protected route group (requires auth)
│   │   │   ├── dashboard/            # Home dashboard
│   │   │   ├── chat/                 # AI chat interface
│   │   │   ├── medications/          # Medication management
│   │   │   ├── appointments/         # Appointment scheduling
│   │   │   ├── care/                 # Multi-tab care view
│   │   │   ├── labs/                 # Lab results
│   │   │   ├── calendar/            # Calendar view
│   │   │   ├── journal/             # Symptom journal
│   │   │   ├── settings/            # User settings
│   │   │   ├── health-summary/      # Exportable health summary
│   │   │   ├── emergency/           # ICE card
│   │   │   ├── records/             # Document library
│   │   │   ├── scans/               # Scanned documents
│   │   │   ├── insurance/           # Insurance management
│   │   │   ├── care-team/           # Team collaboration
│   │   │   ├── analytics/           # Health analytics
│   │   │   ├── community/           # Caregiver forum
│   │   │   ├── timeline/            # Treatment timeline
│   │   │   ├── visit-prep/          # Pre-visit preparation
│   │   │   ├── notifications/       # Notification center
│   │   │   ├── profile/             # Profile editing
│   │   │   ├── sync-status/         # Data sync status
│   │   │   ├── upload/              # Document upload
│   │   │   ├── manual-setup/        # Manual data entry
│   │   │   └── onboarding/          # Setup wizard
│   │   ├── api/                     # API Routes (88+ endpoints)
│   │   │   ├── auth/                # NextAuth callbacks
│   │   │   ├── chat/                # Chat endpoints
│   │   │   ├── records/             # CRUD for all medical records
│   │   │   ├── cron/                # Vercel cron jobs
│   │   │   ├── notifications/       # Notification generation
│   │   │   ├── reminders/           # Medication reminders
│   │   │   ├── health-summary/      # Health summary generation
│   │   │   ├── care-team/           # Team management
│   │   │   ├── community/           # Forum endpoints
│   │   │   ├── compliance/          # Audit and compliance
│   │   │   ├── export/              # Data export (PDF, CSV)
│   │   │   ├── import-data/         # Data import
│   │   │   ├── interactions/        # Drug interaction checking
│   │   │   ├── labs/                # Lab trend analysis
│   │   │   ├── share/               # Shareable links
│   │   │   ├── sync/                # Calendar sync
│   │   │   ├── demo/                # Demo account management
│   │   │   ├── test/                # Test utilities
│   │   │   └── ...                  # 20+ more endpoint groups
│   │   ├── login/                   # Public login page
│   │   ├── signup/                  # Public registration page
│   │   ├── chat/guest/              # Public guest chat
│   │   ├── about/                   # About page
│   │   ├── privacy/                 # Privacy policy
│   │   ├── terms/                   # Terms of service
│   │   ├── demo-walkthrough/        # Demo guide
│   │   └── layout.tsx               # Root layout
│   ├── components/                   # 101+ React components
│   │   ├── ui/                      # Base UI library
│   │   ├── providers/               # Context providers
│   │   └── [feature components]     # Feature-specific components
│   ├── lib/                          # Core business logic
│   │   ├── db/                      # Database client + schema
│   │   ├── agents/                  # Multi-agent AI system
│   │   └── [utilities]              # 65+ utility modules
│   ├── hooks/                        # Custom React hooks
│   ├── types/                        # Local type definitions
│   ├── middleware.ts                 # Auth + CSRF middleware
│   └── __tests__/                   # Unit test files
├── drizzle/                          # ORM config + migrations
├── e2e/                              # Playwright E2E tests
├── public/                           # Static assets
├── next.config.mjs                   # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS config
├── tsconfig.json                     # TypeScript config
├── vitest.config.ts                  # Unit test config
└── package.json                      # Dependencies + scripts
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 14.2.35 | Web framework |
| react | 18 | UI library |
| drizzle-orm | 0.45.2 | Database ORM |
| ai | 6.0.142 | Vercel AI SDK |
| @ai-sdk/anthropic | 3.0.64 | Claude integration |
| next-auth | 5.0.0-beta.31 | Authentication |
| tailwindcss | 3.4.1 | CSS framework |
| recharts | 3.8.1 | Chart library |
| zod | 4.3.6 | Schema validation |
| jspdf | 4.2.1 | PDF generation |
| web-push | 3.6.7 | Push notifications |
| bcryptjs | 3.0.2 | Password hashing |
| postgres | 3.4.9 | PostgreSQL driver |
| @sentry/nextjs | 10.50.0 | Error tracking |
| posthog-js | 1.371.2 | Product analytics |
| @vercel/analytics | 2.0.1 | Performance analytics |

## Root Layout

**File:** `src/app/layout.tsx`

- **Fonts:** Figtree (display headings) + Noto Sans (body text) from Google Fonts
- **SEO:** Comprehensive metadata with Open Graph, Twitter cards, schema.org markup
- **Analytics:** Vercel Analytics + PostHog tracking injected at root level
- **Viewport:** Mobile-optimized with `viewport-fit: cover` for notched devices

## App Layout (Protected Routes)

**File:** `src/app/(app)/layout.tsx`

The `(app)` route group wraps all authenticated routes. On every request:

1. Server-side auth check — redirects to `/login` if no session
2. DB user resolution — stable email-based lookup (handles provider changes)
3. HIPAA consent gate — redirects to `/consent` if consent not given
4. Onboarding gate — redirects to `/onboarding` if setup not completed
5. Wraps children in providers: SessionProvider, ThemeProvider, CsrfProvider, ToastProvider
6. Renders AppShell (header, bottom tabs, content area)
7. Includes: OfflineIndicator, TestModeBanner, BugReportButton, ServiceWorkerRegistration

---

# 4. Database Schema

## Overview

The database is PostgreSQL (AWS Aurora Serverless v1) accessed via the RDS Data API. The schema is defined using Drizzle ORM in `src/lib/db/schema.ts` (443 lines, 22+ tables).

## Database Client

**File:** `src/lib/db/index.ts`

```typescript
// Connects via AWS RDS Data API (not direct TCP)
new RDSDataClient({ region: 'us-east-1', credentials: { accessKeyId, secretAccessKey } })
drizzle(client, {
  database: 'carecompanion',
  secretArn: '...',
  resourceArn: '...',
  schema: schemaDefinitions
})
```

**Aurora Auto-Pause Handling:** The client retries up to 3 times with 3-second delays when the serverless cluster is waking from auto-pause.

## Tables

### Core User Tables

**users**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| email | VARCHAR | Unique email address |
| passwordHash | VARCHAR | Bcrypt-hashed password (12 rounds) |
| displayName | VARCHAR | User's display name |
| isDemo | BOOLEAN | Whether this is a demo account |
| hipaa_consent | BOOLEAN | HIPAA consent status |
| hipaa_consent_at | TIMESTAMP | When consent was given |
| hipaa_consent_version | VARCHAR | Consent version |
| onboardingCompleted | BOOLEAN | Whether onboarding wizard is done |
| createdAt | TIMESTAMP | Account creation time |
| deletedAt | TIMESTAMP | Soft delete timestamp |

**care_profiles**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| patientName | VARCHAR | Patient's name |
| patientAge | INTEGER | Patient's age |
| relationship | VARCHAR | Relationship to patient |
| cancerType | VARCHAR | Type of cancer (Breast, Lung, Colorectal, etc.) |
| cancerStage | VARCHAR | Stage (I, II, III, IV) |
| treatmentPhase | VARCHAR | Phase (Just Diagnosed, Active, Between, Remission) |
| conditions | JSONB | Array of comorbid conditions |
| allergies | JSONB | Array of known allergies |
| emergencyContact | JSONB | Emergency contact details |
| priorities | JSONB | User's selected priority areas |

**user_settings**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| notificationPreferences | JSONB | Granular notification toggle map |
| quietHoursStart | VARCHAR | Quiet hours start time |
| quietHoursEnd | VARCHAR | Quiet hours end time |
| aiPersonality | VARCHAR | AI response style preference |
| theme | VARCHAR | dark / light / system |

### Medical Records Tables

**medications**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| name | VARCHAR | Medication name |
| dosage | VARCHAR | Dosage amount |
| frequency | VARCHAR | How often taken |
| prescribingDoctor | VARCHAR | Doctor who prescribed |
| refillDate | DATE | Next refill date |
| pharmacy | VARCHAR | Pharmacy name |
| notes | TEXT | Additional notes |
| healthkitFhirId | VARCHAR | Apple HealthKit FHIR resource ID |
| createdAt | TIMESTAMP | When added |
| deletedAt | TIMESTAMP | Soft delete |

**doctors**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| name | VARCHAR | Doctor's name |
| specialty | VARCHAR | Medical specialty |
| phone | VARCHAR | Contact number |
| notes | TEXT | Additional notes |
| deletedAt | TIMESTAMP | Soft delete |

**appointments**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| doctorName | VARCHAR | Doctor for appointment |
| specialty | VARCHAR | Doctor's specialty |
| dateTime | TIMESTAMP | Appointment date/time |
| location | VARCHAR | Facility/address |
| purpose | VARCHAR | Reason for visit |
| healthkitFhirId | VARCHAR | HealthKit FHIR ID |
| createdAt | TIMESTAMP | When created |
| deletedAt | TIMESTAMP | Soft delete |

**lab_results**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| testName | VARCHAR | Name of lab test (WBC, RBC, etc.) |
| value | VARCHAR | Test result value |
| unit | VARCHAR | Unit of measurement |
| referenceRange | VARCHAR | Normal range |
| isAbnormal | BOOLEAN | Whether value is out of range |
| dateTaken | DATE | When test was performed |
| healthkitFhirId | VARCHAR | HealthKit FHIR ID |
| createdAt | TIMESTAMP | When added |

**documents**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| type | VARCHAR | Document type |
| description | TEXT | Document description |
| summary | TEXT | AI-generated summary |
| documentDate | DATE | Date on the document |
| createdAt | TIMESTAMP | When uploaded |

**symptom_entries**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| painLevel | INTEGER | Pain score (0-10) |
| mood | VARCHAR | Emotional state |
| sleepQuality | VARCHAR | Sleep quality rating |
| appetite | VARCHAR | Appetite level |
| energy | VARCHAR | Energy level |
| symptoms | JSONB | Array of reported symptoms |
| notes | TEXT | Free-text notes |
| createdAt | TIMESTAMP | When logged |

### Insurance & Financial Tables

**insurance**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| provider | VARCHAR | Insurance company |
| memberId | VARCHAR | Member ID number |
| groupNumber | VARCHAR | Group number |
| deductibleUsed | DECIMAL | Amount used toward deductible |
| deductibleLimit | DECIMAL | Annual deductible limit |
| oopUsed | DECIMAL | Out-of-pocket amount used |
| oopLimit | DECIMAL | Out-of-pocket maximum |
| planYear | VARCHAR | Plan year |

**claims**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| insuranceId | UUID (FK → insurance) | Associated insurance plan |
| serviceDate | DATE | Date of service |
| provider | VARCHAR | Healthcare provider |
| billedAmount | DECIMAL | Amount billed |
| paidAmount | DECIMAL | Amount paid by insurance |
| patientResponsibility | DECIMAL | Patient's share |
| status | VARCHAR | pending / approved / denied / appealed |
| denialReason | TEXT | Reason for denial |
| eobUrl | VARCHAR | EOB document URL |
| createdAt | TIMESTAMP | When filed |

**prior_auths**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| service | VARCHAR | Service requiring auth |
| approvalDate | DATE | When approved |
| expiryDate | DATE | When auth expires |
| sessionsApproved | INTEGER | Number of sessions approved |
| sessionsUsed | INTEGER | Number of sessions used |
| status | VARCHAR | pending / approved / denied |

**fsa_hsa**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| accountType | VARCHAR | FSA or HSA |
| balance | DECIMAL | Current balance |
| contributionLimit | DECIMAL | Annual contribution limit |

### AI & Intelligence Tables

**messages**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| role | VARCHAR | user / assistant |
| content | TEXT | Message content |
| createdAt | TIMESTAMP | When sent |

**memories**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| category | VARCHAR | One of 13 categories |
| fact | TEXT | The extracted fact |
| confidence | VARCHAR | high / medium / low |
| lastReferenced | TIMESTAMP | When last used in context |
| createdAt | TIMESTAMP | When extracted |

Memory categories: medication, condition, allergy, insurance, financial, appointment, preference, family, provider, lab_result, lifestyle, legal, other.

**conversation_summaries**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| summary | TEXT | AI-generated summary |
| topicTags | JSONB | Array of topic tags |
| messageCount | INTEGER | Messages covered |
| createdAt | TIMESTAMP | When generated |

**health_summaries**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| content | TEXT | Cached summary content |
| createdAt | TIMESTAMP | When cached |

### Notification & Reminder Tables

**notifications**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| type | VARCHAR | Notification category |
| title | VARCHAR | Notification title |
| message | TEXT | Notification body |
| isRead | BOOLEAN | Read status |
| createdAt | TIMESTAMP | When created |

**medication_reminders**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Owner |
| medicationId | UUID (FK → medications) | Associated medication |
| times | JSONB | Array of reminder times |
| daysOfWeek | JSONB | Which days to remind |
| isActive | BOOLEAN | Whether reminder is active |
| createdAt | TIMESTAMP | When created |

**reminder_logs**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| reminderId | UUID (FK → medication_reminders) | Associated reminder |
| userId | UUID (FK → users) | Owner |
| scheduledTime | TIMESTAMP | When it was scheduled |
| status | VARCHAR | pending / taken / missed |
| respondedAt | TIMESTAMP | When user responded |

### Collaboration Tables

**care_team_members**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| profileId | UUID (FK → care_profiles) | Care profile being shared |
| userId | UUID (FK → users) | Team member |
| role | VARCHAR | owner / editor / viewer |
| joinedAt | TIMESTAMP | When joined |

**care_team_invites**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| profileId | UUID (FK → care_profiles) | Care profile |
| email | VARCHAR | Invited email |
| role | VARCHAR | Assigned role |
| token | VARCHAR | Unique invite token |
| expiresAt | TIMESTAMP | 7-day expiry |
| createdAt | TIMESTAMP | When sent |

**care_team_activity**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| profileId | UUID (FK → care_profiles) | Care profile |
| userId | UUID (FK → users) | Who took the action |
| action | VARCHAR | What was done |
| details | TEXT | Additional details |
| createdAt | TIMESTAMP | When it happened |

### Community Tables

**community_posts**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| userId | UUID (FK → users) | Author (anonymous display) |
| cancerType | VARCHAR | Topic tag by cancer type |
| title | VARCHAR | Post title |
| content | TEXT | Post body |
| upvoteCount | INTEGER | Total upvotes |
| replyCount | INTEGER | Total replies |
| createdAt | TIMESTAMP | When posted |

**community_replies** and **community_upvotes** — Standard reply and upvote tables with FK relationships.

### Infrastructure Tables

**connected_apps** — OAuth tokens for external integrations (source, access/refresh tokens, metadata, sync status)

**push_subscriptions** — Web Push endpoints with encryption keys

**shared_links** — Token-based shareable health summaries with expiry and view tracking

**scanned_documents** — File URLs with extracted JSON data

**audit_logs** — HIPAA-compliant access logging (user_id, action, resource, IP, method, path, status_code, duration_ms)

**user_preferences** — Active profile selection and integration settings

## Schema Design Principles

- **Soft Deletes:** All medical record tables use `deletedAt` timestamps instead of hard deletes. Queries filter with `isNull(deletedAt)`.
- **UUID Primary Keys:** All tables use UUID v4 for primary keys.
- **Cascading Deletes:** Foreign key constraints cascade deletions where appropriate.
- **JSONB Columns:** Used for flexible data (symptoms array, notification preferences, conditions list).
- **HealthKit Integration:** `healthkitFhirId` columns on medications, appointments, and lab_results for Apple Health sync.
- **Row-Level Security:** All data is filtered by `userId` at the application layer. Users cannot access each other's data.

---

# 5. Authentication & Security

## Authentication System

### Provider: NextAuth v5 (Auth.js)

**Files:**
- `src/lib/auth.ts` — Full server-side auth configuration
- `src/lib/auth.config.ts` — Edge-safe configuration (no Node.js-only imports)

### Authentication Flow

1. **Credentials Provider:** Email + password authentication
   - Passwords hashed with bcryptjs (12 rounds)
   - Rate limited: 5 login attempts per 15 minutes per email
2. **Cognito Integration:** AWS Cognito OAuth provider (for SSO)
3. **Session Strategy:** JWT tokens stored in httpOnly cookies
4. **Cookie Configuration:**
   - `httpOnly: true` (cannot be read by JavaScript)
   - `sameSite: 'strict'` (prevents CSRF)
   - `secure: true` in production (HTTPS only)
   - `maxAge: 86400` (24 hours)

### JWT Payload

```json
{
  "dbUserId": "uuid-string",
  "displayName": "John Doe",
  "isDemo": false
}
```

### Middleware

**File:** `src/middleware.ts`

The middleware runs on every request at the edge:

1. **Auth Check:** Validates JWT cookie; redirects to `/login` if missing for protected routes
2. **CSRF Token Generation:** Creates a 32-byte random hex token, stores in `cc-csrf-token` cookie (httpOnly, sameSite: strict, 24-hour expiry)
3. **CSRF Validation:** Every POST/PATCH/DELETE must include matching `x-csrf-token` header

### Public Routes (No Auth Required)

- `/`, `/login`, `/signup`, `/reset-password`
- `/chat/guest`, `/demo-walkthrough`
- `/about`, `/privacy`, `/terms`, `/contact`, `/conditions`, `/consent`
- `/shared/*` (public share pages)
- `/api/auth/*`, `/api/chat/guest`, `/api/e2e/*`, `/api/cron/*`
- `/api/notifications/generate`, `/api/reminders/check`
- `/api/share/*`, `/api/feedback`, `/api/test/*`, `/api/health`

## Security Measures

### CSRF Protection

- Token generated in middleware on every request
- Stored in httpOnly cookie (`cc-csrf-token`)
- Validated server-side via `x-csrf-token` header on state-changing requests
- Prevents cross-site request forgery attacks

### Security Headers (next.config.mjs)

| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=self, microphone=none, geolocation=none |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| Content-Security-Policy | Restrictive with exceptions for Anthropic, Vercel, Google |

### Data Security

- **Row-Level Security:** All database queries filter by `userId`
- **Soft Deletes:** No permanent data deletion (audit trail preservation)
- **Token Encryption:** OAuth refresh tokens encrypted at rest using `TOKEN_ENCRYPTION_KEY`
- **Audit Logging:** Every API call logged to `audit_logs` table with user, action, IP, timestamp, status, and duration
- **Rate Limiting:** IP-based and user-based limits on all endpoints (see Rate Limiting section)

---

# 6. API Routes & Endpoints

## Overview

The API layer consists of 88+ endpoints organized by domain. All authenticated endpoints use `getAuthenticatedUser()` for session validation and return standardized responses via `apiSuccess()` / `apiError()`.

## Authentication Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/[...nextauth] | NextAuth dynamic route handler |
| POST | /api/auth/register | Email/password signup |
| POST | /api/auth/reset-password | Request password reset |
| POST | /api/auth/reset-password/confirm | Confirm reset with nonce |
| POST | /api/auth/set-password | Set initial password |
| POST | /api/auth/google-calendar/callback | Google OAuth callback |
| POST | /api/account/change-password | Authenticated password change |
| GET | /api/auth/cognito-logout | Cognito session cleanup |

## Chat & AI Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| POST | /api/chat | Main authenticated chat | 30/min IP, 10/min user |
| POST | /api/chat/guest | Guest chat (no auth) | 15/hour IP |
| GET/POST | /api/chat/history | Message history | — |
| GET | /api/chat/search | Full-text message search | — |

### Main Chat Endpoint (`POST /api/chat`)

This is the most complex endpoint. On each request:

1. Validate CSRF token
2. Check rate limits (IP + user)
3. Load user's care profile, settings, and 150 most recent memories
4. Pre-screen for dangerous intents (account deletion, password changes)
5. Run the multi-agent orchestrator:
   - Router classifies the message intent
   - Up to 3 specialist agents run in parallel (Haiku 4.5)
   - Specialist outputs merged into context
6. Send to Claude Sonnet 4.6 with system prompt + tools
7. Stream response via `toUIMessageStreamResponse()`
8. Post-response: extract and save new memories (non-blocking)
9. Auto-generate conversation summary every 20 messages

## Records CRUD Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/records/medications | List active medications |
| POST | /api/records/medications | Add medication |
| PATCH | /api/records/medications | Update medication |
| DELETE | /api/records/medications | Soft delete medication |
| GET | /api/records/doctors | List doctors |
| POST | /api/records/doctors | Add doctor |
| GET | /api/records/appointments | List appointments |
| POST | /api/records/appointments | Add appointment |
| GET | /api/records/labs | List lab results |
| POST | /api/records/labs | Add lab result |
| GET | /api/records/profile | Get care profile |
| PUT | /api/records/profile | Update care profile |
| GET | /api/records/settings | Get user settings |
| POST | /api/records/settings | Update settings |
| POST | /api/records/restore | Restore soft-deleted items |

## Notification & Reminder Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reminders | List medication reminders |
| POST | /api/reminders | Create reminder |
| DELETE | /api/reminders | Delete reminder |
| POST | /api/reminders/respond | Confirm taking medication |
| POST | /api/reminders/check | Cron: process reminders |
| GET/POST | /api/notifications/preferences | Notification settings |
| GET | /api/notifications/read | Mark as read |
| POST | /api/notifications/generate | Cron: generate alerts |

## Care Team Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/care-team | List team members |
| POST | /api/care-team/invite | Send invite email |
| POST | /api/care-team/accept | Accept invite |
| POST | /api/care-team/remove | Remove member |

## Insurance & Financial Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/upload/insurance | Upload insurance details |
| POST | /api/insurance/appeal | File claim appeal |
| GET | /api/insurance/status | Check coverage/deductible |

## Health & Export Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/health-summary | Generate/fetch health summary |
| GET | /api/health-summary/cache | Cached summary |
| GET | /api/export/pdf | Export as printable HTML |
| GET | /api/export/csv | Export records as CSV |
| POST | /api/export-data | Full GDPR data export |
| POST | /api/import-data | Import exported data |
| POST | /api/import-medications | Bulk medication import |

## Document & Scanning Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/scan-document | OCR scan of documents |
| POST | /api/save-scan-results | Save extracted data |
| POST | /api/documents/extract | Extract structured data |
| POST | /api/extract-medications | AI medication extraction |

## AI Feature Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/interactions/check | Drug interaction checking |
| POST | /api/labs/trends | AI lab trend analysis |
| POST | /api/triage | Symptom triage |
| POST | /api/visit-prep | Pre-visit question generation |

## Sharing Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/share | Create shareable link |
| GET | /api/share/[token] | Access shared data (no auth) |
| POST | /api/share/weekly | Weekly health summary share |

## Community Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/community | Forum posts CRUD |
| GET | /api/community/[id] | Single post |
| POST | /api/community/[id]/upvote | Upvote post |
| GET | /api/search | Full-text search |

## User Account Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/me | Current user profile |
| POST | /api/delete-account | Account deletion |
| GET | /api/profile-switch | Switch care profile |
| POST | /api/consent/accept | Accept HIPAA consent |

## Compliance Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/compliance/audit-log | Access audit logs |
| GET | /api/compliance/report | Generate compliance report |
| GET | /api/compliance/calendar | Compliance event calendar |

## Utility Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check + CSRF cookie |
| GET | /api/csrf-token | Fresh CSRF token |
| GET | /api/sync/google-calendar | Calendar sync handler |
| GET | /api/sync/status | Sync status check |
| GET | /api/healthkit/sync | Apple HealthKit sync |
| POST | /api/feedback | Bug report submission |

## Demo & Test Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/demo/start | Create demo account with seed data |
| POST | /api/seed-demo | Alternative demo seeding |
| POST | /api/e2e/signin | E2E test login (gated) |
| POST | /api/test/reset | Reset test data |

## API Response Patterns

All endpoints follow standardized patterns:

```typescript
// Success
apiSuccess(data, 200)

// Errors
apiError(message, 400, { code: 'VALIDATION_ERROR', details: {...} })
ApiErrors.unauthorized()
ApiErrors.rateLimited(retryAfterMs)
ApiErrors.notFound()

// Authentication
const { user, error } = await getAuthenticatedUser()
if (error) return error

// Validation
const { data, error } = validateBody(schema, body)
if (error) return error
```

---

# 7. AI / LLM System

## Architecture Overview

CareCompanion uses a multi-agent AI architecture where each message is processed by specialized domain experts before a final response is generated.

```
User Message
    │
    ▼
┌─────────────────────┐
│  Router Agent        │  ← Claude Haiku 4.5
│  (Classify intent)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────┐
│  Specialist Agents (parallel)       │  ← Claude Haiku 4.5
│  ┌──────────┐ ┌──────────┐        │
│  │ Medication│ │Insurance │  ...   │
│  │ Specialist│ │Navigator │        │
│  └──────────┘ └──────────┘        │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────┐
│  Main Agent          │  ← Claude Sonnet 4.6
│  (System prompt +    │
│   16 tools + merged  │
│   specialist context)│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Stream Response     │
│  + Extract Memories  │
│  + Execute Tools     │
└─────────────────────┘
```

## Models Used

| Model | Usage | Why |
|-------|-------|-----|
| Claude Sonnet 4.6 | Main chat responses | High-quality, nuanced responses |
| Claude Haiku 4.5 | Router, specialists, memory extraction | Fast, cheap for structured tasks |

## 6 Specialist Agents

### 1. Medication Specialist
- Drug interactions (CYP450 enzyme pathway awareness, severity classification)
- Dosing, frequency, refill coordination
- Pharmacy communication
- Photo label reading (pill bottle OCR)
- Chemo-specific side effect patterns (nadir timing, dose reductions)

### 2. Insurance Navigator
- Claims processing, denial analysis, appeal writing
- Prior authorization tracking
- Cost estimation using deductible/OOP data
- FSA/HSA optimization recommendations
- Coverage verification

### 3. Scheduling Coordinator
- Appointment scheduling and calendar management
- Pre-visit preparation (generates question lists based on upcoming visit type)
- Post-visit documentation (captures changes, follow-ups, new orders)
- Treatment cycle scheduling

### 4. Wellness Monitor
- Daily symptom tracking and trend analysis
- Caregiver burnout detection (validated screening questions)
- Sleep, mood, pain, energy pattern monitoring
- Emotional support and resource recommendations

### 5. Lab Analyst
- Lab result interpretation in plain English
- Abnormal value flagging with clinical context
- Trend identification across multiple results over time
- Oncology-specific ranges (e.g., chemo-induced neutropenia thresholds)

### 6. General Companion
- Profile management
- General health questions
- Navigation help within the app
- Document analysis
- Anything spanning multiple domains

## 16 Callable Tools

Claude can directly execute these structured actions during a conversation:

| # | Tool | Description |
|---|------|-------------|
| 1 | save_medication | Add a new medication to the user's record |
| 2 | update_medication | Modify an existing medication |
| 3 | remove_medication | Soft-delete a medication |
| 4 | save_appointment | Schedule a new appointment |
| 5 | save_doctor | Add a doctor to the care team |
| 6 | update_care_profile | Update patient demographics/diagnosis |
| 7 | save_lab_result | Record a lab test result |
| 8 | save_insurance | Add/update insurance plan details |
| 9 | estimate_cost | Estimate out-of-pocket cost for a service |
| 10 | set_medication_reminder | Create a reminder schedule |
| 11 | log_symptoms | Record daily symptom entry |
| 12 | get_symptom_trends | Retrieve symptom patterns over time |
| 13 | generate_visit_prep | Create pre-visit question list |
| 14 | save_visit_notes | Record post-visit notes |
| 15 | generate_health_summary | Create comprehensive health summary |
| 16 | save_memory | Manually save a fact to long-term memory |

## System Prompt

**File:** `src/lib/system-prompt.ts` (~85KB)

The system prompt is dynamically constructed for each user and includes:

- **Cancer-specific knowledge:** Chemo regimens (FOLFOX, FOLFIRI, AC-T), checkpoint inhibitors, targeted therapies, hormone therapies
- **Drug interaction awareness:** CYP450 enzyme pathways, severity classifications, contraindications
- **Lab interpretation:** Oncology-specific reference ranges, nadir tracking, treatment-related changes
- **Insurance navigation:** Appeal writing, prior auth processes, denial codes
- **Caregiver support:** Burnout detection questions, respite care resources, emotional validation
- **Safety disclaimers:** Never diagnose, never recommend starting/stopping medications, always defer to the care team
- **Treatment cycle awareness:** Side effect timing patterns, dose reduction protocols, recovery windows
- **Personalization:** Adapts greeting, focus areas, and examples based on cancer type and treatment phase

---

# 8. Memory System

## Overview

CareCompanion has a sophisticated long-term memory system that automatically extracts, categorizes, and recalls facts from conversations.

**Key Files:**
- `src/lib/memory.ts` — Core extraction, loading, referencing, summarization logic
- `src/lib/memory-conflict.ts` — Conflict resolution for contradictory facts

## Memory Lifecycle

### 1. Extraction (Automatic)

After every assistant response, Claude Haiku 4.5 analyzes the conversation and extracts structured facts:

- **13 Categories:** medication, condition, allergy, insurance, financial, appointment, preference, family, provider, lab_result, lifestyle, legal, other
- **Confidence Levels:** high, medium, low
- **Skip Patterns:** Greetings, messages under 20 characters, trivial exchanges (saves API costs)
- **Deduplication:** Facts are checked against existing memories within a 1-hour window per user to prevent duplicates

### 2. Loading (Per Session)

At the start of each chat interaction, the system loads the 150 most recently referenced memories for context. These are sorted by `lastReferenced` timestamp to prioritize the most relevant information.

### 3. Referencing (Usage Tracking)

When a memory is used in a response, its `lastReferenced` timestamp is updated. This ensures frequently-used facts stay at the top of the context window while stale facts naturally age out.

### 4. Conflict Resolution

When a new fact contradicts an existing memory (e.g., "My dosage changed from 5mg to 10mg"), the system:
- Identifies the conflict
- Marks the old memory as superseded
- Saves the new fact with the updated information
- Maintains a history of changes

### 5. Summarization

Every 20 messages, an automatic conversation summary is generated and stored. This provides high-level context without loading the full message history.

---

# 9. Frontend Components

## Component Count

The web app contains **101+ React components** organized by function.

## Core Layout Components

### AppShell (`src/components/AppShell.tsx`)
The main application wrapper providing:
- **Fixed Header:** Logo, profile switcher, global search, notification bell, menu button
- **Content Area:** Dynamic padding based on current route
- **Bottom Tab Bar:** 5 tabs (Home, Chat, Care, Scan, Settings)
- **Side Menu:** Emergency Card, Health Summary, Insurance, Settings
- **Features:** Profile switching for multi-profile support, role-based display (setup routes hide header/tabs), accessibility (skip-to-content link, ARIA labels)

### BottomTabBar (`src/components/BottomTabBar.tsx`)
- 5 tabs with SVG icons: Home, Chat, Care, Scan, Settings
- Active state: gradient fill, glow effect, text color change
- Ripple animation on press
- Fixed at bottom of viewport

## Page Components

### DashboardView (`src/components/DashboardView.tsx`)
The home screen displaying:
- Time-based greeting (Good morning/afternoon/evening)
- Priority card system (urgent, upcoming, alert, quick-ask)
- Medication refill alerts (urgent if ≤3 days)
- Upcoming appointments with expanded details
- Lab result insights
- Insurance claim status
- Treatment cycle tracker
- Profile completeness indicator
- Weekly health update sharing

### ChatInterface (`src/components/ChatInterface.tsx`)
The AI chat interface featuring:
- **AI SDK Integration:** `@ai-sdk/react` useChat hook with streaming
- **Message Bubbles:** Syntax highlighting, markdown rendering
- **Voice Input:** Web Speech API integration via useVoiceInput hook
- **Search:** Cmd+F conversation search
- **Document Scanner:** Inline scanner integration
- **Starter Prompts:** Colored icon cards for common queries
- **Controls:** New chat, regenerate, stop streaming
- **Auto-scroll:** Automatically scrolls to latest message

### MedicationsView (`src/components/MedicationsView.tsx`)
- Full CRUD: add, edit, delete medications
- Refill date tracking with urgency indicators
- Drug interaction checking (non-blocking background check)
- Modal-based add/edit forms

### CareView (`src/components/CareView.tsx`)
Multi-tab interface with:
- **Medications tab:** Medication management
- **Appointments tab:** Appointment scheduling
- **Labs tab:** Lab result viewing
- **Journal tab:** Symptom journaling
- **Care Team tab:** Team coordination
- Conflict detection via ConflictsView
- Visit preparation via VisitPrepSheet

### LabInterpretation (`src/components/LabInterpretation.tsx`)
Lab test knowledge base covering:
- WBC, RBC, Hemoglobin, Platelets, ANC, ALT, AST, Creatinine, BUN
- For each test: clinical description, low/high value meanings, patient advice
- Interactive expandable details

### InsuranceView (`src/components/InsuranceView.tsx`)
- Claims summary with status tracking
- Prior authorization management
- FSA/HSA balance tracking
- Deductible/OOP progress bars

### CareTeamView (`src/components/CareTeamView.tsx`)
- Invite members by email
- Manage roles (owner/editor/viewer)
- Activity feed
- Role-based permissions display

### HealthSummaryView (`src/components/HealthSummaryView.tsx`)
- AI-generated comprehensive health overview
- One-tap export: PDF or native share sheet
- Shareable link generation

### EmergencyCard (`src/components/EmergencyCard.tsx`)
- ICE (In Case of Emergency) information display
- Allergies, current medications, emergency contact
- One-tap 911 call button
- Designed for paramedic readability

### OnboardingWizard (`src/components/OnboardingWizard.tsx`)
6-step setup wizard:
1. **About You:** Patient name, age, relationship
2. **Diagnosis:** Cancer type selection (Breast, Lung, Colorectal, etc.), treatment tips
3. **Your Data:** Import options (manual, photo scan, connected apps)
4. **Details:** Medications, doctors, appointments manual entry
5. **Priorities:** Side effects, meds, appointments, labs, insurance, emotional support
6. **All Set:** Completion confirmation

Features: progress indicator, deep linking via URL params, analytics tracking

### SettingsPage (`src/components/SettingsPage.tsx`)
- Notification preferences (granular toggle control)
- Medication reminders management
- Theme toggle (dark/light/system)
- Password change
- Data export (CSV) and import
- Account deletion with confirmation
- Test data reset (demo mode)

### LoginForm & SignupForm
- Floating label inputs with focus animation
- Password visibility toggle
- Error alert display
- Trust badges (HIPAA-compliant, No ads, Your data)
- Password strength meter (signup)
- Demo data link

## Other Notable Components

| Component | Purpose |
|-----------|---------|
| DocumentScanner | Upload + OCR medical documents |
| DocumentOrganizer | File management and preview |
| AnalyticsDashboard | Medication adherence + trends |
| CalendarView | Monthly view with appointment/refill markers |
| TreatmentCycleTracker | Visual timeline of chemo/radiation |
| LabTrends | Recharts-powered trend charts |
| VisitPrepView | Questions/notes for doctor visits |
| AppealGenerator | Insurance claim appeal assistance |
| SymptomJournal | Daily symptom logging |
| ReminderManager | Medication reminder scheduling |
| ProfileCompleteness | Progress indicator for onboarding |
| AdherenceCalendar | 15-day medication adherence heatmap |
| CaregiverWellness | Burnout detection + resources |
| GlobalSearch | Full-text search across all data |
| ChatSearch | Conversation keyword search |
| NotificationBell | Dropdown with unread count, dismiss, mark all read |
| ConfirmDialog | Reusable confirmation for destructive actions |
| SkeletonCard | Loading placeholder with bone + pulse animation |
| DemoBanner | Banner for demo accounts |
| OfflineIndicator | Shows when user is offline |

## UI Library Components (`src/components/ui/`)

| Component | Features |
|-----------|----------|
| Button | Variants (primary/secondary/danger), ripple effect, loading spinner, 44px min height |
| FormField | Text/textarea/password/email/number, floating label, error display, ARIA |
| ConfirmDialog | Modal confirmation for destructive actions |
| ProgressBar | Visual progress indication |
| Card | Styled container |
| Badge | Status indicator |
| Alert | Information/warning/error display |
| Spinner | Loading indicator |
| Toast | Auto-dismissing notification |
| Tooltip | Hover information |

## Visual Effects & Animations

- Confetti particle burst (success celebrations)
- Ripple effect on button clicks
- Spinning conic-gradient borders (urgent alerts)
- Animated number counters (adherence %, costs)
- Ambient floating orbs (background decoration)
- Page blur-in transitions
- Skeleton loading animations (bone + pulse)
- Shake animation for disabled items

---

# 10. Design System & Styling

## Color Palette

### Dark Mode (Default)

| Token | Value | Usage |
|-------|-------|-------|
| Background | #0C0E1A | Main background |
| Background Warm | #10122B | Elevated surfaces |
| Primary Accent | #6366F1 | Indigo — trust, reliability |
| Secondary | #A78BFA | Lavender — compassion |
| Cyan | #67E8F9 | Information, links |
| Emerald | #6EE7B7 | Success, positive |
| Amber | #FCD34D | Warnings, attention |
| Rose | #FCA5A5 | Errors, urgent |
| Text Primary | #EDE9FE | Main text |
| Text Secondary | #A5B4CF | Supporting text |
| Text Muted | #5B6785 | Disabled/tertiary |
| Border | Purple-tinted | Subtle separation |

### Light Mode

Adjusted opacity and contrast for WCAG AA compliance with the same color scheme on lighter backgrounds.

## Typography

| Role | Font | Sizes |
|------|------|-------|
| Display | Figtree (Google Fonts) | 20-32px |
| Body | Noto Sans (Google Fonts) | 14-18px |

## Tailwind Configuration

**File:** `tailwind.config.ts`

- Extended with custom font families (display, sans)
- CSS variables for theming (switches between dark/light)
- Custom animations (shake, pulse, slide)

## Global CSS Features (`globals.css`)

- Custom scrollbar styling (thin, semi-transparent)
- Smooth scroll behavior
- Transition defaults for interactive elements
- Focus ring styles for accessibility

---

# 11. Providers & Context

## SessionProvider (`src/components/providers/SessionProvider.tsx`)
Wraps NextAuth's SessionProvider to enable the `useSession()` hook throughout the component tree.

## ThemeProvider (`src/components/ThemeProvider.tsx`)
- **Themes:** 'dark' (default), 'light', 'system'
- **Storage:** `localStorage` key `cc-theme`
- **Implementation:** Sets `data-theme="light"` on `<html>` element; listens for system preference changes via `matchMedia`
- **Hook:** `useTheme()` returns `{ theme, setTheme }`

## CsrfProvider (`src/components/CsrfProvider.tsx`)
- Reads CSRF token from `cc-csrf-token` cookie
- Falls back to fetching from `/api/health` endpoint if cookie missing
- Provides token via React context
- **Hook:** `useCsrfToken()` returns the current token string

## ToastProvider (`src/components/ToastProvider.tsx`)
- Context-based notification system
- Types: success, error, info
- Auto-dismiss: 3 seconds
- **Hook:** `useToast()` returns `{ showToast(message, type) }`

---

# 12. Hooks

## useVoiceInput (`src/hooks/useVoiceInput.ts`)

Web Speech API wrapper for voice-to-text in the chat interface:

- Continuous recognition mode
- Interim results (live transcription while speaking)
- Callbacks: `onTranscript`, `onInterim`
- Language support (default: en-US)
- Error handling (gracefully ignores 'no-speech' and 'aborted' errors)
- Browser compatibility check (returns `isSupported` flag)

---

# 13. TypeScript Types & Interfaces

**File:** `src/lib/types.ts`

Key interfaces used across the application:

```typescript
interface CareProfile {
  patientName: string
  patientAge: number
  relationship: string      // "self" | "parent" | "spouse" | "child" | "other"
  emergencyContact: object
  cancerType: string         // "Breast" | "Lung" | "Colorectal" | ...
  cancerStage: string        // "I" | "II" | "III" | "IV"
  treatmentPhase: string     // "Just Diagnosed" | "Active" | "Between" | "Remission"
  conditions: string[]
  allergies: string[]
  priorities: string[]
  onboardingCompleted: boolean
}

interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  prescribingDoctor?: string
  refillDate?: string
  pharmacy?: string
  notes?: string
}

interface Appointment {
  id: string
  doctorName: string
  specialty: string
  dateTime: string
  location?: string
  purpose?: string
}

interface LabResult {
  id: string
  testName: string
  value: string
  unit: string
  referenceRange: string
  isAbnormal: boolean
  dateTaken: string
}

interface Insurance {
  provider: string
  memberId: string
  groupNumber?: string
  deductibleUsed: number
  deductibleLimit: number
  oopUsed: number
  oopLimit: number
  planYear: string
}

interface Claim {
  serviceDate: string
  provider: string
  billedAmount: number
  paidAmount: number
  patientResponsibility: number
  status: "pending" | "approved" | "denied" | "appealed"
  denialReason?: string
  eobUrl?: string
}

interface SymptomEntry {
  painLevel: number         // 0-10
  mood: string
  sleepQuality: string
  appetite: string
  energy: string
  symptoms: string[]
  notes?: string
}

interface UserSettings {
  notificationPreferences: Record<string, boolean>
  quietHoursStart?: string
  quietHoursEnd?: string
  aiPersonality?: string
  theme: "dark" | "light" | "system"
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface CareTeamMember {
  id: string
  userId: string
  email: string
  displayName?: string
  role: "owner" | "editor" | "viewer"
  joinedAt: string
}
```

---

# 14. Mobile Application (Expo)

## Overview

The mobile app is built with Expo 52 (React Native 0.76.5) and mirrors the web app's functionality using the same API backend.

**Location:** `apps/mobile/`

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Expo | 52.0.0 | React Native framework |
| React Native | 0.76.5 | Mobile UI |
| Expo Router | File-based | Navigation |
| React Native Reanimated | 3.16.1 | Animations |
| Expo Vector Icons | — | Icon library (Ionicons) |
| AsyncStorage | — | Local data persistence |
| Expo SecureStore | — | Secure credential storage |
| expo-camera | — | Camera access |
| expo-image-picker | — | Photo library access |
| expo-auth-session | — | OAuth flows |
| expo-web-browser | — | In-app browser |

## Directory Structure

```
apps/mobile/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx             # Root layout
│   ├── login.tsx               # Login screen
│   ├── signup.tsx              # Registration screen
│   ├── (tabs)/                 # Tab navigation group
│   │   ├── _layout.tsx         # Tab bar configuration (5 tabs)
│   │   ├── index.tsx           # Home dashboard
│   │   ├── chat.tsx            # Chat interface
│   │   ├── care.tsx            # Medications/doctors/appointments
│   │   ├── scan.tsx            # Document scanning
│   │   └── settings.tsx        # Settings
│   ├── emergency.tsx           # ICE card (fullscreen)
│   ├── health-summary.tsx      # Export summary
│   ├── insurance.tsx           # Insurance details
│   ├── notifications.tsx       # Notification center
│   └── search.tsx              # Global search
├── src/
│   ├── components/             # 10+ custom components
│   │   ├── AmbientOrbs.tsx     # Floating background orbs
│   │   ├── GlassCard.tsx       # Frosted glass card effect
│   │   ├── RippleButton.tsx    # Ripple effect buttons
│   │   ├── ShimmerSkeleton.tsx # Loading placeholders
│   │   └── ...
│   ├── hooks/
│   │   ├── useGyroParallax.ts  # Device motion parallax
│   │   ├── useShakeDetector.ts # Shake gesture detection
│   │   └── useStaggerEntrance.ts # Staggered animation timing
│   ├── services/               # API integration
│   │   ├── auth.ts             # Authentication service
│   │   ├── chat.ts             # Chat API client
│   │   └── health.ts           # Health data service
│   ├── lib/
│   │   ├── analytics.ts        # Event tracking
│   │   ├── sentry.ts           # Error reporting
│   │   ├── feature-flags.ts    # Feature flag system
│   │   └── network-simulator.ts # Dev network simulation
│   ├── theme.ts                # Design tokens
│   └── context/
│       └── ProfileContext.tsx   # User session state
├── ios/                         # Native iOS project
├── android/                     # Native Android project
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies
```

## Navigation Structure

**5-Tab Layout:**
1. **Home** — Dashboard with upcoming appointments, refill alerts, adherence metrics
2. **Chat** — AI chat interface with real-time messaging
3. **Care** — Medications, doctors, appointments (read from web API)
4. **Scan** — Camera-based document scanning
5. **Settings** — Preferences, theme, logout

**Additional Screens (stack):**
- Emergency Card (fullscreen ICE display)
- Health Summary (exportable)
- Insurance Details
- Notification Center
- Global Search

## Theme System (`src/theme.ts`)

| Token | Values |
|-------|--------|
| Gradients | 9 gradient pairs (A/B) |
| Primary Colors | Indigo, purple, rose, blue (accent) |
| Spacing Scale | 4px to 128px |
| Typography | Inter font, 14-32px range |
| Shadows | Elevation-based shadow system |
| Border Radius | 4px to 24px scale |
| Dark/Light | Full mode support |

## Key Mobile Features

- **Tab navigation** with animated transitions
- **Real-time chat** with API streaming
- **Camera scanning** for medical documents
- **HealthKit sync** — Read medications, lab results, appointments from Apple Health
- **Push notifications** — Background delivery of medication reminders and alerts
- **Offline support** — AsyncStorage queue for messages sent without internet
- **Gyroscope parallax** — Subtle motion effect on cards
- **Shake gesture** — Quick access to emergency card
- **Staggered animations** — Smooth list entry animations

## EAS Build Configuration

**File:** `eas.json`

Configured for:
- **Development builds:** Internal distribution
- **Preview builds:** For testing (iOS TestFlight)
- **Production builds:** App Store / Google Play submission

---

# 15. Notifications & Reminders

## Notification System

### Types of Notifications

| Type | Example | Urgency |
|------|---------|---------|
| Medication Refill | "Tamoxifen refill due in 3 days" | High |
| Appointment Prep | "Oncology visit tomorrow — review prep questions" | Medium |
| Abnormal Lab | "WBC count below normal range" | High |
| Claim Denied | "Insurance claim #1234 denied" | Medium |
| Prior Auth Expiring | "Herceptin prior auth expires in 7 days" | High |
| Care Team Activity | "Jane updated medications" | Low |
| Weekly Summary | "Your weekly health update is ready" | Low |
| Caregiver Check-in | "How are you holding up this week?" | Low |

### Generation

**Cron Job:** `POST /api/notifications/generate` (runs daily at 9am UTC)

The notification engine scans:
- Medications approaching refill date (≤7 days)
- Appointments in the next 24 hours
- Lab results with abnormal flags
- Claims with denied status
- Prior authorizations approaching expiry
- Time since last caregiver wellness check

### Delivery Channels

1. **In-App:** NotificationBell component with dropdown, unread count, dismiss/read controls
2. **Web Push:** Via Web Push API (VAPID keys), sent to registered push subscriptions
3. **Email:** Via Resend API (for critical alerts)

## Medication Reminders

### Configuration

Users set reminders per medication:
- **Times:** Array of times (e.g., ["08:00", "20:00"])
- **Days:** Which days of the week
- **Active toggle:** On/off

### Processing

**Cron Job:** `POST /api/reminders/check` (runs throughout the day)

1. Query all active reminders for the current time window
2. For each due reminder, create a `reminder_log` entry with status "pending"
3. Send push notification to user's subscribed devices
4. Wait for user response (taken/missed)

### Response Tracking

Users respond via the app:
- **Taken:** Logs with timestamp, counts toward adherence
- **Missed:** Logs as missed, may trigger follow-up notification
- **No response:** After window expires, auto-marked as missed

### Adherence Tracking

The AdherenceCalendar component displays a 15-day heatmap showing:
- Green: all medications taken
- Yellow: some taken
- Red: medications missed
- Gray: no data

---

# 16. Cron Jobs & Scheduled Tasks

## Vercel Cron Configuration

**File:** `vercel.json`

All cron jobs are verified via a `CRON_SECRET` Bearer token in the Authorization header.

| Schedule | Path | Purpose |
|----------|------|---------|
| Daily 6am UTC | `/api/cron/sync` | Health system data sync (placeholder) |
| Daily 9am UTC | `/api/notifications/generate` | Generate proactive alerts |
| Daily 10am UTC | `/api/reminders/check` | Process medication reminders |
| Sundays 3am UTC | `/api/cron/purge` | Delete expired demo accounts |
| Sundays 4am UTC | `/api/cron/retention` | Apply data retention policies |
| Sundays 8am UTC | `/api/cron/weekly-summary` | Generate weekly conversation summaries |

## Job Details

### Sync (`/api/cron/sync`)
Currently a placeholder — the 1upHealth FHIR integration was removed. Ready for future EHR integrations (Epic, Cerner).

### Notification Generation (`/api/notifications/generate`)
Scans all users for actionable alerts and creates notification records.

### Reminder Check (`/api/reminders/check`)
Processes medication reminders, creates log entries, sends push notifications.

### Purge (`/api/cron/purge`)
Deletes demo accounts (where `isDemo = true`) with cascading deletes on all related data.

### Retention (`/api/cron/retention`)
Enforces data retention policies — removes old audit logs, expired shared links, stale conversation summaries.

### Weekly Summary (`/api/cron/weekly-summary`)
Generates conversation summaries for users who have had significant chat activity in the past week.

---

# 17. Email System

**File:** `src/lib/email.ts`

## Provider: Resend API

## Email Templates

| Template | Trigger | Content |
|----------|---------|---------|
| Welcome Email | Account registration | Onboarding guide, feature highlights |
| Care Team Invite | Team invitation | 7-day expiry link, role description |
| Password Reset | Reset request | Nonce-based reset link |

## Configuration

- **From address:** `CareCompanion <welcome@carecompanionai.org>`
- **Format:** HTML-only (no plain text alternative)
- **Fallback:** If `RESEND_API_KEY` not set, logs to console (dev-friendly)

---

# 18. Rate Limiting

**File:** `src/lib/rate-limit.ts`

## Implementation

- **Primary:** Upstash Redis with sliding window algorithm
- **Fallback:** In-memory bucketing when Redis is unavailable (local dev)
- **Cleanup:** Automatic bucket cleanup every 5 minutes (in-memory mode)

## Limits by Route

| Route | Limit | Window | Key |
|-------|-------|--------|-----|
| /api/chat | 30 req | 1 min | IP |
| /api/chat | 10 req | 1 min | User ID |
| /api/chat/guest | 15 req | 1 hour | IP |
| /api/care-team/invite | 20 req | 1 min | IP |
| /api/health-summary | 5 req | 1 min | IP |
| /api/demo/start | 10 req | 1 min | IP |
| Login attempts | 5 req | 15 min | Email |
| Agent calls (orchestrator) | 10 req | 1 min | User ID |

---

# 19. Environment Variables

## Required (Production)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for AI features |
| `AUTH_SECRET` | NextAuth JWT signing key (32+ bytes) |
| `AUTH_URL` | Production domain URL |
| `AWS_REGION` | AWS region for RDS (us-east-1) |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_RESOURCE_ARN` | Aurora cluster ARN |
| `AWS_SECRET_ARN` | Secrets Manager secret ARN |
| `COGNITO_USER_POOL_ID` | AWS Cognito pool ID |
| `COGNITO_CLIENT_ID` | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret |
| `CRON_SECRET` | Bearer token for Vercel cron verification |
| `KV_REST_API_URL` | Upstash Redis REST endpoint |
| `KV_REST_API_TOKEN` | Upstash Redis API token |
| `RESEND_API_KEY` | Email service API key |
| `NEXTAUTH_SECRET` | Alias for AUTH_SECRET |
| `TOKEN_ENCRYPTION_KEY` | Encrypts OAuth tokens at rest |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (client-exposed) |
| `NEXT_PUBLIC_APP_URL` | Frontend domain for redirects |

## Optional

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar OAuth |
| `OAUTH_STATE_SECRET` | OAuth state parameter encryption |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) |

## Supabase (Legacy)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key |

---

# 20. Deployment & Infrastructure

## Vercel Deployment

- **Platform:** Vercel (serverless)
- **Framework:** Next.js (auto-detected)
- **Build:** `next build` via Turbo
- **Functions:** Serverless with Fluid Compute
- **Cron Jobs:** 6 scheduled tasks (see Cron Jobs section)
- **Function Timeouts:**
  - Chat route: 60s (requires Pro plan)
  - Cron routes: 300s
  - All others: default

## Vercel Configuration (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/sync", "schedule": "0 6 * * *" },
    { "path": "/api/notifications/generate", "schedule": "0 9 * * *" },
    { "path": "/api/reminders/check", "schedule": "0 10 * * *" },
    { "path": "/api/cron/purge", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/retention", "schedule": "0 4 * * 0" },
    { "path": "/api/cron/weekly-summary", "schedule": "0 8 * * 0" }
  ]
}
```

## Database

- **Engine:** PostgreSQL (AWS Aurora Serverless v1)
- **Access:** Via RDS Data API (not direct TCP connection)
- **Migrations:** Drizzle ORM (`drizzle-kit push`)
- **Row-Level Security:** Application-enforced on all queries

## CI/CD Pipeline

1. **Pre-commit hooks (Husky):** lint-staged runs auto-formatting
2. **GitHub Actions CI:** lint → typecheck → test → build
3. **Vercel Deploy:** Automatic on push to main branch
4. **Preview Deploys:** On every PR

---

# 21. Testing Infrastructure

## Unit Tests (Vitest)

**Location:** `src/__tests__/`, `src/components/__tests__/`

Coverage areas:
- Notification toggling logic
- Memory extraction pipeline
- Drug interaction checking
- Rate limiter behavior
- API helper functions

**Run:** `npm run test:run`

## End-to-End Tests (Playwright)

**Location:** `e2e/`

Coverage areas:
- Authentication flow (login, signup, logout)
- Dashboard navigation and rendering
- Medication CRUD operations
- Lab results display
- Settings page interactions
- Chat message sending
- Onboarding wizard flow
- Notification interactions
- Accessibility audit
- Visual regression testing

**Run:** `npm run test:e2e`
**UI Mode:** `npm run test:e2e:ui`

## Validation Pipeline

**Run:** `npm run validate` (lint + typecheck + test:run)

---

# 22. Demo Mode

## Overview

CareCompanion offers a one-click demo experience that creates a realistic cancer care scenario.

## Flow

1. User clicks "Try Demo" on the landing page
2. `POST /api/demo/start` (rate limited: 10/min per IP)
3. System creates:
   - Ephemeral Cognito user (`demo-{uuid}@demo.carecompanionai.org`)
   - Local DB user with `isDemo = true`
4. Seeds realistic HER2+ Breast Cancer dataset
5. Mints JWT session cookie directly (no password exposure)
6. Redirects to `/dashboard?demo=started`

## Seed Data (HER2+ Breast Cancer Scenario)

- **Patient:** Sarah, 58, Stage IIIA HER2+ ER+ Breast Cancer, Cycle 4 of chemotherapy
- **8 Medications:** Herceptin, Pertuzumab, Docetaxel, Ondansetron, Dexamethasone, Tamoxifen, Lisinopril, Lorazepam
- **5 Doctors:** Oncologist, cardiologist, primary care, surgeon, nurse navigator
- **5 Appointments:** Oncology follow-up, labs, infusion, echocardiogram, surgical consult
- **10 Lab Results:** CBC panel showing nadir (low blood counts typical during chemo)
- **Insurance:** Blue Cross PPO with deductible/OOP tracking
- **4 Notifications:** Low WBC alert, refill reminder, appointment prep, claim status
- **7 Days of Symptom Journal:** Showing treatment fatigue pattern
- **Medication Reminders:** With response logs

## Demo Limitations

- Chat responses include signup CTA after 3-4 exchanges
- Conversations not persisted
- Full app access for 1 hour (session expires)
- DemoBanner component shows across all pages
- Demo accounts purged by weekly cron job

---

# 23. Shared Packages

## @carecompanion/types (`packages/types/`)

Shared TypeScript type definitions inferred from the database schema. Used by both web and mobile apps for type-safe data handling.

## @carecompanion/api (`packages/api/`)

Shared API client for cross-app communication. Provides typed methods for calling the web app's API routes from the mobile app or other consumers.

## @carecompanion/utils (`packages/utils/`)

Shared utility functions used across the monorepo (date formatting, string helpers, validation utilities).

## Workspace References

Internal packages are referenced using Bun's `workspace:*` protocol:

```json
{
  "@carecompanion/api": "workspace:*",
  "@carecompanion/types": "workspace:*",
  "@carecompanion/utils": "workspace:*"
}
```

---

# 24. Scripts & Tooling

## Root Monorepo Scripts

| Script | Command | Description |
|--------|---------|-------------|
| dev | turbo dev | Start all dev servers |
| build | turbo build | Build all packages |
| typecheck | turbo typecheck | TypeScript check all |
| lint | turbo lint | ESLint all |
| test:run | turbo test:run | Run all unit tests |
| seed:test-users | node scripts/seed-test-users.js | Generate demo accounts |

## Web App Scripts

| Script | Command | Description |
|--------|---------|-------------|
| dev | next dev | Dev server (port 3000) |
| build | next build | Production build |
| start | next start | Run production build |
| lint | next lint | ESLint |
| typecheck | tsc --noEmit | TypeScript check |
| test:run | vitest run | Unit tests |
| test:e2e | playwright test | E2E tests |
| test:e2e:ui | playwright test --ui | E2E with UI |
| validate | lint + typecheck + test:run | Full validation |
| db:push | drizzle-kit push | Apply DB migrations |
| db:studio | drizzle-kit studio | Visual DB editor |
| deadcode | knip | Dead code detection |

## Mobile App Scripts

| Script | Command | Description |
|--------|---------|-------------|
| start | expo start | Expo dev client |
| ios | expo run:ios | iOS build |
| android | expo run:android | Android build |
| prebuild | expo prebuild | Prebuild native deps |
| typecheck | tsc --noEmit | TypeScript check |

---

# 25. Monitoring & Analytics

## Error Tracking: Sentry

**Package:** `@sentry/nextjs` 10.50.0

- Captures unhandled exceptions and rejected promises
- Source maps uploaded on build for readable stack traces
- Session replay for debugging user issues
- Performance monitoring (transaction tracing)

## Product Analytics: PostHog

**Package:** `posthog-js` 1.371.2

- Event tracking (`trackEvent()` calls throughout the app)
- User identification on login
- Feature flag evaluation
- Funnel analysis (onboarding completion, feature adoption)

## Performance Analytics: Vercel Analytics

**Package:** `@vercel/analytics` 2.0.1

- Core Web Vitals monitoring
- Page load performance
- Function execution metrics
- Real user monitoring (RUM)

## API Metrics

**File:** `src/lib/api-metrics.ts`

`withMetrics()` wrapper function:
- Logs request start/end times
- Tracks duration in milliseconds
- Non-blocking (fire-and-forget)
- Data included in audit logs

---

# 26. HIPAA & Compliance

## HIPAA Compliance Measures

| Requirement | Implementation |
|------------|----------------|
| **Access Control** | NextAuth JWT sessions, role-based access (owner/editor/viewer) |
| **Audit Logging** | Every API call logged with user, action, IP, timestamp, status, duration |
| **Data Encryption** | HTTPS in transit, OAuth tokens encrypted at rest |
| **Minimum Necessary** | Row-level security — users see only their own data |
| **Consent Tracking** | HIPAA consent with version control, stored in users table |
| **Data Retention** | Configurable retention policies enforced by weekly cron job |
| **Account Deletion** | Soft delete with complete data removal workflow |
| **Data Export** | GDPR-compliant full data export endpoint |
| **Session Management** | 24-hour session expiry, httpOnly cookies |
| **PHI Protection** | No PHI in URLs, no PHI in error messages, no PHI in analytics |

## Audit Log Schema

Every API call records:
- `userId` — Who made the request
- `action` — What was done
- `resource` — What entity was affected
- `ipAddress` — Source IP
- `method` — HTTP method
- `path` — URL path
- `statusCode` — Response status
- `durationMs` — Processing time
- `timestamp` — When it happened

## Compliance Endpoints

- `GET /api/compliance/audit-log` — Access audit trail
- `GET /api/compliance/report` — Generate compliance report
- `GET /api/compliance/calendar` — Compliance event calendar

---

# 27. Architectural Decisions

## Key Design Choices

### 1. Multi-Agent AI System
**Decision:** Route each message to 1-6 specialist agents in parallel before generating the final response.
**Rationale:** Provides domain expertise at lower cost (Haiku for routing/specialists, Sonnet for final response). Specialists can be updated independently. Parallel execution minimizes latency.

### 2. Long-Term Memory
**Decision:** Automatic extraction + categorization + conflict resolution with 150-memory context window.
**Rationale:** Caregiving involves recurring topics over weeks/months. The AI needs to remember medication changes, appointment outcomes, and personal context without users repeating themselves.

### 3. Monorepo Architecture
**Decision:** Turborepo monorepo with shared types inferred from the database schema.
**Rationale:** Type safety across web and mobile apps, shared API client, single CI pipeline, and coordinated deployments.

### 4. Row-Level Security
**Decision:** All data filtered at the application layer by `userId`.
**Rationale:** Users cannot access each other's data even if application logic is bypassed. Defense in depth for PHI protection.

### 5. Soft Deletes
**Decision:** No hard deletes — `deletedAt` timestamps on all medical records.
**Rationale:** HIPAA audit trail preservation, accidental deletion recovery, and data retention compliance.

### 6. Serverless Architecture (Vercel)
**Decision:** Deploy on Vercel with serverless functions.
**Rationale:** Zero infrastructure management, automatic scaling, global CDN, built-in CI/CD, and Vercel AI SDK integration.

### 7. Edge-Safe Auth
**Decision:** Separate edge-compatible auth config (`auth.config.ts`) from full server config (`auth.ts`).
**Rationale:** Middleware runs at the edge and cannot use Node.js-only imports (bcrypt, AWS SDK, Drizzle). The edge config does lightweight JWT verification while the full config handles database operations.

### 8. Tool-Based AI
**Decision:** Claude can directly execute 16 structured tools (save medication, estimate cost, log symptoms).
**Rationale:** Eliminates the user → app → Claude → user feedback loop. The AI can take action immediately during conversation.

### 9. Cancer-Specific Personalization
**Decision:** System prompt adapts to cancer type, treatment phase, and user priorities.
**Rationale:** A breast cancer caregiver has different needs than a lung cancer caregiver. Treatment-specific knowledge improves response quality and trust.

### 10. Mobile-First Parity
**Decision:** Mobile app mirrors web functionality using the same API client and shared types.
**Rationale:** Caregivers need access on-the-go (hospital visits, pharmacy runs). The mobile app adds native capabilities (camera, HealthKit, push notifications).

---

# 28. Current Priorities & Roadmap

## Active Work Items

### P1 (Completed)
- Vercel Analytics installed
- HIPAA Terms of Service acceptance flow
- Guest conversation migration to authenticated accounts

### P2 (In Progress)
- A/B testing landing page CTA copy
- Mobile app full parity with web (Phase 0)
- Comprehensive testing strategy implementation

### P3 (Deferred)
- Multi-session guest conversation persistence
- Advanced lab result correlation across tests
- Community forum expansion

## Documentation & Plans

Located in `docs/superpowers/plans/`:
- Mobile full parity Phase 0 (visual fixes + broken functionality)
- Mobile UI elevation (polish)
- Mobile UI redesign (component overhaul)
- Monorepo iOS integration
- Bug fixes tracking (106 items)
- Testing strategy

---

# Appendix A: File Counts

| Category | Count |
|----------|-------|
| Web Components | 101+ |
| Mobile Components | 10+ |
| API Routes | 88+ |
| Page Routes | 15+ |
| Database Tables | 22+ |
| AI Tools | 16 |
| Specialist Agents | 6 |
| Cron Jobs | 6 |
| Custom Hooks | 5+ |
| Utility Modules | 65+ |
| Environment Variables | 25+ |

## Total Codebase Size

~50,000+ lines of TypeScript across web + mobile + shared packages.

---

# Appendix B: Complete Dependency List (Web)

| Package | Version |
|---------|---------|
| next | 14.2.35 |
| react | 18 |
| react-dom | 18 |
| drizzle-orm | 0.45.2 |
| ai | 6.0.142 |
| @ai-sdk/anthropic | 3.0.64 |
| @ai-sdk/react | 3.0.144 |
| next-auth | 5.0.0-beta.31 |
| tailwindcss | 3.4.1 |
| typescript | 5 |
| recharts | 3.8.1 |
| zod | 4.3.6 |
| jspdf | 4.2.1 |
| web-push | 3.6.7 |
| bcryptjs | 3.0.2 |
| postgres | 3.4.9 |
| @sentry/nextjs | 10.50.0 |
| posthog-js | 1.371.2 |
| @vercel/analytics | 2.0.1 |

---

*Generated April 2026 — CareCompanion Technical Documentation*
