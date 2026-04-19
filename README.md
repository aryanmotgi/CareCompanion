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

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase/Postgres connection string |
| `NEXTAUTH_SECRET` | ✅ | Random string for NextAuth session signing |
| `NEXTAUTH_URL` | ✅ | Your app URL (e.g. http://localhost:3000) |
| `COGNITO_CLIENT_ID` | ✅ | AWS Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | ✅ | AWS Cognito app client secret |
| `COGNITO_ISSUER` | ✅ | Cognito user pool issuer URL |
| `COGNITO_USER_POOL_ID` | ✅ | AWS Cognito user pool ID (for AdminDeleteUser) |
| `AWS_REGION` | ✅ | AWS region (e.g. us-east-1) |
| `AWS_ACCESS_KEY_ID` | ✅ | AWS IAM access key (needs cognito-idp:AdminDeleteUser) |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS IAM secret key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public app URL for emails and shared links |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⚠️ | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | ⚠️ | VAPID private key for push notifications |

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
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
