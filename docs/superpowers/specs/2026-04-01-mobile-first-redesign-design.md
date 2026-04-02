# CareCompanion Mobile-First Redesign

## Problem

The app currently has 8 separate pages with a sidebar navigation. The layout feels scattered — too much information competing for attention on the dashboard, navigation doesn't feel native on mobile, and pages aren't focused on single purposes. The goal is to make it feel like a premium iPhone app (Cash App / Robinhood style) while keeping the existing dark color palette.

## Design Decisions

- **Approach:** Mobile-first rebuild of navigation and layout (not a light touch, not a full chat-first rethink)
- **Visual style:** Keep existing dark navy/slate/cyan palette, remove heavy glassmorphic blur effects, sharpen contrast
- **Inspiration:** Cash App / Robinhood — bold, simple, one action per screen

## Navigation Structure

### Bottom Tab Bar (replaces sidebar)

The sidebar is removed entirely. A fixed bottom tab bar with 4 tabs becomes the primary navigation:

| Tab | Icon | Purpose |
|-----|------|---------|
| **Home** | House | Priority feed of actionable cards |
| **Chat** | Message bubble | AI assistant (largely unchanged) |
| **Care** | Heart | Medications + Appointments (segment control) |
| **Scan** | Camera/document | Document scanner — opens directly to capture |

### Top Bar

- Left: App name ("CareCompanion")
- Right: Profile avatar (user initials with gradient background)
- Tapping avatar opens a slide-out menu from the right

### Profile Menu (avatar tap)

Slides in from the right with a dark overlay on the rest of the screen. Contains:

- **Care Profile** — patient info, conditions, allergies, doctors
- **Connected Accounts** — Google Calendar, health systems, insurance, wearables
- **Settings** — notifications, preferences
- **Help & Support**
- **Sign Out**

### Page Routing Changes

| Current Route | New Location |
|---------------|-------------|
| `/dashboard` | **Home tab** — redesigned as priority card feed |
| `/chat` | **Chat tab** — unchanged |
| `/medications` | **Care tab** — Medications segment |
| `/appointments` | **Care tab** — Appointments segment |
| `/scans` | **Scan tab** |
| `/connect` | **Profile menu** → Connected Accounts |
| `/profile` | **Profile menu** → Care Profile |
| `/settings` | **Profile menu** → Settings |

## Home Screen

The current dashboard shows health score, quick prompts, activity timeline, medication refills, and notifications all at once. The redesign replaces this with a **priority card feed**.

### Card Types (sorted by urgency)

1. **Needs Attention (red)** — Refills due, overdue appointments, denied claims
   - Red-tinted background, red dot indicator
   - Actionable: "Tap to manage refill →"

2. **Upcoming (blue)** — Appointments in the next few days
   - Standard card with blue dot
   - Shows doctor name, specialty, date/time

3. **Alerts (amber)** — Abnormal lab results, insurance issues
   - Amber dot indicator
   - Links to chat: "Ask AI about this →"

4. **Quick Ask (gradient)** — One contextual AI prompt suggestion
   - Gradient border (indigo → cyan)
   - Changes based on what's relevant (e.g., "What should I ask Dr. Patel on Thursday?")

### What's Removed from Home

- **Health score widget** — vanity metric; can live in Care Profile if needed
- **Quick prompts grid** — replaced by single contextual Quick Ask card
- **Activity timeline section** — the feed IS the timeline, but each item is actionable
- **Notification count** — notifications become cards in the feed

### Home Greeting

Top of the feed shows:
- Time-based greeting ("Good afternoon")
- Patient context ("Mom's Care Summary")

## Care Tab

Combines Medications and Appointments into one screen using a **segment control** (pill toggle) at the top.

### Medications Segment

- **Grouped by status:**
  - "REFILL NEEDED" section at top — cards have red border accent and "Refill" action button
  - "ACTIVE" section below — standard cards with green "Refill in X days" text
- **Each medication card shows:** Name, dosage, frequency, timing, refill status
- **"+" button** (top right) — opens add medication flow
- **Tap a card** → bottom sheet with full details (pharmacy, prescribing doctor, history)

### Appointments Segment

- **Grouped by time:**
  - "THIS WEEK" section
  - "UPCOMING" section
- **Each appointment card shows:** Doctor name, specialty, date/time, location
- **"+" button** — opens add appointment flow
- **Tap a card** → bottom sheet with details, directions, prep notes

### Detail Bottom Sheets

Instead of navigating to a new page, tapping a medication or appointment card opens a **bottom sheet overlay** that slides up. Swipe down to dismiss. This keeps the user in context.

## Scan Tab

Opens directly to the document scanning interface. The flow is:

1. Camera viewfinder / file upload prompt
2. Select category (Medications, Lab Reports, Insurance Cards, EOBs/Bills, Doctor Notes)
3. AI processes and extracts data
4. Review and save

Minimal chrome — the scan tab is an action, not a browsing destination.

## Chat Tab

Largely unchanged from current implementation. The AI chat interface with streaming responses, starter prompts, and typing indicators stays as-is. The main change is that it's now accessed via the bottom tab bar instead of the sidebar.

## Futuristic Visual Polish

All of the following effects layer on top of the clean layout:

### 1. Smooth Page Transitions

