# Product

## Register

product

## Users

Two overlapping audiences:

1. **Family caregivers** — adult children and spouses managing complex health situations for a loved one (primarily cancer, chronic illness, multi-condition care). Using the app to stay on top of medications, lab results, appointments, insurance claims, and care team coordination. Often overwhelmed, time-poor, emotionally taxed. Using the app on a phone in a waiting room, at a pharmacy, or at home after a long day.

2. **Self-managing patients** — individuals tracking their own health across multiple conditions, prescriptions, and providers. Same informational needs, more personal stakes.

Both users share a core context: they are navigating a healthcare system that is fragmented, opaque, and high-stakes. They are not medical professionals. They need to feel like they can handle this.

## Product Purpose

CareCompanion AI is an AI-powered health coordinator that gives caregivers and patients control over medically complex situations. It consolidates medications, lab results, appointments, insurance, and care team communication in one place — with an AI layer that interprets, organizes, and surfaces what matters.

Success looks like: a caregiver who used to feel overwhelmed now feels like they finally have a handle on it.

## Brand Personality

Intelligent, Compassionate, Organized.

Voice is warm but precise — a knowledgeable companion, not a cold clinical tool and not a chatty consumer AI. Speaks to users as capable adults navigating a hard situation, not patients to be managed or overwhelmed people who need hand-holding. Confidence comes from having the information organized correctly, not from cheerful UI copy.

References that capture the right feel: Linear (dense, confident, fast product UI), Notion (organized, flexible, warm), Arc Browser (personality-driven, premium, dark), Calm/Headspace (emotionally grounded, soothing, not clinical).

## Anti-references

- **Epic / MyChart** — sterile hospital EHR. Cold, dense, clinical tables. No warmth. Feels like it was designed for billing, not for people.
- **Generic SaaS dashboard** — hero metrics, blue gradients, the analytics template that every B2B tool reaches for. Impersonal, category-obvious, soulless.
- **Fitness apps (MyFitnessPal, etc.)** — gamified, energetic, motivational. Streaks and scores are tone-deaf when your loved one is in chemotherapy. Wrong emotional register entirely.
- **Neon crypto / aggressive dark mode** — neon on black, harsh glows, tech-bro aesthetic. Undermines trust and calm.

## Design Principles

1. **Control, not overwhelm.** Every screen should reduce cognitive load, not add to it. When information is complex, the design's job is to make it feel manageable — not to expose all complexity at once.

2. **Clinical confidence with human warmth.** Precise, trustworthy information delivered with care. Never cold, never alarmist, never dismissive. The tone of a good doctor who also happens to have good bedside manner.

3. **The caregiver is the expert on their loved one; the AI is the expert on healthcare.** Design reinforces this partnership — surface what the AI knows, but always defer to the human's context and judgment.

4. **Speed under stress.** Critical information (medications, emergency card, upcoming appointments) must be reachable in under two taps. Caregivers often use this app in high-pressure moments — a crisis is not the time to hunt for a feature.

5. **Dignity over gamification.** No streaks, no scores, no motivational pop-ups. The people using this app are dealing with serious illness. Design reflects that gravity.

## Accessibility & Inclusion

- WCAG AA compliance target across all surfaces
- Full light mode parity — all color tokens switch, not just individual components
- Reduced motion: animations respect `prefers-reduced-motion`
- Color blindness: never use color as the sole signal for status or severity; always pair with icons or labels
- Type size: base at 14px minimum; critical content (medication names, dosages) at 16px+
