# CareCompanion Frontend Polish & Feature Buildout

> **For agentic workers:** This spec covers the full frontend polish pass and new feature pages. Use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** Bring every page in the app up to the premium mobile-first design standard with consistent futuristic effects, and build out missing functionality (expandable detail views, polished chat UI, document scan hub, full settings hub, living health profile).

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Supabase, Claude API (vision for document scanning)

**Conventions:**
- Named exports for all components (`export function Foo`, NOT `export default`)
- Supabase browser client: `import { createClient } from '@/lib/supabase/client'`
- Supabase server client: `import { createClient } from '@/lib/supabase/server'`
- Foreign key on medications/appointments/doctors: `care_profile_id` (NOT `profile_id`)

---

## Design System (Applied Globally)

All pages must use these consistent design tokens (these override any older tokens in globals.css):

- **Glass cards:** `bg-white/[0.04]` with `border border-white/[0.06]`, `backdrop-blur` where appropriate
- **Gradient accents:** `from-indigo-500 to-cyan-400` for CTAs, active states, avatar rings. This is the canonical gradient — replace any older `blue-500 -> violet-500` gradients.
- **Animations:** `card-stagger-in` on page load (staggered by index), `slide-up` for modals/sheets, `animate-press` on all tappable elements
- **Glow effects:** Subtle cyan glow (`box-shadow: 0 0 20px rgba(34,211,238,0.1)`) on interactive focus states, gradient borders on expanded/active cards
- **Typography:** `text-[#f1f5f9]` (slate-50) headers, `text-[#e2e8f0]` (slate-200) body, `text-[#94a3b8]` (slate-400) secondary, `text-[#64748b]` (slate-500) tertiary
- **Section labels:** Uppercase, letter-spacing 1px, `text-[#64748b]`, font-size 11px
- **Card radius:** 12px standard, 10px for inner elements, 8px for tags/badges
- **Status colors:** Red `#ef4444` (urgent/high/abnormal), Yellow `#fbbf24` (warning/moderate), Cyan `#22d3ee` (info/active), Green `#10b981` (success/connected)

## Shared Component: ExpandableCard

Both Dashboard and Care tab use expandable cards. Build a shared `ExpandableCard` component:

- **Props:** `expanded: boolean`, `onToggle: () => void`, `children` (collapsed content), `expandedContent` (revealed on expand)
- **Behavior:** Smooth `max-height` + opacity CSS transition (~300ms ease). Only one card expanded at a time per list (parent manages state).
- **Visual:** Collapsed shows chevron `▸`, expanded shows `▾`. Expanded card gets cyan border `border-[rgba(34,211,238,0.2)]`.
- **Accordion:** Parent component tracks `expandedId` state. Clicking a card sets `expandedId` to that card's ID (or null if already expanded).

## 1. Dashboard Polish

**Current state:** Priority card feed with greeting header and staggered animations. Already has glow-pulse on urgent cards.

**Changes:**
- Wrap each priority card in `ExpandableCard`
- Urgent medication cards expanded state: detail grid (doctor, refill date, remaining) + "Call Pharmacy" button (`tel:` link using `pharmacy_phone` from medications table — show button only if `pharmacy_phone` is set)
- Upcoming appointment cards expanded state: location, purpose, "Get Directions" link (`https://maps.google.com/?q={location}`)
- Alert lab cards expanded state: value vs. reference range with progress bar (see Parsing Rules below)
- Quick-ask AI card at bottom: 3 hardcoded prompt buttons ("Prepare for my appointment", "Explain my lab results", "What should I ask my doctor?") — tapping navigates to `/chat?prompt={encodeURIComponent(text)}`
- AnimatedNumber counters for the summary count

**Empty state:** When zero priority items exist, show a centered illustration with message: "All clear! No items need your attention right now." with a subtle checkmark icon.

## 2. Care Tab — Expandable Cards

**Current state:** SegmentControl toggling Medications/Appointments lists with BottomSheet for add/detail views.

**Changes:**
- Replace BottomSheet detail views with `ExpandableCard` for both medications and appointments
- **Medication expanded state:**
  - Detail grid: Doctor (`prescribing_doctor`), Refill date (`refill_date`), Remaining (`quantity_remaining`), Frequency (`frequency`)
  - "Call Pharmacy" button (`tel:{pharmacy_phone}`) — only shown if `pharmacy_phone` is non-null
  - "Edit" button (opens edit form in BottomSheet — keep BottomSheet for editing only)
- **Appointment expanded state:**
  - Location (`location`) with "Get Directions" link
  - Purpose (`purpose`)
  - "Call Office" button — looks up doctor's phone from `doctors` table by matching `doctor_name` to `doctors.name`. Only shown if a matching doctor with a phone number is found.
  - "Prepare with AI" button → navigates to `/chat?prompt=Help me prepare for my {specialty} appointment with {doctor_name}`
