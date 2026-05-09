# CareCompanion — Complete Product & Technical Rundown

*Generated April 25, 2026*

---

## What Is CareCompanion?

CareCompanion is an AI-powered healthcare coordination platform built for family caregivers managing a loved one's cancer care. It centralizes everything — medications, appointments, lab results, insurance claims, doctor contacts, and symptom tracking — into one intelligent assistant that remembers context across conversations, proactively alerts users to what needs attention, and helps navigate the healthcare system.

**The core problem:** Family caregivers are overwhelmed managing dozens of medications, multiple doctors, insurance claims, prior authorizations, lab results, and appointment schedules — all scattered across paper records, hospital portals, and memory. CareCompanion replaces that chaos with a single AI assistant.

**Three user roles:**
- **Caregiver** — A family member or friend helping a patient manage their care
- **Patient** — Managing their own cancer journey, optionally with a caregiver
- **Self-care** — Managing their own health independently

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Mobile | React Native (Expo), Expo Router |
| Database | Aurora Serverless v2 (PostgreSQL), Drizzle ORM |
| Auth | NextAuth.js v5, bcryptjs, Google & Apple OAuth |
| AI | Claude Sonnet 4.6 (main), Claude Haiku 4.5 (routing/memory) |
| AI SDK | Vercel AI SDK v6 (`streamText`) |
| Email | Resend |
| Rate limiting | Upstash Redis / Vercel KV |
| Hosting | Vercel (web + cron jobs) |
| Error tracking | Sentry |
| Monorepo | Turborepo + Bun |

---

## Monorepo Structure

```
carecompanion/
├── apps/
│   ├── web/          Next.js 14 — main web app
│   ├── mobile/       Expo React Native — iOS & Android
│   └── video/        Remotion — marketing video generation
├── packages/
│   ├── api/          Shared API client
│   ├── types/        Shared TypeScript types
│   └── utils/        Shared utilities (FHIR, dates, validation)
├── scripts/          Seed scripts for test accounts
├── docs/             Design docs, specs, plans
└── vercel.json       Cron jobs + build config
```

---

## Authentication

### Methods
1. **Email / Password** — bcrypt hashing, rate-limited (5 attempts / 15 min / email), token-based password reset
2. **Google OAuth** — Social sign-in, optional Google Calendar sync
3. **Apple OAuth** — Social sign-in
4. **Care Group Login** — Shared family name + password that resolves to the group owner's account

### How it works
- NextAuth.js v5 with JWT sessions
- `AUTH_URL` must be set to the production URL in Vercel env vars
- `trustHost: true` in auth config
- Role (`caregiver` / `patient` / `self`) is stored in the JWT and the `users.role` column
- Pre-existing users with no role are redirected to `/set-role` on first private-page access
- Demo users (created via `/api/demo/start`) bypass the role redirect

### Session storage
- Web: NextAuth cookie (`authjs.session-token` / `__Secure-authjs.session-token` in prod)
- Mobile: `expo-secure-store`

---

## Database — 40+ Tables

### Core
| Table | Purpose |
|---|---|
| `users` | Accounts (email, password hash, OAuth sub, HIPAA consent, role) |
| `care_profiles` | Patient profiles (name, age, cancer type/stage, allergies, onboarding status) |
| `conversations` | Chat threads |
| `messages` | Chat messages (role: user/assistant, content) |

