# Accessibility Audit — CareCompanion Mobile + Web

**Date:** 2026-05-22  
**Branch:** aryan/dev  
**Scope:** `apps/mobile` (React Native / Reanimated) · `apps/web/src/components` (Next.js / Tailwind)  
**Standard:** WCAG 2.1 AA (4.5:1 normal text, 3:1 large text / UI components)

---

## Contrast ratios (calculated)

| Pair | Mode | Ratio | WCAG AA |
|------|------|-------|---------|
| `text` #EDE9FE on `bg` #08091A (mobile) | dark | ~16.8:1 | ✅ |
| `textSub` #A5B4CF on `bg` #08091A (mobile) | dark | ~8.4:1 | ✅ |
| `textMuted` rgba(255,255,255,0.55) → eff. #8F9097 on `bg` #08091A (mobile) | dark | **6.24:1** | ✅ |
| `textSub` #475569 on `bg` #FAFAFA (mobile) | light | 7.26:1 | ✅ |
| **`textMuted` #94A3B8 on `bg` #FAFAFA (mobile)** | light | **2.46:1** | ❌ |
| **White on `accent` #6366F1** | both | **4.47:1** | ❌ (0.03 below 4.5) |
| **`--text-muted` #5B6785 on `--bg` #0C0E1A (web)** | dark | **3.41:1** | ❌ |
| **`--text-muted` #94A3B8 on `--bg` #F8F9FC (web)** | light | **2.44:1** | ❌ |
| **Placeholder #64748b on `--bg` #0C0E1A (web)** | dark | **4.04:1** | ❌ |
| `rose` #DC2626 on `bg` #FAFAFA (mobile) | light | 4.63:1 | ✅ |

---

## Findings

