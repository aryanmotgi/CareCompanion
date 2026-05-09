# CareCompanion

An AI-powered assistant for family caregivers managing medications, appointments, insurance, lab results, and health records for their loved ones.

Built with Next.js, Supabase, and Claude — designed to remember everything, coordinate care across providers, and support the caregiver as much as the patient.

## The Problem

Family caregivers manage an overwhelming amount of information: dozens of medications, multiple doctors, insurance claims, lab results, prior authorizations, and appointment schedules — often for multiple family members. Most of this lives in scattered paper records, portal logins, and memory.

CareCompanion centralizes it all into one AI assistant that remembers everything, proactively alerts you to what needs attention, and helps you navigate the healthcare system.

## Features

### Multi-Agent AI Chat
The core of CareCompanion is an intelligent chat interface powered by a multi-agent system:
- **Router** classifies each message and activates the right specialist(s)
- **6 Specialist Agents** run in parallel for complex queries:
  - **Medication Specialist** — drug interactions, dosing, refill tracking
  - **Insurance Navigator** — claims, denials, appeals, cost estimation
  - **Scheduling Coordinator** — appointments, visit prep, post-visit notes
  - **Wellness Monitor** — symptoms, caregiver support, emotional wellbeing
  - **Lab Analyst** — result interpretation, trends, abnormal flagging
  - **General Companion** — profile management, document analysis
- **16 Tools** Claude can call directly from chat (save medications, schedule appointments, log symptoms, estimate costs, etc.)

### Long-Term Memory
- Extracts facts from every conversation and saves them permanently
- Categorized memory: medications, conditions, allergies, insurance, preferences, family, providers
- Conversation summaries generated every 20 messages
- Memory referenced and prioritized by recency — the agent remembers what matters most

### Proactive Notifications
Cron-driven alerts every 15 minutes:
- Medication refills due within 3 days
- Appointments tomorrow (with prep prompts)
- Expiring prior authorizations
- New abnormal lab results
- Low FSA/HSA balances

### Medication Reminders
- Set daily reminders from chat: *"Remind me to take Metformin at 8am and 8pm"*
- Confirm taken, snooze 15 minutes, or auto-mark as missed after 2 hours
- Adherence tracking in the analytics dashboard

### Symptom Journal
Daily check-in tracking:
- Pain level (0-10), mood, sleep quality/hours, energy, appetite
- Symptom tags (headache, nausea, dizziness, etc.)
- Trend analysis over time via chat or analytics dashboard

### Care Team Sharing
- Invite family members by email with role-based access (Owner, Editor, Viewer)
- Activity feed: "Sarah added Metformin", "David joined the care team"
- 7-day expiring invitations

### Doctor Visit Prep & Summary
- **Before:** AI generates a prep sheet with medications, recent labs, questions to ask, things to bring
- **After:** Capture visit notes, medication changes, follow-ups, referrals — all saved to memory

### Health Summary Export
One-tap comprehensive document with everything a new doctor needs:
- Patient overview, medications, care team, lab results, health trends, insurance, visit notes
- Print or share via native share sheet

### Emergency Info Card
One-tap screen for paramedics or ER nurses:
- Patient name, age, allergies (highlighted), conditions, current medications, insurance, emergency contact
- Quick-call buttons for 911 and 988 Crisis Line

### Multi-Patient Support
Caregivers managing multiple family members can switch between profiles with a header dropdown.

### Calendar View
Monthly calendar with appointment dots and medication refill markers. Tap any date to see details.

### Analytics Dashboard
- Medication adherence rate
- Symptom trend sparklines (mood, sleep, pain)
- Lab result trends with change indicators
- Medical spending breakdown

### Voice Input
Browser-native speech-to-text in the chat. Tap the mic, speak, see words appear live.

### Cost Estimator
*"How much will an MRI cost me?"* — uses insurance deductible/OOP data to estimate patient responsibility.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Vercel AI SDK v6 |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| AI | Claude Sonnet 4.6 (chat), Claude Haiku 4.5 (routing, extraction, memory) |
| Auth | Supabase Auth (email/password, OAuth) |
| Health Data | FHIR R4 via 1upHealth (Epic, Sutter, Kaiser, Stanford, UCSF) |
| Cron | Vercel Cron (notifications, reminders, sync every 15 min) |
| Dev Coordination | CCSquad (multi-instance Claude Code coordination) |

## Database Schema

22 tables across 6 domains:

**Core:** `care_profiles`, `medications`, `doctors`, `appointments`, `documents`, `messages`

**Health Data:** `lab_results`, `insurance`, `claims`, `prior_auths`, `fsa_hsa`, `connected_apps`

**Intelligence:** `memories`, `conversation_summaries`, `notifications`

**Reminders:** `medication_reminders`, `reminder_logs`, `symptom_entries`

**Collaboration:** `care_team_members`, `care_team_invites`, `care_team_activity`

**Settings:** `user_preferences`

All tables enforce Row-Level Security — users can only access their own data.

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project
- Anthropic API key

### Setup