- Keep BottomSheet for add-new forms (Add Medication, Add Appointment)

## 3. Chat Page — Visual Polish

**Current state:** Basic ChatInterface with message history. Uses Vercel AI SDK for streaming.

**Changes (frontend styling only — no backend changes):**
- **User messages:** Gradient bubbles (`from-indigo-500 to-cyan-400`), right-aligned, rounded `16px 16px 4px 16px`
- **AI messages:** Left-aligned with AI avatar (gradient circle with "AI" text), glass-card bubbles with `bg-white/[0.06]`, rounded `4px 16px 16px 16px`
- **Markdown rendering:** AI responses rendered with basic markdown support (bold, italic, lists, headers) using existing prose styling
- **Typing indicator:** Three animated dots with staggered bounce animation
- **Input bar:** Glass card style with gradient send button, placeholder "Ask about your health..."
- **Message animations:** New messages slide up with fade-in
- **Starter prompts:** Show 3 hardcoded prompt buttons when conversation is empty: "How are my vitals?", "Prepare for my next appointment", "Explain my medications". These are derived from the patient's data labels (e.g., if patient has appointments, show appointment prompt). Prompts disappear once conversation starts.

**Note:** Rich data cards in AI responses (lab cards, medication cards embedded inline) are deferred to the backend phase. This phase focuses on visual styling of the chat UI only.

## 4. Scans — Document Hub Redesign

**Current state:** ScanCenter component with DocumentScanner and CategoryScanner. Existing categories: Medication, Lab Report, Insurance Card, EOB/Bill, Doctor Note.

**Category mapping (old → new):**
- Medication → Prescriptions
- Lab Report → Lab Reports
- Insurance Card + EOB/Bill → Insurance/EOBs
- Doctor Note → Medical Records

**Changes:**
- **Category grid** (2x2) at top: Lab Reports, Prescriptions, Insurance/EOBs, Medical Records
  - Each category card: colored tint background, emoji icon, document count from `documents` table filtered by `type`
  - Tap a category → filters the recent scans list below to that category
- **Recent scans list** below the grid:
  - Each row: category icon, description (`documents.description`), date (`documents.document_date`), type badge
  - Tap → opens document viewer (existing functionality)
- **Scan button** at bottom: full-width gradient CTA "Scan New Document"
- Keep existing scan/upload flow from `DocumentScanner` and `CategoryScanner` — this phase reskins the hub UI, not the scan flow itself

**AI extraction and auto-import:** Deferred to backend phase. The existing scan flow already sends documents to the API for processing. This phase focuses on the hub UI redesign only.

## 5. Settings — Full Settings Hub

**Current state:** Basic SettingsPage with connected apps and notifications.

**Changes — complete rebuild as iPhone-style grouped settings:**

### Notifications
- Refill Reminders (toggle) — "Alert when medications are running low"
- Appointment Reminders (toggle) — "24 hours and 1 hour before"
- Lab Result Alerts (toggle) — "Notify when new results are available"
- Claim Updates (toggle) — "Status changes on insurance claims"

**Storage:** Toggle state stored in new `user_settings` table (see Database Changes). Default all toggles to `true`.

### Connected Accounts
- List of integration sources from `connected_apps` table
- Each shows connection status: "Connected" (green) with last synced date, or "Not connected" (gray)
- Tap → navigates to `/connect` page

### App Preferences
- Theme: Dark mode (show as default, non-toggleable for now)
- AI Personality: Professional / Friendly / Concise (stored in `user_settings.ai_personality`, default "professional")

### Privacy & Security
- Export My Data → calls `/api/export-data` endpoint which queries all user tables and returns JSON download. **Requires a new API route** (paired backend work).
- Change Password → calls `supabase.auth.updateUser({ password })` with a simple password form
- Delete Account → confirmation dialog → calls `/api/delete-account` which uses service-role to delete all user data + auth account. **Requires a new API route** (paired backend work).

### About
- App Version: hardcoded string "1.0.0"
- Terms & Privacy Policy: link to `#` (placeholder)

**UI pattern:** Grouped glass cards with thin dividers (`border-white/[0.04]`) between rows. Each row: label on left, value/toggle/chevron on right. Section headers are uppercase gray section labels above each group.

## 6. Profile — Living Health Dashboard

**Current state:** ProfileEditor with form fields for patient info, conditions, allergies, doctors.

**Changes — rebuild as a read-first dashboard with edit capability:**