- Tabs slide left/right when switching between them (horizontal swipe animation)
- Cards fade-in on load with staggered timing (first card appears, then second 100ms later, etc.)
- Bottom sheets slide up with a spring/bounce animation
- Profile menu slides in from right with overlay fade

### 2. Subtle Glow Effects

- Urgent "Needs Attention" cards pulse with a soft red glow (CSS box-shadow animation)
- Active tab icon has a cyan glow/halo underneath
- The "+" action button glows on hover
- Gives a sci-fi HUD aesthetic without being overdone

### 3. Animated Gradient Borders

- Cards have a subtle animated gradient border on hover/focus
- Slow color shift: cyan → violet → blue cycling around the card edge
- Uses CSS `@property` for smooth gradient rotation
- Premium tech product feel

### 4. Micro-interactions

- Buttons scale down to 0.95 on press (like iOS tap feedback)
- Segment control pill slides smoothly between Medications ↔ Appointments
- Tab bar icons bounce subtly when tapped (small Y-axis spring)
- Cards lift slightly on hover with shadow depth change

### 5. Ambient Background

- Very subtle floating gradient blobs behind the content
- Slow-moving (30-60 second cycle), heavily blurred, low opacity (0.03-0.05)
- Colors: cyan and violet, matching the accent palette
- Like Stripe's homepage depth effect — barely visible but adds atmosphere

### 6. Skeleton Loading States

- When data is loading, show animated shimmer placeholders instead of spinners
- Shimmer has a gradient sweep effect (left-to-right shine)
- Placeholder shapes match the actual card layout
- Makes the app feel fast and polished even during load

### 7. Number Animations

- Health-related numbers animate/count up when they appear on screen
- "Refill in 18 days" ticks from 0 → 18
- Appointment countdowns animate into view
- Uses Intersection Observer to trigger on scroll-into-view
- Creates a "data is alive" feeling

## Component Changes

### Components to Modify

- **AppShell.tsx** — Remove sidebar, add bottom tab bar, add top bar with avatar
- **DashboardView.tsx** — Rewrite as priority card feed (Home)
- **MedicationsView.tsx** — Adapt for Care tab Medications segment
- **AppointmentsView.tsx** — Adapt for Care tab Appointments segment
- **ConnectAccounts.tsx** — Adjust layout for rendering inside ProfileMenu instead of full page
- **ProfileEditor.tsx** — Adjust layout for rendering inside ProfileMenu instead of full page
- **SettingsPage.tsx** — Adjust layout for rendering inside ProfileMenu instead of full page
- **ScanCenter.tsx** — Adapt for Scan tab (works with DocumentScanner and CategoryScanner)

### New Components to Create

- **BottomTabBar.tsx** — Fixed bottom navigation with 4 tabs
- **ProfileMenu.tsx** — Slide-out menu from right
- **PriorityCard.tsx** — Reusable card component for Home feed (urgent, upcoming, alert, quick-ask variants)
- **SegmentControl.tsx** — Pill toggle for Care tab
- **BottomSheet.tsx** — Slide-up detail overlay
- **SkeletonCard.tsx** — Shimmer loading placeholder
- **AnimatedNumber.tsx** — Count-up number component
- **AmbientBackground.tsx** — Floating gradient blobs

### Components Unchanged

- **ChatInterface.tsx** — Stays as-is
- **DocumentScanner.tsx** — Stays as-is (used by Scan tab)
- **MessageBubble.tsx** — Stays as-is
- **TypingIndicator.tsx** — Stays as-is

### Components to Remove/Deprecate

- **Sidebar navigation** from AppShell.tsx
- **NotificationBell.tsx** — Notifications become cards in the Home feed

## CSS / Animation Approach

All animations use CSS transitions and keyframes where possible for performance. JavaScript animations (count-up, intersection observer triggers) use `requestAnimationFrame`. No animation libraries needed — keep the bundle light.

Key CSS additions:
- `@keyframes` for glow pulse, gradient rotation, shimmer sweep, blob float
- `transition` on all interactive elements (0.2-0.3s ease)
- `will-change` on animated elements for GPU acceleration
- `prefers-reduced-motion` media query to disable animations for accessibility

## Architecture Decisions

### Routing Strategy

Each tab maps to its own route under the `(app)` group. This preserves Next.js App Router conventions and allows direct linking:

- `/dashboard` → Home tab
- `/chat` → Chat tab
- `/care` → Care tab (segment state managed client-side via query param or local state)
- `/scans` → Scan tab
- `/profile`, `/connect`, `/settings` → Rendered inside ProfileMenu slide-out (client-side, no separate route navigation)
- `/manual-setup` → Remains as-is (part of onboarding flow, not part of main tab nav)

Tab transitions (slide left/right) animate between these routes using CSS transitions on a shared layout wrapper.

### Home Feed Data Aggregation

The Home priority card feed aggregates data client-side from existing Supabase queries:

- Medications with upcoming refill dates → "Needs Attention" cards
- Appointments in the next 7 days → "Upcoming" cards
- Lab results with abnormal flags → "Alert" cards
- Denied insurance claims → "Alert" cards
- Contextual AI prompt → "Quick Ask" card (generated from care profile context)

All data is already fetched by existing hooks/queries. The Home component composes and sorts them by urgency. No new API endpoint needed.