```bash
git clone https://github.com/your-username/carecompanion.git
cd carecompanion
npm install
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all required values.

### AWS / Database

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key (needs `cognito-idp:AdminDeleteUser` and RDS Data API access) |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `AWS_RESOURCE_ARN` | Yes | ARN of the Aurora Serverless cluster (used by RDS Data API) |
| `AWS_SECRET_ARN` | Yes | ARN of the Secrets Manager secret for database credentials |
| `DATABASE_URL` | Yes | Postgres connection string (used by Drizzle migrations) |

### AWS Cognito (Auth)

| Variable | Required | Description |
|----------|----------|-------------|
| `COGNITO_USER_POOL_ID` | Yes | AWS Cognito user pool ID |
| `COGNITO_DOMAIN` | Yes | Cognito hosted UI domain (e.g. `https://your-pool.auth.us-east-1.amazoncognito.com`) |
| `COGNITO_CLIENT_ID` | Yes | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Yes | Cognito app client secret |
| `COGNITO_ISSUER` | Yes | Cognito issuer URL (e.g. `https://cognito-idp.us-east-1.amazonaws.com/<pool-id>`) |
| `COGNITO_REGION` | Yes | AWS region for Cognito (e.g. `us-east-1`) |

### NextAuth

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Random string for NextAuth session signing |
| `NEXTAUTH_URL` | Yes | Your app URL (e.g. `http://localhost:3000`) |
| `AUTH_SECRET` | Yes | Auth.js secret (used by e2e sign-in route) |

### AI

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude chat and document extraction |

### Application URLs

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL used in emails, OAuth callbacks, and shared links. **Defaults to `http://localhost:3000` in development. You must set this to your production URL (e.g. `https://carecompanionai.app`) in Vercel environment settings, otherwise email links and OAuth redirects will point to localhost.** |
| `NEXT_PUBLIC_SITE_URL` | No | Site URL used in notification emails. Falls back to `https://carecompanionai.org` |

### Push Notifications (VAPID)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | VAPID public key for web push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key for web push notifications |

### Integrations (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID (calendar sync) |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `ONEUP_CLIENT_ID` | Optional | 1upHealth FHIR client ID |
| `ONEUP_CLIENT_SECRET` | Optional | 1upHealth FHIR client secret |
| `EPIC_CLIENT_ID` | Optional | Epic FHIR client ID |
| `EPIC_CLIENT_SECRET` | Optional | Epic FHIR client secret |
| `RESEND_API_KEY` | Optional | Resend API key for transactional emails |

### Infrastructure (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | Optional | Secret for authenticating Vercel Cron requests |
| `KV_REST_API_URL` | Optional | Vercel KV URL (enables Redis-backed rate limiting) |
| `KV_REST_API_TOKEN` | Optional | Vercel KV token |
| `TOKEN_ENCRYPTION_KEY` | Optional | 32-byte hex key for encrypting OAuth tokens at rest |
| `OAUTH_STATE_SECRET` | Optional | Secret for signing OAuth state parameters |
| `LOG_LEVEL` | Optional | Logging level (`debug`, `info`, `warn`, `error`). Defaults to `info` |

### Supabase (Legacy)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL (used by some legacy paths) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |

Create `.env.local`:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_RESOURCE_ARN=your-aurora-cluster-arn
AWS_SECRET_ARN=your-secrets-manager-arn
COGNITO_USER_POOL_ID=your-pool-id
COGNITO_DOMAIN=https://your-pool.auth.us-east-1.amazoncognito.com
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/your-pool-id
COGNITO_REGION=us-east-1
ANTHROPIC_API_KEY=your-anthropic-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run database migrations in the Supabase SQL Editor (in order):
1. `supabase/migrations/rls_policies.sql`
2. `supabase/migrations/integrations_tables.sql`
3. `supabase/migrations/memories_table.sql`
4. `supabase/migrations/care_team_tables.sql`
5. `supabase/migrations/medication_reminders_table.sql`
6. `supabase/migrations/multi_patient_support.sql`

Start the dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vercel Deployment Notes

- **`NEXT_PUBLIC_APP_URL`**: Defaults to `http://localhost:3000`. You **must** override this in your Vercel project environment settings with your production URL (e.g. `https://carecompanionai.app`). If left unset, email invitation links, OAuth callback URLs, and shared links will incorrectly point to localhost.
- **Chat API timeout**: The chat route (`/api/chat`) sets `maxDuration = 60` (60 seconds). This **requires the Vercel Pro plan or higher**. The Hobby plan caps function execution at 10 seconds, which is not enough for multi-agent AI responses. Several other API routes (`/api/cron/sync`, `/api/cron/weekly-summary`) use up to 300 seconds and also require Pro.
- **Cron jobs**: Vercel Cron is used for notifications, medication reminders, and health data sync. Set the `CRON_SECRET` environment variable and configure cron schedules in `vercel.json`.

## Architecture

```
User Message
    |
    v
[Router Agent - Haiku]
    |
    v
[Specialist Agents - parallel]
  |        |         |        |        |
  v        v         v        v        v
 Med    Insurance  Schedule  Wellness  Labs
  |        |         |        |        |
  v        v         v        v        v
[Merged Context]
    |
    v
[Main Agent - Sonnet + Tools]
    |
    v
[Stream Response + Memory Extraction + Tool Execution]
```

## Safety & Disclaimers

CareCompanion is designed with medical safety as a core principle:
- Never diagnoses conditions
- Never recommends starting, stopping, or changing medications
- Never declares drug combinations "safe"
- Always includes appropriate disclaimers for medical, insurance, and financial topics
- Directs to 911 for emergencies
- All health guidance is informational — always defers to healthcare providers

## License

MIT