- **Header:** Large avatar (64px, initials in gradient circle), patient name (`care_profiles.patient_name`), age (`care_profiles.patient_age`), relationship (`care_profiles.relationship`)
- **Conditions section:** Tags parsed from `care_profiles.conditions` (comma-separated string, split by comma and trimmed). Color assignment: all conditions use yellow (`#fbbf24`) as default — no severity inference. If `is_abnormal` data from related labs suggests severity, use red.
- **Vitals snapshot:** 3-column grid pulling latest values from `lab_results` table filtered by `test_name`:
  - Blood Pressure (test_name = "Blood Pressure"), A1C (test_name = "Hemoglobin A1C"), LDL (test_name = "LDL Cholesterol")
  - Each cell: large number (see Parsing Rules), colored by `is_abnormal` flag (red if true, green if false), label below
  - Numbers use AnimatedNumber for count-up on scroll
  - If no lab result exists for a vital, show "—" in gray
- **Care Team:** List of doctors from `doctors` table:
  - Avatar (initials in colored circle), name, specialty
  - Call button (`tel:` link) — only shown if `doctors.phone` is non-null
- **Allergies:** Tags parsed from `care_profiles.allergies` (comma-separated, split and trimmed). Glass-card tag style.
- **Emergency Contact:** Name and phone with call button. Uses new `emergency_contact_name` and `emergency_contact_phone` columns on `care_profiles` (see Database Changes). Section hidden if both are null.
- **Edit Profile button** at bottom → navigates to existing ProfileEditor page (restyled with glass-card form fields)

## Parsing Rules (Lab Values)

Lab result `value` and `reference_range` are text fields. Parsing rules for display:

- **Numeric values** (e.g., "165", "7.2"): Parse with `parseFloat()`. Display as-is. Use for progress bar calculation.
- **Blood pressure** (e.g., "142/88"): Split by "/", display the full string. For progress bar, use systolic (first number) against reference range.
- **Reference ranges:** Parse patterns: `"< 100"` → max=100, `"< 5.7"` → max=5.7, `"< 120/80"` → max=120 (systolic), `"60-100"` → min=60, max=100.
- **Progress bar:** `width = min(value / max * 100, 100)%`. Color: gradient from cyan (normal) to red (high) based on how far above normal.
- **Non-numeric values** (e.g., "Positive", "Negative"): Display as text badge only, no progress bar.
- **Unparseable:** Display raw text, no progress bar.

## Page Transition & Loading

- All pages use `animate-page-in` (already in globals.css) for entrance
- Suspense boundaries with `SkeletonFeed` for loading states on all data-fetching pages
- Cards use `card-stagger-in` with `animation-delay` based on index (`calc(var(--i) * 60ms)`)

## Pages Summary

| Page | Route | Type | Key Changes |
|------|-------|------|------------|
| Dashboard | `/dashboard` | Polish | Expandable cards, empty state, AI quick-ask |
| Care | `/care` | Polish | Expandable medication/appointment cards, call pharmacy |
| Chat | `/chat` | Polish | Gradient bubbles, typing indicator, starter prompts |
| Scans | `/scans` | Redesign | Category grid, reskinned hub UI |
| Settings | `/settings` | Rebuild | iPhone-style grouped sections with toggles |
| Profile | `/profile` | Rebuild | Living health dashboard with vitals, care team |

## Database Changes

### New table: `user_settings`
```sql
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  refill_reminders BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  lab_alerts BOOLEAN DEFAULT true,
  claim_updates BOOLEAN DEFAULT true,
  ai_personality TEXT DEFAULT 'professional' CHECK (ai_personality IN ('professional', 'friendly', 'concise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
```

### Alter `medications` table
```sql
ALTER TABLE medications ADD COLUMN pharmacy_phone TEXT;
```

### Alter `care_profiles` table
```sql
ALTER TABLE care_profiles ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE care_profiles ADD COLUMN emergency_contact_phone TEXT;
```

### Update TypeScript types
- Add `pharmacy_phone?: string | null` to `Medication` interface in `src/lib/types.ts`
- Add `emergency_contact_name?: string | null` and `emergency_contact_phone?: string | null` to care profile type
- Create `UserSettings` interface matching the table schema

### Fix `documents` table RLS
```sql
CREATE POLICY "Users read own documents" ON documents FOR SELECT USING (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert own documents" ON documents FOR INSERT WITH CHECK (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
```

## Paired Backend Work (Minimal)

These features require small API routes built alongside the frontend:

- `POST /api/export-data` — queries all user tables, returns JSON file download
- `POST /api/delete-account` — uses service-role Supabase client to delete user data + auth account

## Out of Scope

- Rich data cards in AI chat responses (requires backend AI prompt changes — separate backend phase)
- AI document extraction and auto-import into tables (separate backend phase)
- 1upHealth / Epic FHIR integration
- Multi-agent system
- Push notifications (would need service worker)
- Real pharmacy API integration (Surescripts)
- Notification delivery system (toggles control preferences, but actual notification sending is backend work)