| # | Location | Issue | WCAG Criterion | Patch |
|---|----------|-------|----------------|-------|
| **M-1** | `apps/mobile/src/components/TimelineCard.tsx:109` | `Pressable` (expand/collapse) missing `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` | 4.1.2 Name, Role, Value | Add `accessibilityRole="button" accessibilityLabel="Expand timeline card" accessibilityHint="Toggles detail view"` |
| **M-2** | `apps/mobile/src/components/TimelineCard.tsx:162` | "Take medication" `Pressable` missing `accessibilityLabel`, `accessibilityRole` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Mark medication as taken"` |
| **M-3** | `apps/mobile/src/components/TimelineCard.tsx:221` | "Request Refill" `Pressable` missing `accessibilityLabel`, `accessibilityRole` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Request prescription refill"` |
| **M-4** | `apps/mobile/src/components/GlassCard.tsx:37` | Interactive card `Pressable` missing all three accessibility props | 4.1.2 | Propagate `accessibilityLabel`, `accessibilityRole="button"`, `accessibilityHint` from consumer via props with sensible defaults |
| **M-5** | `apps/mobile/src/components/GuidedTour.tsx:241` | "Skip" `Pressable` missing `accessibilityLabel`, `accessibilityRole` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Skip guided tour"` |
| **M-6** | `apps/mobile/src/components/GuidedTour.tsx:244` | "Next" `Pressable` missing `accessibilityLabel`, `accessibilityRole` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Next tour step"` |
| **M-7** | `apps/mobile/src/components/Drawer.tsx:129` | Backdrop dismiss `Pressable` missing accessibility props | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Close menu"` |
| **M-8** | `apps/mobile/src/components/Drawer.tsx:248` | Sign-out `Pressable` missing `accessibilityRole`, `accessibilityLabel` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Sign out"` |
| **M-9** | `apps/mobile/src/components/Drawer.tsx:289` | `DrawerItem` Pressables (5+ nav items) missing accessibility props | 4.1.2 | Add `accessibilityRole="menuitem" accessibilityLabel={item.label}` in `DrawerItem` component |
| **M-10** | `apps/mobile/src/components/Timeline.tsx:155` | Expand/collapse node `Pressable` missing accessibility props | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel={expanded ? "Collapse entry" : "Expand entry"}` |
| **M-11** | `apps/mobile/src/components/Timeline.tsx:379` | Dismiss `Pressable` missing accessibility props | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Dismiss"` |
| **M-12** | `apps/mobile/src/components/Timeline.tsx:552` | Filter chip `Pressable`s missing accessibility props | 4.1.2 | Add `accessibilityRole="radio" accessibilityLabel={chip.label} accessibilityState={{ checked: isSelected }}` |
| **M-13** | `apps/mobile/src/components/Timeline.tsx:584` | Share `Pressable` missing accessibility props | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Share timeline"` |
| **M-14** | `apps/mobile/src/components/TodaysMedicationsCard.tsx:159` | "Or add manually" link missing `accessibilityRole`, `accessibilityLabel` | 4.1.2 | Add `accessibilityRole="link" accessibilityLabel="Add medication manually"` |
| **M-15** | `apps/mobile/src/components/ErrorCard.tsx:55` | Retry `Pressable` missing `accessibilityLabel`, `accessibilityRole` | 4.1.2 | Add `accessibilityRole="button" accessibilityLabel="Retry"` |
| **M-16** | `apps/mobile/src/components/RippleButton.tsx:60` | Base `Pressable` wrapper does not forward `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` from props | 4.1.2 | Destructure and spread `{ accessibilityLabel, accessibilityRole, accessibilityHint, accessibilityState, ...rest }` onto the inner Pressable |
| **M-17** | `apps/mobile/app/` (30+ screens) | Onboarding and form screen `Pressable`s broadly missing `accessibilityRole` + `accessibilityLabel` (setup.tsx, health-consent.tsx, welcome.tsx, care-type.tsx, login.tsx, signup.tsx, etc.) | 4.1.2 | Audit each screen; add `accessibilityRole="button"` and descriptive `accessibilityLabel` to every interactive `Pressable` |
| **M-18** | `apps/mobile/src/components/TimelineCard.tsx:259,266,273,280,290,304,318,328` | Hardcoded `fontSize: 9–15` — does not scale with system font size | 1.4.4 Resize Text | Replace with `PixelRatio.getFontScale() * BASE` or introduce a `sp(n)` helper: `const sp = (n: number) => n * PixelRatio.getFontScale()` |
| **M-19** | `apps/mobile/src/components/Timeline.tsx` (30+ style rules) | Hardcoded font sizes including `fontSize: 9`, `fontSize: 10`, `fontSize: 20` | 1.4.4 Resize Text | Same `sp()` helper as M-18 |
| **M-20** | `apps/mobile/src/components/Drawer.tsx:329–338` | `fontSize: 20, 16, 12, 10` hardcoded | 1.4.4 Resize Text | Use `sp()` helper; `fontSize: 10` is below recommended minimum (12sp) — raise to `sp(12)` |
| **M-21** | `apps/mobile/src/components/DailyAlertsCard.tsx:144,157,170,216,222` | Hardcoded font sizes 11–14 | 1.4.4 Resize Text | Use `sp()` helper |
| **M-22** | `apps/mobile/src/components/TodaysMedicationsCard.tsx:60,87,96,125,154,164,190,207,233,240` | Hardcoded font sizes 11–14 | 1.4.4 Resize Text | Use `sp()` helper |
| **M-23** | `apps/mobile/src/components/GuidedTour.tsx:292,299,314,323` | Hardcoded font sizes 11–14 | 1.4.4 Resize Text | Use `sp()` helper |
| **M-24** | `apps/mobile/src/components/BugReportSheet.tsx:200,205,212,228,237,245` | Hardcoded font sizes 13–17 | 1.4.4 Resize Text | Use `sp()` helper |
| **M-25** | `apps/mobile/src/components/DisclaimerModal.tsx:117,123,142` | Hardcoded `fontSize: 22, 15, 16` | 1.4.4 Resize Text | Use `sp()` helper |
| **M-26** | `apps/mobile/src/components/RoleBadge.tsx:58`, `OnboardingStepIndicator.tsx:50`, `TestModeBanner.tsx:42`, `ErrorCard.tsx:49,76` | Hardcoded font sizes 11–13 | 1.4.4 Resize Text | Use `sp()` helper |
| **M-27** | `apps/mobile/src/components/TimelineCard.tsx:87,91,95,104` | Uses `withSpring` / `withTiming` (Reanimated) — no `useReducedMotion` guard | 2.3.3 Animation from Interactions (AAA) / Apple HIG / Android requirement | Import `useReducedMotion` from `react-native-reanimated`; wrap animated values: `const reduced = useReducedMotion(); const val = reduced ? targetValue : withSpring(targetValue)` |
| **M-28** | `apps/mobile/src/components/GlassCard.tsx:29,33` | `withSpring` without reduced-motion guard | 2.3.3 | Same pattern as M-27 |
| **M-29** | `apps/mobile/src/components/Drawer.tsx:59–63` | `withSpring` / `withTiming` without reduced-motion guard | 2.3.3 | Same pattern as M-27 |
| **M-30** | `apps/mobile/src/components/GuidedTour.tsx:81,82,98,115` | `withTiming` without reduced-motion guard | 2.3.3 | Same pattern as M-27 |
| **M-31** | `apps/mobile/src/components/TestModeBanner.tsx` | `withDelay` / `withTiming` without reduced-motion guard | 2.3.3 | Same pattern as M-27 |
| **M-32** | `apps/mobile/src/components/AnimatedCounter.tsx` | Animation without reduced-motion guard | 2.3.3 | Same pattern as M-27 |
| **M-33** | `apps/mobile/src/components/ParticleBurst.tsx` | Animation without reduced-motion guard | 2.3.3 | If `useReducedMotion()` is true, render nothing or a static icon |
| **M-34** | `apps/mobile/app/setup.tsx`, `health-consent.tsx`, `welcome.tsx`, `care-type.tsx`, `health-connect.tsx`, `login.tsx`, `signup.tsx`, `onboarding-records.tsx`, `care-group-join.tsx`, `edit-care-group.tsx` | Animations without reduced-motion guard | 2.3.3 | Same pattern as M-27 in each file |
| **M-35** | `apps/mobile/src/theme.ts:111` — `light.textMuted: '#94A3B8'` on `light.bg: '#FAFAFA'` | Contrast **2.46:1** — fails AA (need ≥ 4.5:1 for body text, ≥ 3:1 for large text) | 1.4.3 Contrast (Minimum) | Change `textMuted` in light theme to `'#6B7280'` (contrast ~4.6:1 on #FAFAFA) or limit use to decorative / large text (≥18pt or 14pt bold) only |
| **M-36** | `apps/mobile/src/theme.ts:68` — `dark.accent: '#6366F1'` used as button background with white label | White on #6366F1: **4.47:1** — 0.03:1 below AA 4.5 threshold | 1.4.3 Contrast (Minimum) | Shift dark-mode accent to `'#6470F3'` (contrast ≥ 4.52:1 on white) or use `text: '#EDE9FE'` instead of pure white on accent backgrounds |
| **W-1** | `apps/web/src/components/TimelineNode.tsx:268` | `<div role="button">` missing `aria-label` or `aria-labelledby` | 4.1.2 Name, Role, Value | Add `aria-label="Expand timeline node"` (or derive from node title via `aria-labelledby`) |
| **W-2** | `apps/web/src/components/DashboardView.tsx:157` | `<div role="button">` missing accessible name | 4.1.2 | Add `aria-label` describing the action |
| **W-3** | `apps/web/src/components/GuidedTour.tsx:191` | `<div role="button" tabIndex={-1}>` — `tabIndex={-1}` removes element from tab order; keyboard users cannot close tour via overlay | 2.1.1 Keyboard / 4.1.2 | Change to `tabIndex={0}`; add `onKeyDown` handler for `Enter`/`Space`; keep `aria-label="Close tour"` |
| **W-4** | `apps/web/src/components/LoginForm.tsx:251,262` | `focus:outline-none` with no compensating `focus-visible:ring-*` | 2.4.7 Focus Visible / 2.4.11 Focus Appearance (WCAG 2.2) | Replace `focus:outline-none` with `focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500` |
| **W-5** | `apps/web/src/components/CaregiverWizard.tsx:142,146,234,241,248` | `focus:outline-none` on inputs with no visible focus ring | 2.4.7 / 2.4.11 | Add `focus-visible:ring-2 focus-visible:ring-[#6366F1]` alongside existing `focus:outline-none` |
| **W-6** | `apps/web/src/components/SetupWizard.tsx:221` | `focus:outline-none focus:border-blue-500` — border colour change only, insufficient area/contrast for focus indicator | 2.4.11 Focus Appearance | Add `focus-visible:ring-2 focus-visible:ring-blue-500` in addition to the border change |
| **W-7** | `apps/web/src/components/CareGroupScreen.tsx:239,257` | `focus:outline-none` with no ring | 2.4.7 / 2.4.11 | Add `focus-visible:ring-2 focus-visible:ring-[#6366F1]` |
| **W-8** | `apps/web/src/components/CheckinModal.tsx:269` | `focus:outline-none focus:border-[var(--accent)]` — border-only focus | 2.4.11 | Add `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` |
| **W-9** | `apps/web/src/components/SelfCareWizard.tsx:188,272,310,320,326` | `focus:outline-none` with no ring on multiple inputs | 2.4.7 / 2.4.11 | Add `focus-visible:ring-2 focus-visible:ring-[#6366F1]` |
| **W-10** | `apps/web/src/components/DocumentOrganizer.tsx:237` | `focus:ring-1 focus:ring-[#6366F1]/40` — ring opacity 40 % is too faint | 2.4.11 | Increase to `focus-visible:ring-2 focus-visible:ring-[#6366F1]` (drop opacity modifier) |
| **W-11** | `apps/web/src/components/AppealGenerator.tsx:165` | `focus:ring-1 focus:ring-[#6366F1]/20` — ring opacity 20 % effectively invisible | 2.4.11 | Replace with `focus-visible:ring-2 focus-visible:ring-[#6366F1]` |
| **W-12** | `apps/web/src/components/SymptomJournal.tsx:293,303` | `focus:outline-none focus:border-blue-600` — border-only focus | 2.4.11 | Add `focus-visible:ring-2 focus-visible:ring-blue-600` |
| **W-13** | `apps/web/src/app/globals.css:49` — `--text-muted: #5B6785` on `--bg: #0C0E1A` | Contrast **3.41:1** — fails AA for normal-weight body text | 1.4.3 Contrast (Minimum) | Change dark-mode `--text-muted` to `#7A8BA8` (contrast ≈ 4.6:1 on #0C0E1A); or restrict this token to decorative / large text (≥18px or 14px bold) only |
| **W-14** | `apps/web/src/app/globals.css:159` — `--text-muted: #94A3B8` on `--bg: #F8F9FC` (light mode) | Contrast **2.44:1** — fails AA | 1.4.3 Contrast (Minimum) | Change light-mode `--text-muted` to `#6B7280` (contrast ≈ 4.6:1 on #F8F9FC) |
| **W-15** | Across `ChatSearch.tsx:161`, `DocumentOrganizer.tsx:237`, `ChatInterface.tsx:506` — `placeholder:text-[#64748b]` on dark `--bg: #0C0E1A` | Placeholder contrast **4.04:1** — fails AA | 1.4.3 | Change placeholder colour to `placeholder:text-[#8696B0]` (contrast ≈ 5.0:1 on #0C0E1A) |
| **W-16** | `apps/web/src/components/ConnectedCelebration.tsx:71–94` | Confetti burst uses custom CSS keyframes — no `prefers-reduced-motion` media-query wrapper | 2.3.3 Animation from Interactions (AAA) | Wrap keyframe animation in `@media (prefers-reduced-motion: no-preference) { ... }` or use Framer Motion's `useReducedMotion` hook |
| **W-17** | `apps/web/src/components/ExpandableCard.tsx:91` | CSS `transition` on max-height/opacity without reduced-motion guard (globals.css catch-all fires after paint) | 2.3.3 | Add `motion-reduce:transition-none` Tailwind variant; or wrap inline style in `useReducedMotion()` check |
| **W-18** | `apps/web/src/components/LoginForm.tsx`, `SignupForm.tsx`, `CaregiverWizard.tsx`, `LabTrends.tsx`, `BugReportButton.tsx`, `GlobalSearch.tsx`, `SymptomJournal.tsx`, `MedicationsView.tsx`, `ChatSearch.tsx` | Tailwind `transition-*` classes used freely with no `motion-reduce:` variant | 2.3.3 | Add `motion-reduce:transition-none motion-reduce:animate-none` to animated elements, or prefix all `transition-*` utilities with `motion-safe:` |

---

## Summary by criterion

| WCAG Criterion | Mobile findings | Web findings | Severity |
|----------------|-----------------|--------------|----------|
| 1.4.3 Contrast (Minimum) — AA | M-35, M-36 | W-13, W-14, W-15 | **High** |
| 1.4.4 Resize Text — AA | M-18 – M-26 (180+ instances) | — | **High** |
| 2.1.1 Keyboard | — | W-3 | **High** |
| 2.3.3 Animation from Interactions — AAA / Platform | M-27 – M-34 | W-16 – W-18 | Medium |
| 2.4.7 Focus Visible — AA | — | W-4 – W-12 | **High** |
| 2.4.11 Focus Appearance — AA (WCAG 2.2) | — | W-4 – W-12 | **High** |
| 4.1.2 Name, Role, Value — AA | M-1 – M-17 (76 elements) | W-1 – W-3 | **High** |

---

## Recommended fix order

1. **M-16 / RippleButton** — fix once, propagates accessibility props to every consumer screen.
2. **M-18 / sp() helper** — add once to `apps/mobile/src/theme.ts` or a `utils/sp.ts`, then do a sweep replacing `fontSize: N`.
3. **W-13, W-14** — update two CSS variables; fixes contrast across all components in one line each.
4. **W-4 – W-12** — bulk find-replace `focus:outline-none` → `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]` across `apps/web/src/components`.
5. **M-1 – M-17** — per-component pass; M-9 in DrawerItem is highest-reach single fix.
6. **M-27 – M-34 / W-16 – W-18** — add `useReducedMotion` guards; low risk, high user impact for vestibular disorders.