### Health Data
| Table | Purpose |
|---|---|
| `medications` | Medications with dose, frequency, refill date, pharmacy, FHIR ID |
| `doctors` | Doctor contacts (name, specialty, phone) |
| `appointments` | Appointments (date/time, doctor, location, FHIR ID) |
| `lab_results` | Lab tests (value, unit, reference range, abnormal flag, FHIR ID) |
| `documents` | Uploaded / scanned documents |
| `treatment_cycles` | Cancer treatment cycles (cycle #, start, length, regimen) |

### Insurance & Financial
| Table | Purpose |
|---|---|
| `insurance` | Plan details (provider, member ID, group #, deductible, OOP limit) |
| `claims` | Claims (billed / paid / patient responsibility, denial reason) |
| `prior_auths` | Prior authorizations (status, expiry, sessions approved/used) |
| `fsa_hsa` | FSA/HSA accounts (balance, contribution limit) |

### AI & Memory
| Table | Purpose |
|---|---|
| `memories` | Extracted facts from conversations (category, fact, confidence) |
| `conversation_summaries` | Auto-summaries every 20 messages |

### Reminders & Tracking
| Table | Purpose |
|---|---|
| `medication_reminders` | Reminder schedules (times, days of week) |
| `reminder_logs` | Responses (pending / confirmed / missed) |
| `symptom_entries` | Daily journal (pain 0–10, mood, sleep, appetite, energy, symptoms) |

### Care Collaboration
| Table | Purpose |
|---|---|
| `care_team_members` | Team access (role: owner / editor / viewer) |
| `care_team_invites` | Pending invites (email, role, 7-day expiry) |
| `care_team_activity` | Activity log |
| `care_groups` | Multi-caregiver groups (name, password hash) |
| `care_group_members` | Group membership (role: owner / member) |
| `care_group_invites` | Group invite tokens (single-use, 7-day expiry) |

### Notifications & Push
| Table | Purpose |
|---|---|
| `notifications` | Notification inbox (type, title, message, is_read) |
| `push_subscriptions` | Web push endpoints (VAPID) |
| `notification_deliveries` | Delivery log with category |

### Other
| Table | Purpose |
|---|---|
| `user_settings` | Notification preferences, quiet hours, AI personality |
| `shared_links` | Shareable health summaries (token, 24h expiry) |
| `community_posts` | Anonymous caregiver forum posts |
| `community_replies` | Forum replies |
| `audit_logs` | HIPAA audit trail (user, action, IP, status, duration) |
| `connected_apps` | OAuth tokens for Google / Apple / 1upHealth / Epic |

---

## AI Architecture

### Multi-Agent System

```
User Message
    ↓
Router Agent (Claude Haiku) — classifies intent
    ↓
6 Specialist Agents (parallel, Claude Haiku)
├── Medication Specialist — interactions, refills, side effects
├── Insurance Navigator — claims, denials, appeals, cost estimation
├── Scheduling Coordinator — appointments, prep, follow-ups
├── Wellness Monitor — symptoms, caregiver support, emotional wellbeing
├── Lab Analyst — result interpretation, trends, abnormal flags
└── General Companion — profile management, document analysis
    ↓
Main Agent (Claude Sonnet 4.6) — synthesizes + responds with tools
    ↓
Streamed Response + Async Memory Extraction
```

### 16+ Claude Tools (callable during chat)
`save_medication` · `update_medication` · `remove_medication`
`save_appointment` · `update_appointment` · `remove_appointment`
`save_doctor` · `save_lab_result` · `set_reminder` · `remove_reminder`
`save_symptom_entry` · `save_memory` · `estimate_cost` · and more

### Memory System
- After every assistant response, Claude Haiku extracts facts into the `memories` table
- 13 categories: medication, condition, allergy, insurance, financial, appointment, preference, family, provider, lab_result, lifestyle, legal, other
- Top 150 memories injected into every chat session
- Auto-summarizes conversations every 20 messages

### Role-Aware Prompting
- `buildRoleContext()` prepends user role + primary concern + caregiving experience to every session
- Example: *"The user is a first-time caregiver helping a patient manage their cancer care. Their primary concern is managing medications — prioritize tracking, dose schedules, and drug interactions."*

### Safety
- Never diagnoses conditions
- Never recommends medication changes without provider involvement
- Directs to 911 for emergencies
- Pre-screens for account-management intents

---

## Pages — Web App

### Public
| Route | What it does |
|---|---|
| `/` | Landing page (hero, features, interactive demo button) |
| `/about` | About + mission |
| `/demo-walkthrough` | Product walkthrough page |
| `/privacy` | Privacy policy (HIPAA, encryption, RLS) |
| `/terms` | Terms of service |
| `/contact` | Contact form |
| `/chat/guest` | Guest AI chat — no account needed |
| `/shared/[token]` | Shared health summary (7-day expiry) |
| `/conditions/[regimen]` | Public treatment regimen info pages |

### Auth
| Route | What it does |
|---|---|
| `/login` | Login (email + password, Google, Apple, Care Group tab) |
| `/signup` | Sign up with role selection |
| `/set-role` | Role picker for pre-existing users with no role |
| `/reset-password` | Request password reset |
| `/reset-password/confirm` | Confirm reset with token |
| `/consent` | HIPAA consent acknowledgment |
| `/join` | Deep link to join a care group via invite token |

### App (authenticated)
| Route | What it does |
|---|---|
| `/dashboard` | Home — proactive alerts, health snapshot |
| `/chat` | Main AI chat |
| `/medications` | Medication list, refills, reminders |
| `/appointments` | Calendar view, appointment details |
| `/labs` | Lab results with trend graphs and abnormal flags |
| `/insurance` | Insurance plan, claims, deductible tracker |
| `/calendar` | Monthly calendar (appointments + refill dates) |
| `/journal` | Daily symptom check-in and mood log |
| `/analytics` | Medication adherence, symptom trends, spending |
| `/health-summary` | Generated comprehensive health document |
| `/emergency` | Emergency card (name, allergies, meds, contacts) |
| `/care-team` | Manage care team members and invites |
| `/care-hub` | Shared care team dashboard |
| `/records` | Document library |
| `/scans` | OCR-extracted document data |
| `/visit-prep` | AI-generated pre-visit prep sheet |
| `/notifications` | Notification inbox |
| `/timeline` | Activity timeline |
| `/community` | Anonymous caregiver forum by cancer type |
| `/profile` | Patient profile |
| `/settings` | Notification preferences, quiet hours |
| `/onboarding` | Onboarding wizard (CareGroupScreen → Caregiver/Patient wizard) |

---

## Onboarding Flow (New — v0.2.0.0)

### Caregiver path (6 steps)
1. Sign up with role = Caregiver
2. Care Group — create (QR + invite link) or join (name + password) or skip
3. About your patient — name, relationship, caregiving experience
4. Primary concern — 4 tiles (medications / lab results / coordinating care / emotional support) — personalizes AI
5. Apple Health explainer — instruct patient to connect hospital
6. Diagnosis (placeholder, overwritten by FHIR sync), priorities, notifications

### Patient path (4 steps)
1. Sign up with role = Patient
2. Care Group — join caregiver's group or create own or skip
3. Apple Health — search hospital, connect → confirm records (editable, field overrides protect manual edits from sync overwrites) OR skip → manual entry
4. Priorities, notifications

### Care Group mechanics
- Creator sets a family name + shared password
- QRCodePanel shows a 10-minute countdown QR code that blurs on expiry (tap to regenerate)
- Native share sheet / copy link for remote inviting
- Status polling every 3s: ConnectedCelebration screen fires when second member joins
- Group login on `/login` → Care Group tab resolves to owner's account

---

## API Routes — Key Ones

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Main AI chat (60s, streaming) |
| `/api/chat/guest` | POST | Demo chat (no auth) |
| `/api/auth/register` | POST | Email/password signup |
| `/api/auth/set-role` | POST | Set role for pre-existing user |
| `/api/care-group` | POST | Create care group |
| `/api/care-group/join` | POST | Join by name + password |
| `/api/care-group/invite` | POST | Generate invite token |
| `/api/care-group/[id]/status` | GET | Poll for second member joining |
| `/api/onboarding/complete` | POST | Mark onboarding done + send recap email |
| `/api/records/medications` | GET/POST | Read/write medications |
| `/api/records/appointments` | GET/POST | Read/write appointments |
| `/api/records/labs` | GET/POST | Read/write lab results |
| `/api/notifications/generate` | POST | Cron — generate daily alerts |
| `/api/reminders/check` | POST | Cron — check medication reminders |
| `/api/healthkit/sync` | POST | Sync Apple Health data (FHIR) |
| `/api/health-summary` | GET/POST | Get or generate health summary |
| `/api/share` | POST | Create shareable summary link |
| `/api/export/pdf` | POST | Export to PDF |
| `/api/insurance/appeal` | POST | Generate appeal letter |
| `/api/demo/start` | POST | Create demo session (no auth) |
| `/api/test/reset` | POST | Reset test account data (dev only) |
| `/api/health` | GET | Health check |

---

## Cron Jobs

| Schedule | Route | Purpose |
|---|---|---|
| Daily 6am | `/api/cron/sync` | Health data sync |
| Daily 9am | `/api/notifications/generate` | Proactive alerts (refills, appointments, labs, FSA balance) |
| Daily 10am | `/api/reminders/check` | Medication reminders due today |
| Sunday 3am | `/api/cron/purge` | Delete expired shared links and old invites |
| Sunday 4am | `/api/cron/retention` | Data retention cleanup |
| Sunday 8am | `/api/cron/weekly-summary` | Weekly care summary email |

All cron jobs are authenticated with `CRON_SECRET`.

---

## Mobile App

Built with Expo (React Native). Main screens:

| Screen | Purpose |
|---|---|
| Dashboard | Health alerts + quick actions |
| Chat | AI assistant |
| Care | Tabs: medications / appointments / labs |
| Emergency | Emergency card with 911 / 988 buttons |
| Scan | OCR document capture |
| Notifications | Alert center |
| Health Connect | Apple HealthKit sync status |
| Settings | Preferences |

**HealthKit integration:** Syncs steps, heart rate, workouts, sleep data. Hospital connections via Apple Health Records (FHIR) pull diagnosis, medications, and labs automatically.

---

## Third-Party Services

| Service | What it does |
|---|---|
| Anthropic (Claude) | AI chat, memory extraction, document analysis |
| Vercel | Hosting, cron jobs, KV/Redis |
| Aurora Serverless | PostgreSQL database (AWS RDS Data API) |
| Resend | Transactional email (welcome, reset, recap) |
| Upstash Redis | Rate limiting |
| 1upHealth | FHIR broker for Epic/Cerner/Kaiser hospital connections |
| Google OAuth | Social sign-in + Calendar sync |
| Apple OAuth | Social sign-in |
| Sentry | Error tracking (web + mobile) |
| VAPID / Web Push | Browser push notifications |
| Remotion | Marketing video generation |

---

## Environment Variables

```bash
# AI
ANTHROPIC_API_KEY

# Auth
AUTH_SECRET
AUTH_URL                        # Must be production URL (e.g. https://carecompanionai.org)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APPLE_CLIENT_ID
APPLE_CLIENT_SECRET

# Database (Aurora)
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_RESOURCE_ARN
AWS_SECRET_ARN
DATABASE_URL                    # For Drizzle migrations

# Email
RESEND_API_KEY

# Redis / Rate Limiting
REDIS_URL
KV_REST_API_URL
KV_REST_API_TOKEN

# Health Data
ONEUP_CLIENT_ID
ONEUP_CLIENT_SECRET

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPIR_PRIVATE_KEY

# Security
TOKEN_ENCRYPTION_KEY            # 32-byte hex key for OAuth token encryption
CRON_SECRET                     # Authenticates Vercel cron requests

# App
NEXT_PUBLIC_SITE_URL            # https://carecompanionai.org
NEXT_PUBLIC_TEST_MODE           # Set to "true" to enable test reset endpoint in prod
```

---

## Test Account

For testing the full signed-in experience:

| Field | Value |
|---|---|
| Email | `tester1@test.carecompanionai.org` |
| Password | `CareTest2026!` |
| Patient | Margaret Chen, 58F |
| Cancer | Breast Cancer, Stage III |
| Data | 6 medications, 6 appointments, 10 lab results, 4 doctors |

Reset to clean seed data anytime: `POST /api/test/reset` (while logged in as this account).

To fix role after Aurora migration: `UPDATE users SET role = 'patient' WHERE email = 'tester1@test.carecompanionai.org';`

---

## Version History

| Version | Date | Summary |
|---|---|---|
| 0.2.0.0 | 2026-04-25 | Auth/onboarding redesign — roles, Care Group linking, split wizards, role-aware AI |
| 0.1.2.0 | 2026-04-06 | Onboarding overhaul, guided tour, unified setup flow |

---

*CareCompanion — making cancer caregiving less overwhelming, one conversation at a time.*
