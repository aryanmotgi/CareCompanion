I have enough comprehensive data. Compiling the final audit report now.

---

# CareCompanion PHI Migration Audit: Vercel → AWS

**Repo**: `/Users/aryanmotgi/carecompanion` · **Branch**: `aryan/dev` · **Date**: 2026-05-20
**Stack**: Next.js 16 App Router on Vercel · Aurora Serverless v2 Postgres (via RDS Data API) · NextAuth · Anthropic Claude (Sonnet 4.6 / Haiku 4.5) via `@ai-sdk/anthropic` · Google Gemini embeddings · Voyage AI rerank · Resend email · Sentry · Upstash Redis rate limit · web-push notifications · 137 API routes.

---

## Executive Summary

**The PHI blast radius is large.** Of 137 route handlers, **89 read or write Protected Health Information** (T1+T2: 67; T3: 22). **17 routes send PHI to Anthropic's hosted API** (no BAA). **All memory writes ship PHI text to Google Gemini for embeddings** (`apps/web/src/lib/memory/embed.ts:7-9`). **The retrieval reranker ships memory text to Voyage AI** (`apps/web/src/lib/memory/rerank.ts:17-30`). Push notification bodies contain plaintext medication names, lab values, and appointment details (`apps/web/src/lib/notifications.ts:125,215,293`).

**The path forward is clear and surgically tractable**:
1. **Anthropic → AWS Bedrock Claude** (same models, AWS BAA covers it) — this single swap removes the largest PHI vendor exposure.
2. **Gemini embeddings → Bedrock Cohere Embed or Titan v2** (768-dim available).
3. **Voyage rerank → Bedrock Cohere Rerank 3.5** (AWS-hosted, BAA covered).
4. **Move T1/T2 route handlers off Vercel Functions onto AWS Lambda + API Gateway**, fronted by an OIDC/JWT bridge from NextAuth. Vercel keeps RSC page rendering, T3 auth/identifier routes, and static assets.

**Order of magnitude**: ~4–6 engineer-weeks of focused work, with a feature-flag-gated incremental rollout. Bedrock model swap is mechanically the smallest change (model client substitution); the architectural lift is the per-route AWS deployment surface + JWT trust bridge.

---

## Part 1 — Enumeration of API Routes

137 routes total under `apps/web/src/app/api/**/route.ts`. Full list (verb counts per file inline where multiple):

### Auth & Identity (13)
1. `account/change-password/route.ts` — POST
2. `auth/[...nextauth]/route.ts` — GET, POST (delegates to `@/lib/auth`)
3. `auth/google-calendar/callback/route.ts` — GET
4. `auth/google-calendar/route.ts` — GET
5. `auth/mobile-care-group-login/route.ts` — POST
6. `auth/mobile-login/route.ts` — POST
7. `auth/refresh/route.ts` — POST
8. `auth/register/route.ts` — POST
9. `auth/reset-password/confirm/route.ts` — POST
10. `auth/reset-password/route.ts` — POST
11. `auth/set-password/route.ts` — POST
12. `auth/set-role/route.ts` — POST
13. `auth/social/route.ts` — POST

### Care Group (15)
14. `care-group/[id]/status/route.ts` — GET
15. `care-group/code/revoke/route.ts` — POST
16. `care-group/code/rotate/route.ts` — POST
17. `care-group/code/route.ts` — GET, POST
18. `care-group/invite/revoke/route.ts` — POST
19. `care-group/invite/route.ts` — POST
20. `care-group/join-by-code/route.ts` — POST
21. `care-group/join/route.ts` — POST (deprecated)
22. `care-group/member/relationship/route.ts` — POST
23. `care-group/mine/route.ts` — GET
24. `care-group/request-join/[id]/approve/route.ts` — POST
25. `care-group/request-join/[id]/deny/route.ts` — POST
26. `care-group/request-join/mine/route.ts` — GET
27. `care-group/request-join/route.ts` — GET, POST
28. `care-group/route.ts` — POST

### Care Hub & Care Profiles (5)
29. `care-hub/remind/route.ts` — POST
30. `care-hub/route.ts` — GET
31. `care-profiles/[id]/route.ts` — GET, PATCH
32. `care-profiles/route.ts` — POST
33. `me/route.ts` — GET

### Care Team (5)
34. `care-team/accept/route.ts` — POST
35. `care-team/invite/[id]/route.ts` — DELETE
36. `care-team/invite/route.ts` — POST
37. `care-team/remove/route.ts` — POST
38. `care-team/route.ts` — GET

### Caregiver burnout (1)
39. `caregiver/burnout/route.ts` — GET

### Chat (5)
40. `chat/guest/route.ts` — POST
41. `chat/history/route.ts` — GET, DELETE
42. `chat/mobile/route.ts` — POST
43. `chat/route.ts` — POST
44. `chat/search/route.ts` — GET

### Check-ins (3)
45. `checkins/route.ts` — GET, POST
46. `checkins/share/route.ts` — POST
47. `checkins/voice-extract/route.ts` — POST

### Community (3)
48. `community/[id]/route.ts` — GET, POST, DELETE
49. `community/[id]/upvote/route.ts` — POST
50. `community/route.ts` — GET, POST

### Compliance (3)
51. `compliance/audit-log/route.ts` — GET
52. `compliance/calendar/route.ts` — GET
53. `compliance/report/route.ts` — GET

### Consent (1)
54. `consent/accept/route.ts` — POST

### Conversations (2)
55. `conversations/[id]/route.ts` — GET, DELETE, PATCH
56. `conversations/route.ts` — GET, POST

### Cron (11)
57. `cron/memory-decay/route.ts` — GET
58. `cron/memory-eval/route.ts` — GET
59. `cron/nadir-alert/route.ts` — GET
60. `cron/nadir-summary/route.ts` — GET
61. `cron/purge/route.ts` — GET
62. `cron/radar/route.ts` — GET
63. `cron/retention/route.ts` — GET
64. `cron/sync/route.ts` — GET
65. `cron/trials-match/route.ts` — GET
66. `cron/trials-status/route.ts` — GET
67. `cron/weekly-summary/route.ts` — GET

### CSRF (1)
68. `csrf-token/route.ts` — GET

### Treatment Cycles (3)
69. `cycles/[id]/route.ts` — DELETE, PATCH
70. `cycles/current/route.ts` — GET
71. `cycles/route.ts` — GET, POST

### Account / Delete / Demo (3)
72. `delete-account/route.ts` — POST
73. `demo/start/route.ts` — POST
74. `e2e/signin/route.ts` — GET, POST

### Documents & Scanning (4)
75. `documents/[id]/route.ts` — DELETE
76. `documents/extract/route.ts` — POST
77. `scan-document/route.ts` — POST
78. `save-scan-results/route.ts` — POST

### Export / Import (4)
79. `export-data/route.ts` — GET
80. `export/csv/route.ts` — GET
81. `export/pdf/route.ts` — GET
82. `import-data/route.ts` — POST

### Extraction (1)
83. `extract-medications/route.ts` — POST

### Feedback (1)
84. `feedback/route.ts` — POST

### Health / Summary / Healthcheck (3)
85. `health-summary/cache/route.ts` — GET, POST
86. `health-summary/route.ts` — GET, POST
87. `health/route.ts` — GET

### HealthKit Sync (2)
88. `healthkit/replace/route.ts` — POST
89. `healthkit/sync/route.ts` — POST

### Imports (1)
90. `import-medications/route.ts` — POST

### Insurance (1)
91. `insurance/appeal/route.ts` — POST

### Integrations (1)
92. `integrations/[source]/route.ts` — DELETE

### Drug Interactions (1)
93. `interactions/check/route.ts` — POST

### Journal (1)
94. `journal/route.ts` — POST, GET, DELETE

### Labs (1)
95. `labs/trends/route.ts` — GET

### Notifications (4)
96. `notifications/[id]/route.ts` — DELETE
97. `notifications/generate/route.ts` — GET (cron)
98. `notifications/preferences/route.ts` — GET, PUT
99. `notifications/read/route.ts` — POST

### Onboarding (1)
100. `onboarding/complete/route.ts` — POST

### Visit Prep (2)
101. `prep/route.ts` — GET
102. `visit-prep/route.ts` — POST

### Profile Switch (1)
103. `profile-switch/route.ts` — POST

### Push Subscribe (1)
104. `push/subscribe/route.ts` — POST, DELETE

### Records (8)
105. `records/appointments/route.ts` — GET, POST, PUT, DELETE
106. `records/doctors/route.ts` — GET, POST, PUT, DELETE
107. `records/labs/route.ts` — GET
108. `records/medication-observations/route.ts` — GET, POST, PATCH
109. `records/medications/route.ts` — GET, POST, PUT, PATCH, DELETE
110. `records/profile/route.ts` — GET, PATCH, POST
111. `records/restore/route.ts` — POST
112. `records/settings/route.ts` — PATCH

### Refills / Reminders (3)
113. `refills/status/route.ts` — GET
114. `reminders/check/route.ts` — GET (cron)
115. `reminders/respond/route.ts` — POST
116. `reminders/route.ts` — GET, POST, DELETE

### Search (1)
117. `search/route.ts` — GET

### Seed (1)
118. `seed-demo/route.ts` — POST

### Share (4)
119. `share/[token]/revoke/route.ts` — POST
120. `share/[token]/route.ts` — GET
121. `share/route.ts` — GET, POST
122. `share/weekly/route.ts` — GET

### Sync (2)
123. `sync/google-calendar/route.ts` — POST
124. `sync/status/route.ts` — GET

### Test (1)
125. `test/reset/route.ts` — POST

### Timeline (1)
126. `timeline/route.ts` — GET

### Triage (1)
127. `triage/route.ts` — POST

### Trials (6)
128. `trials/[nctId]/detail/route.ts` — POST
129. `trials/[nctId]/route.ts` — GET
130. `trials/match/route.ts` — POST
131. `trials/matches/route.ts` — GET
132. `trials/save/route.ts` — POST
133. `trials/saved/[nctId]/route.ts` — PATCH
134. `trials/saved/route.ts` — GET

### Uploads (2)
135. `upload/allergies/route.ts` — POST
136. `upload/insurance/route.ts` — POST

### Welcome (1)
137. `welcome-email/route.ts` — POST

---

## Part 2 — PHI Classification Table

Legend: **A**=Anthropic API call, **G**=Gemini embedding, **V**=Voyage rerank, **R**=Resend email, **S**=Sentry capture. `mem*` denotes routes that indirectly invoke memory extract/retrieve (which reaches A+G+V).

| # | Route path | Method(s) | Tables read | Tables written | LLM calls | External APIs | PHI Tier |
|---|---|---|---|---|---|---|---|
| 1 | `account/change-password` | POST | users | users | — | — | T3 |
| 2 | `auth/[...nextauth]` | GET, POST | users, userIdentities (via lib/auth.ts) | users | — | (NextAuth) | T3 |
| 3 | `auth/google-calendar/callback` | GET | connectedApps | connectedApps | — | Google OAuth | T3 |
| 4 | `auth/google-calendar` | GET | — | — | — | Google OAuth | T4 |
| 5 | `auth/mobile-care-group-login` | POST | careGroups, careGroupMembers, users | — | — | — | T3 |
| 6 | `auth/mobile-login` | POST | users, userIdentities | — | — | — | T3 |
| 7 | `auth/refresh` | POST | — | — | — | — | T4 |
| 8 | `auth/register` | POST | users | users | — | — | T3 |
| 9 | `auth/reset-password/confirm` | POST | users | users | — | — | T3 |
| 10 | `auth/reset-password` | POST | users | — | — | **R** Resend | T3 |
| 11 | `auth/set-password` | POST | users | users | — | — | T3 |
| 12 | `auth/set-role` | POST | users | users | — | — | T3 |
| 13 | `auth/social` | POST | users, userIdentities, auditLogs | users, userIdentities, auditLogs | — | Apple/Google JWKS | T3 |
| 14 | `care-group/[id]/status` | GET | careGroupMembers, users | — | — | — | T3 |
| 15 | `care-group/code/revoke` | POST | careGroupCodes | careGroupCodes | — | — | T3 |
| 16 | `care-group/code/rotate` | POST | careGroupCodes | careGroupCodes | — | — | T3 |
| 17 | `care-group/code` | GET, POST | careGroupCodes | careGroupCodes | — | — | T3 |
| 18 | `care-group/invite/revoke` | POST | careGroupInvites, careGroupMembers | careGroupInvites | — | — | T3 |
| 19 | `care-group/invite` | POST | careGroupInvites, careGroupMembers | careGroupInvites | — | — | T3 |
| 20 | `care-group/join-by-code` | POST | careGroupCodes, careGroups, users | careGroupMembers | — | — | T3 |
| 21 | `care-group/join` | POST | careGroups, careGroupMembers | careGroupMembers | — | — | T3 |
| 22 | `care-group/member/relationship` | POST | careGroupMembers | careGroupMembers | — | — | T3 |
| 23 | `care-group/mine` | GET | careGroupMembers, careGroups | — | — | — | T3 |
| 24 | `care-group/request-join/[id]/approve` | POST | careGroupJoinRequests | careGroupJoinRequests, careGroupMembers | — | — | T3 |
| 25 | `care-group/request-join/[id]/deny` | POST | careGroupJoinRequests | careGroupJoinRequests | — | — | T3 |
| 26 | `care-group/request-join/mine` | GET | careGroupJoinRequests | — | — | — | T3 |
| 27 | `care-group/request-join` | GET, POST | careGroupJoinRequests, users | careGroupJoinRequests | — | — | T3 |
| 28 | `care-group` | POST | careGroups, careGroupMembers | careGroups, careGroupMembers | — | — | T3 |
| 29 | `care-hub/remind` | POST | careProfiles, careTeamMembers, pushSubscriptions | — | — | **web-push** (PHI in body) | T2 |
| 30 | `care-hub` | GET | careProfiles, medications, appointments, labResults, symptomEntries, notifications, treatmentCycles (et al.) | — | — | — | **T1** |
| 31 | `care-profiles/[id]` | GET, PATCH | careProfiles | careProfiles | — | trials matchingQueue | **T2** |
| 32 | `care-profiles` | POST | careProfiles, users | careProfiles | — | — | T2 |
| 33 | `care-team/accept` | POST | careTeamInvites, careTeamMembers, careTeamActivity | careTeamMembers, careTeamActivity | — | — | T3 |
| 34 | `care-team/invite/[id]` | DELETE | careTeamInvites, careTeamMembers, careTeamActivity | careTeamInvites, careTeamActivity | — | — | T3 |
| 35 | `care-team/invite` | POST | careTeamMembers, careTeamInvites, careProfiles, users | careTeamInvites, careTeamActivity | — | **R** Resend (patient name) | **T2** |
| 36 | `care-team/remove` | POST | careTeamMembers, careTeamActivity | careTeamMembers, careTeamActivity | — | — | T3 |
| 37 | `care-team` | GET | careTeamMembers, careTeamInvites, careTeamActivity, users | — | — | — | T3 |
| 38 | `caregiver/burnout` | GET | careProfiles, symptomEntries, appointments | — | — | — | **T1** |
| 39 | `chat/guest` | POST | — | — | **A** Sonnet 4.6 stream | Anthropic | T4 (no PHI; user could enter some) |
| 40 | `chat/history` | GET, DELETE | messages, conversations | messages, conversations | — | — | **T2** (chat content) |
| 41 | `chat/mobile` | POST | careProfiles, medications, doctors, appointments, labResults, symptomEntries, messages, conversations, treatmentCycles, memories, conversationSummaries | messages, conversations, memories (via extract) | **A** Sonnet 4.6 + Haiku 4.5; **G** embeddings (via mem extract); **V** rerank | Anthropic, Gemini, Voyage | **T1** |
| 42 | `chat` | POST | (same as mobile + insurance, claims, priorAuths, fsaHsa, notifications) | messages, memories, conversationSummaries, userUsage, auditLogs | **A** ×3+ (router Haiku, specialists ×3 Haiku, main Sonnet, extract Haiku, summary Haiku), **G**, **V** | Anthropic, Gemini, Voyage | **T1** |
| 43 | `chat/search` | GET | messages | — | — | — | **T2** |
| 44 | `checkins/route` | GET, POST | wellnessCheckins, careProfiles | wellnessCheckins | — | **web-push** | **T1** |
| 45 | `checkins/share` | POST | wellnessCheckins, careTeamMembers, pushSubscriptions | — | — | **web-push** (PHI body) | **T1** |
| 46 | `checkins/voice-extract` | POST | — (user-provided transcript) | — | **A** Haiku 4.5 | Anthropic | **T1** |
| 47 | `community/[id]` | GET, POST, DELETE | communityPosts, communityReplies, communityUpvotes | communityReplies, communityUpvotes | — | — | T2 (free-text could contain PHI) |
| 48 | `community/[id]/upvote` | POST | communityPosts, communityReplies, communityUpvotes | communityUpvotes | — | — | T3 |
| 49 | `community` | GET, POST | communityPosts, careProfiles | communityPosts | — | — | T2 |
| 50 | `compliance/audit-log` | GET | auditLogs | — | — | — | T3 |
| 51 | `compliance/calendar` | GET | reminderLogs | — | — | — | **T2** (med names in reminders) |
| 52 | `compliance/report` | GET | (compliance-tracker reads meds + reminders) | — | — | — | **T2** |
| 53 | `consent/accept` | POST | users | users, auditLogs | — | — | T3 |
| 54 | `conversations/[id]` | GET, DELETE, PATCH | conversations, messages | conversations, messages | — | — | **T2** |
| 55 | `conversations` | GET, POST | conversations, messages | conversations | — | — | T2 |
| 56 | `cron/memory-decay` | GET | memories | memories (decay) | — | — | **T1** |
| 57 | `cron/memory-eval` | GET | memories (via retrieve) | — | **G** embeddings, **V** rerank | Gemini, Voyage | **T1** |
| 58 | `cron/nadir-alert` | GET | careProfiles, medications, labResults, treatmentCycles, pushSubscriptions | notifications | — | **web-push** | **T1** |
| 59 | `cron/nadir-summary` | GET | (same as nadir-alert) | notifications | — | **web-push** | **T1** |
| 60 | `cron/purge` | GET | (soft-delete) all PHI tables | all PHI tables | — | — | **T1** |
| 61 | `cron/radar` | GET | symptomEntries, labResults, medications, treatmentCycles, careProfiles | notifications | **A** Sonnet 4.6 | Anthropic, web-push | **T1** |
| 62 | `cron/retention` | GET | medications, appointments, doctors, documents, labResults, claims, auditLogs | (deletes) | — | — | **T1** |
| 63 | `cron/sync` | GET | (calendar tokens) | appointments | — | Google Calendar | **T2** |
| 64 | `cron/trials-match` | GET | careProfiles, matchingQueue, trialMatches | trialMatches | **A** Sonnet 4.6 | Anthropic, ClinicalTrials.gov | **T1** |
| 65 | `cron/trials-status` | GET | savedTrials, cronState, notifications, careProfiles | notifications | — | ClinicalTrials.gov | **T2** |
| 66 | `cron/weekly-summary` | GET | wellnessCheckins, symptomInsights, careProfiles, pushSubscriptions | notifications | **A** Haiku 4.5 | Anthropic, web-push | **T1** |
| 67 | `csrf-token` | GET | — | — | — | — | T4 |
| 68 | `cycles/[id]` | DELETE, PATCH | treatmentCycles, careProfiles | treatmentCycles | — | — | **T1** |
| 69 | `cycles/current` | GET | treatmentCycles, careProfiles | — | — | — | **T1** |
| 70 | `cycles` | GET, POST | treatmentCycles, careProfiles | treatmentCycles | — | — | **T1** |
| 71 | `delete-account` | POST | users | users (cascade-deletes ALL PHI) | — | — | **T2** (logs userId) |
| 72 | `demo/start` | POST | users, careProfiles, medications, appointments, labResults, etc. (seed) | (writes synthetic data) | — | — | T4 (synthetic only) |
| 73 | `documents/[id]` | DELETE | documents, careProfiles | documents | — | — | **T2** |
| 74 | `documents/extract` | POST | careProfiles, labResults, medications, insurance, claims, appointments, documents | labResults, medications, insurance, claims, appointments, documents | **A** Sonnet 4.6 (extract-document) | Anthropic | **T1** |
| 75 | `e2e/signin` | GET, POST | users, careProfiles, messages | users, careProfiles, messages | — | — | T3 (test only) |
| 76 | `export-data` | GET | careProfiles, medications, appointments, doctors, labResults, claims, documents, notifications | auditLogs | — | — | **T1** (full PHI dump) |
| 77 | `export/csv` | GET | careProfiles, medications, labResults, appointments, symptomEntries | auditLogs | — | — | **T1** |
| 78 | `export/pdf` | GET | careProfiles, medications, labResults, appointments, symptomEntries, doctors | — | — | — | **T1** |
| 79 | `extract-medications` | POST | — | — | **A** Sonnet 4.6 (extract-document) | Anthropic | **T1** |
| 80 | `feedback` | POST | (logs feedback) | — | — | — | T3 (free-text could contain PHI) |
| 81 | `health-summary/cache` | GET, POST | healthSummaries, medications, appointments, labResults, notifications, careProfiles | healthSummaries | — | — | **T1** |
| 82 | `health-summary` | GET, POST | careProfiles, medications, doctors, appointments, labResults, insurance, claims, priorAuths, memories, symptomEntries, healthSummaries | healthSummaries, auditLogs | **A** Haiku 4.5 | Anthropic | **T1** |
| 83 | `health` | GET | careProfiles (schema check) | — | — | — | T4 |
| 84 | `healthkit/replace` | POST | medications, labResults, appointments, careProfiles, conditions, allergies, procedures, immunizations | medications, labResults, appointments, conditions, allergies, procedures, immunizations, auditLogs | — | — | **T1** |
| 85 | `healthkit/sync` | POST | (same as replace) | (same as replace) | — | — | **T1** |
| 86 | `import-data` | POST | careProfiles, medications, appointments, labResults | medications, appointments, labResults | — | — | **T1** |
| 87 | `import-medications` | POST | careProfiles, medications | medications | — | — | **T1** |
| 88 | `insurance/appeal` | POST | claims, careProfiles, insurance | — | **A** Haiku 4.5 | Anthropic | **T1** |
| 89 | `integrations/[source]` | DELETE | connectedApps | connectedApps, auditLogs | — | — | T3 |
| 90 | `interactions/check` | POST | careProfiles, medications | — | **A** Haiku 4.5 ×2 (drug-interactions) | Anthropic | **T1** |
| 91 | `journal` | POST, GET, DELETE | careProfiles, symptomEntries | symptomEntries | — | — | **T1** |
| 92 | `labs/trends` | GET | labResults | — | — | — | **T1** |
| 93 | `me` | GET | careProfiles | — | — | — | T3 (user identifiers + cancer fields) → **T2** |
| 94 | `notifications/[id]` | DELETE | notifications | notifications | — | — | **T2** |
| 95 | `notifications/generate` | GET (cron) | (calls lib/notifications which reads meds, appts, labs, fsaHsa, priorAuths, careProfiles, pushSubscriptions) | notifications | — | **web-push** | **T1** |
| 96 | `notifications/preferences` | GET, PUT | userSettings | userSettings | — | — | T4 |
| 97 | `notifications/read` | POST | notifications | notifications | — | — | T3 |
| 98 | `onboarding/complete` | POST | careProfiles, users, careGroupMembers, careGroups | careProfiles, users, careGroupMembers, careGroups | — | **R** Resend (onboarding recap with PHI) | **T2** |
| 99 | `prep` | GET | appointments, careProfiles | — | **A** Haiku 4.5 | Anthropic | **T1** |
| 100 | `profile-switch` | POST | careProfiles, careTeamMembers, userPreferences | userPreferences, auditLogs | — | — | T3 |
| 101 | `push/subscribe` | POST, DELETE | pushSubscriptions | pushSubscriptions | — | — | T3 |
| 102 | `records/appointments` | GET, POST, PUT, DELETE | appointments, careProfiles | appointments | — | — | **T1** |
| 103 | `records/doctors` | GET, POST, PUT, DELETE | doctors, careProfiles | doctors | — | — | **T2** (provider identifiers) |
| 104 | `records/labs` | GET | labResults | — | — | — | **T1** |
| 105 | `records/medication-observations` | GET, POST, PATCH | medicationObservations, medications, careProfiles | medicationObservations | — | — | **T1** |
| 106 | `records/medications` | GET, POST, PUT, PATCH, DELETE | medications, careProfiles | medications, matchingQueue | — | — | **T1** |
| 107 | `records/profile` | GET, PATCH, POST | careProfiles | careProfiles | — | — | **T2** |
| 108 | `records/restore` | POST | careProfiles | careProfiles | — | — | **T2** |
| 109 | `records/settings` | PATCH | userSettings | userSettings | — | — | T4 |
| 110 | `refills/status` | GET | careProfiles, medications (via lib/refill-tracker) | — | — | — | **T1** |
| 111 | `reminders/check` | GET (cron) | medicationReminders, reminderLogs, medications, pushSubscriptions | reminderLogs, notifications | — | **web-push** (med name in body) | **T1** |
| 112 | `reminders/respond` | POST | reminderLogs, notifications | reminderLogs, notifications | — | — | **T2** |
| 113 | `reminders` | GET, POST, DELETE | medicationReminders, reminderLogs | medicationReminders | — | — | **T2** |
| 114 | `save-scan-results` | POST | careProfiles, medications, labResults, insurance, appointments, claims | medications, labResults, insurance, appointments, claims, matchingQueue | — | — | **T1** |
| 115 | `scan-document` | POST | — | — | **A** Sonnet 4.6 (extract-document) | Anthropic | **T1** |
| 116 | `search` | GET | careProfiles, medications, appointments, labResults, documents, symptomEntries | — | — | — | **T1** |
| 117 | `seed-demo` | POST | careProfiles, medications, appointments, doctors, labResults, insurance, userSettings, notifications | (writes synthetic data) | — | — | T4 |
| 118 | `share/[token]/revoke` | POST | sharedLinks | sharedLinks | — | — | T3 |
| 119 | `share/[token]` | GET | sharedLinks | sharedLinks (view count) | — | — | **T2** (returns aggregated PHI snapshot — link is opaque) |
| 120 | `share` | GET, POST | sharedLinks, careProfiles, medications, appointments, labResults, doctors | sharedLinks, auditLogs | — | — | **T1** |
| 121 | `share/weekly` | GET | sharedLinks | — | — | — | T3 |
| 122 | `sync/google-calendar` | POST | connectedApps, careProfiles, appointments | appointments | — | Google Calendar | **T2** (appointment titles, locations) |
| 123 | `sync/status` | GET | connectedApps, auditLogs | — | — | — | T3 |
| 124 | `test/reset` | POST | (all PHI tables) | (truncates PHI) | — | — | T4 (test only) |
| 125 | `timeline` | GET | (5+ tables — meds, appts, labs, symptoms, notifications) | — | — | — | **T1** |
| 126 | `triage` | POST | careProfiles, medications | — | **A** Haiku 4.5 | Anthropic | **T1** |
| 127 | `trials/[nctId]/detail` | POST | careProfiles | — | **A** Sonnet 4.6 | Anthropic, ClinicalTrials.gov | **T1** |
| 128 | `trials/[nctId]` | GET | — | — | — | ClinicalTrials.gov | T4 |
| 129 | `trials/match` | POST | careProfiles | trialMatches | **A** Sonnet 4.6 (clinicalTrialsAgent) | Anthropic, ClinicalTrials.gov | **T1** |
| 130 | `trials/matches` | GET | trialMatches, careProfiles | — | — | — | **T2** (trial match reasons) |
| 131 | `trials/save` | POST | savedTrials, careProfiles | savedTrials | — | — | T3 |
| 132 | `trials/saved/[nctId]` | PATCH | savedTrials, careProfiles | savedTrials | — | — | T3 |
| 133 | `trials/saved` | GET | savedTrials, careProfiles | — | — | — | T3 |
| 134 | `upload/allergies` | POST | careProfiles | careProfiles | — | — | **T1** |
| 135 | `upload/insurance` | POST | insurance | insurance | — | — | **T2** |
| 136 | `visit-prep` | POST | appointments, careProfiles, medications, labResults, memories, symptomEntries, healthSummaries, treatmentCycles | — | **A** Sonnet 4.6 | Anthropic | **T1** |
| 137 | `welcome-email` | POST | (uses session name) | — | — | **R** Resend (low PHI: greeting only) | T3 |

### Tier rollup

| Tier | Count | Notes |
|---|---|---|
| **T1 CRITICAL** | 51 | Clinical data: labs, meds, symptoms, conditions, allergies, chemo cycle, mental health, document extraction, AI synthesis over PHI |
| **T2 HIGH** | 22 | Identifiers + clinical context (chat content, profile, provider directory, claims summaries, share links) |
| **T3 MEDIUM** | 50 | Identifiers/auth only (care group, login, password, OAuth, push subscriptions, settings) |
| **T4 LOW** | 14 | Static config, CSRF, healthcheck, demo, feature flags |

### Anthropic-touching routes (17)

These pass real PHI to `api.anthropic.com` (no BAA):
- `chat/route.ts:65,259,320` (Sonnet 4.6 demo + Haiku 4.5 simple + Sonnet 4.6 main)
- `chat/mobile/route.ts:23,131` (Haiku auto-title + Sonnet main)
- `chat/guest/route.ts:82` (no PHI — first-party content only)
- `checkins/voice-extract/route.ts:31`
- `cron/radar/route.ts:352`
- `cron/trials-match/route.ts:82`
- `cron/weekly-summary/route.ts:152`
- `health-summary/route.ts:55`
- `insurance/appeal/route.ts:65`
- `prep/route.ts:64`
- `triage/route.ts:90`
- `trials/[nctId]/detail/route.ts:108`
- `visit-prep/route.ts:124`
- `documents/extract/route.ts` (via `lib/extract-document.ts:20`)
- `extract-medications/route.ts` (via `lib/extract-document.ts:20`)
- `scan-document/route.ts` (via `lib/extract-document.ts:20`)
- `interactions/check/route.ts` (via `lib/drug-interactions.ts:37,86`)

Plus the indirect chat-pipeline hits via `lib/agents/orchestrator.ts:74` (Haiku per specialist), `lib/agents/router.ts:40` (Haiku router), `lib/memory/extract.ts:117,246` (Haiku extract + summary), `lib/memory-conflict.ts:129` (Haiku conflict resolver), `lib/appointment-prep.ts:110` (Sonnet visit prep), `lib/trials/clinicalTrialsAgent.ts:86` (Sonnet trials agent).

### Gemini / Voyage exposure

- **Gemini** (`gemini-embedding-001`, 768-dim) — only via `apps/web/src/lib/memory/embed.ts:7-9` (`GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`). Reached by **every memory write** (`extractAndSaveMemories`) and **every memory read** (`loadRelevantMemories` → `embedQuery`) and **every summary** (`summarizeConversation`). That covers all chat-pipeline routes: `chat`, `chat/mobile`, `cron/memory-eval`. Memory facts include lab values, doctor opinions, treatment response, emotional state, medications by name+dose — all PHI.
- **Voyage AI** (`rerank-2.5-lite`) — only via `apps/web/src/lib/memory/rerank.ts:17-30` (`VOYAGE_API_KEY`). Reached by hybrid retrieval — same call sites as Gemini.

### Resend (email) PHI

- `auth/reset-password/route.ts` — generic reset link only (T3).
- `care-team/invite/route.ts` — includes `patientName` in template (`apps/web/src/lib/email.ts:91`) — **T2**.
- `onboarding/complete/route.ts` — `onboardingRecapEmailHtml` may include user/patient name (**T2**).
- `welcome-email/route.ts` — first name only (T3).

### Sentry exposure

- `apps/web/src/instrumentation.ts:9-17, 21-29` initializes Sentry on both Node and Edge runtimes with `beforeSend: scrubPHI`.
- `apps/web/src/lib/sentry-utils.ts:3-21` redacts a curated allow-list of PHI keys (`patientName`, `cancerType`, `medicationName`, `value`, `referenceRange`, etc.) from `event.request.data`, `breadcrumbs[i].data`, and `event.extra`.
- **GAP**: The redactor checks key names only. Free-text PHI in error `message`/stack strings (e.g., a thrown `new Error('failed to save medication X 500mg for John Doe')`) bypasses scrubbing. The `message` key is in the list but only when nested in objects — top-level `event.message` isn't covered.
- **GAP**: `event.exception.values[*].value` (the actual error message) is not scrubbed at all.

### Vercel log exposure

- `apps/web/src/lib/logger.ts` is a clean JSON logger — does **not** scrub PHI; relies on call sites.
- 138 `console.*` calls across `app/api/**` go straight to Vercel log streams. Spot-checks reveal:
  - `chat/route.ts:329-335` logs token counts only — safe.
  - `app/api/delete-account/route.ts:24,36` logs `user.id` only — safe.
  - `lib/memory/retrieve.ts:257` audit-failure log includes `userId`+`reason` — safe.
  - `lib/agents/orchestrator.ts:61` includes `userId` — safe.
  - But there is **no enforced policy** — many of the 138 `console.error('[X] error:', err)` patterns will print the full Error message which, if it bubbles up a Drizzle SQL error from `INSERT INTO medications ... VALUES ('John Doe Med 500mg', ...)`, leaks PHI to Vercel logs.

---

## Part 3 — Shared Library PHI Hotspots

### AI / LLM call sites (Anthropic)

| File | PHI Handled | Vendor |
|---|---|---|
| `apps/web/src/lib/agents/orchestrator.ts:74` | Patient context (meds, doctors, appts, labs, insurance, claims, prior auths, FSA/HSA, memories, symptoms) injected into specialist prompts via `buildRelevantData` (lines 149-237). | Anthropic Haiku 4.5 |
| `apps/web/src/lib/agents/router.ts:40` | User message + last 2KB of conversation context. | Anthropic Haiku 4.5 |
| `apps/web/src/lib/agents/specialists.ts` | Per-specialist system prompts that read patient data keyed by `relevantDataKeys` (medications, allergies, conditions, doctors, insurance, claims, prior auths, FSA/HSA, appointments, labs, symptoms, mutations, treatment history). | Indirect — set by orchestrator |
| `apps/web/src/lib/system-prompt.ts` | L1-L4 system blocks; L2 stable user block + L3 dynamic block include profile (name, cancer type/stage/mutations), meds, doctors, appts, labs, claims, prior auths, FSA/HSA, treatment cycle, symptoms, memories, summaries. Built for `chat/route.ts:224-241` and `chat/mobile/route.ts:113-119`. | Goes to Anthropic |
| `apps/web/src/lib/tools.ts` | Defines `save_medication`, `save_lab_result`, `update_care_profile`, `log_symptoms`, `save_memory`, etc. Tool params include PHI; tool results return PHI. | Anthropic (tool calls + results) |
| `apps/web/src/lib/extract-document.ts:20` | Document image/text — pathology reports, lab reports, insurance EOBs. Returns structured `Extraction` (labs, meds, insurance, claims, appointments). | Anthropic Sonnet 4.6 |
| `apps/web/src/lib/drug-interactions.ts:37,86` | Patient med list + new med — produces interaction analysis. | Anthropic Haiku 4.5 ×2 |
| `apps/web/src/lib/appointment-prep.ts:110` | Patient context (cancer type/stage, meds, labs) + appointment + memories — generates visit prep. | Anthropic Sonnet 4.6 |
| `apps/web/src/lib/memory-conflict.ts:129` | Two memory facts (PHI) for conflict resolution / rewrite. | Anthropic Haiku 4.5 |
| `apps/web/src/lib/memory/extract.ts:117,246` | Full user+assistant exchange + existing memories list → extracted facts; conversation transcript → summary with KEY MEDICAL FACTS section. | Anthropic Haiku 4.5 |
| `apps/web/src/lib/trials/clinicalTrialsAgent.ts:86` | Patient profile (cancer type, stage, mutations, prior treatments) + trial candidates. | Anthropic Sonnet 4.6 |

### Embedding / rerank call sites

| File | PHI Handled | Vendor |
|---|---|---|
| `apps/web/src/lib/memory/embed.ts:7-9, 20-55` | Memory fact text + conversation summaries (lab values, treatment response, emotional state, medication changes). Calls `gemini-embedding-001`. | **Google Gemini** |
| `apps/web/src/lib/memory/rerank.ts:17-30` | Top-50 memory candidate facts (PHI). | **Voyage AI** |

### DB layer

| File | Description |
|---|---|
| `apps/web/src/lib/db/index.ts:1-19` | Drizzle ORM wired to **AWS Aurora Serverless v2** via RDS Data API (`@aws-sdk/client-rds-data`). Already on AWS — DB layer is fine. |
| `apps/web/src/lib/db/schema.ts` | Defines all PHI tables. PHI-bearing tables: `careProfiles`, `medications`, `doctors`, `appointments`, `conditions`, `allergies`, `procedures`, `immunizations`, `documents`, `insurance`, `claims`, `priorAuths`, `fsaHsa`, `labResults`, `memories`, `conversationSummaries`, `symptomEntries`, `wellnessCheckins`, `symptomInsights`, `medicationReminders`, `reminderLogs`, `medicationObservations`, `treatmentCycles`, `messages`, `conversations`, `notifications`, `sharedLinks`, `scannedDocuments`, `healthSummaries`, `trialMatches`, `savedTrials`, `mutations`. |

### Push / notifications

| File | PHI in body? | Vendor |
|---|---|---|
| `apps/web/src/lib/push.ts:1-32` | Just the web-push wrapper. Body is whatever the caller passes. | self-hosted web-push (VAPID) |
| `apps/web/src/lib/notifications.ts:125, 135, 161, 172, 195, 215, 280, 293, 306, 319` | Push body contains medication name + dose + refill date (line 125), appointment doctor name + time + location (line 161, 172), prior auth service name (line 195), lab test name + value + unit + reference range (line 215), **nadir warning with chemo drug name and cycle number** (line 280, 293, 306, 319). **All PHI in plaintext push payloads.** | web-push → APNS/FCM endpoints |
| `apps/web/src/app/api/care-hub/remind/route.ts` | Push body assembled from caller. | web-push |
| `apps/web/src/app/api/checkins/share/route.ts` | Push body of check-in shared with care team. | web-push |
| `apps/web/src/app/api/cron/nadir-alert/route.ts` | Drug name + cycle day. | web-push |
| `apps/web/src/app/api/cron/nadir-summary/route.ts` | Same as above. | web-push |
| `apps/web/src/app/api/cron/radar/route.ts` | AI-generated radar message body (PHI). | web-push |
| `apps/web/src/app/api/cron/weekly-summary/route.ts` | AI-generated summary body. | web-push |

### Cron jobs

| Route | What PHI it touches | LLM |
|---|---|---|
| `cron/memory-decay/route.ts` | UPDATEs `memories.decay_at` based on heuristics — no body read. | — |
| `cron/memory-eval/route.ts` | Loads memories for `EVAL_USER_ID` — synthetic eval user; runs retrieval (Gemini + Voyage). | Gemini, Voyage |
| `cron/nadir-alert/route.ts`, `cron/nadir-summary/route.ts` | Reads cycles + labs; sends push with PHI. | web-push |
| `cron/purge/route.ts` | Hard-deletes soft-deleted PHI rows. | — |
| `cron/radar/route.ts` | Reads symptoms + labs + treatment context → Anthropic Sonnet → push. | Anthropic, web-push |
| `cron/retention/route.ts` | Hard-deletes per retention policy. | — |
| `cron/sync/route.ts` | Calendar sync — reads encrypted tokens, fetches Google Calendar, writes appointments. | Google |
| `cron/trials-match/route.ts` | Reads care profile, runs trials agent (Sonnet) per profile in matching queue, writes `trialMatches`. | Anthropic, ClinicalTrials.gov |
| `cron/trials-status/route.ts` | Polls ClinicalTrials.gov for status changes on `savedTrials`, generates push notifications. | ClinicalTrials.gov |
| `cron/weekly-summary/route.ts` | Reads check-ins + insights → Haiku → push body. | Anthropic, web-push |
| `notifications/generate/route.ts` (called by cron) | Calls `generateNotificationsForAllUsers` → reads all PHI tables, writes notifications + push. | web-push |
| `reminders/check/route.ts` (cron) | Reads `medicationReminders` + sends push with med name. | web-push |

---

## Part 4 — Vercel-Specific Surfaces That See PHI

### Vercel Functions execution

Every route handler under `apps/web/src/app/api/**/route.ts` runs as a Vercel Function (Node.js — no explicit `runtime = 'edge'` declarations found except in CSP context). Per `apps/web/src/app/api/chat/route.ts:28` and `cron/*/route.ts`, `maxDuration` is set to 300s for AI-heavy routes (Pro Fluid Compute). **All 89 T1+T2 routes are PHI-bearing function executions** on Vercel infrastructure.

Vercel's standard plan does not provide a BAA. Per the request, this is the central blocker.

### Vercel logs

- `apps/web/src/lib/logger.ts:11-15` — minimum log level via `LOG_LEVEL` env, default `info`. Outputs JSON to stdout → Vercel log streams.
- 138 raw `console.*` calls in route handlers — many `console.error('[X] error:', err)` patterns will print the Drizzle SQL error message verbatim, which can contain row data PHI in the case of constraint violations.
- **Recommendation**: even after migration, T1 routes that remain on Vercel as forwarders must use the structured `logger` and a `redactError(err)` helper that strips PHI from `err.message`/`err.stack` (extension of `lib/sentry-utils.ts`).

### Vercel Blob

- `grep -rln "@vercel/blob\|VercelBlob"` returns **no matches** — Vercel Blob is not used. Document uploads go straight to `documents.extract` which calls Anthropic and inserts to Aurora.
- **Note**: `scan-document`, `extract-medications`, and `documents/extract` accept base64 / multipart image bodies that pass through the Vercel Function executor to Anthropic. The raw image bytes are PHI-bearing (e.g., scanned EOBs, lab reports, pill bottles).

### Vercel KV / Edge Config

- No `@vercel/kv` or `@vercel/edge-config` imports found.
- `apps/web/src/lib/rate-limit.ts:8-9` uses **Upstash Redis** (via `@upstash/ratelimit`) — Upstash is a separate vendor with its own BAA-availability story (check the Upstash account tier). Rate limit token is the user ID (`agent:${userId}` etc.) — userId is not PHI in isolation, but Upstash sees access patterns by user.

### Vercel preview deploys

- Preview deploys read `VERCEL_ENV=preview` env-scoped secrets. The prod Aurora credentials (`AWS_RESOURCE_ARN`, `AWS_SECRET_ARN`) need to be **NOT exposed to preview**. Without checking the Vercel project settings directly, the code reads from `process.env` without environment guarding, so if prod creds are set at `production` scope only, previews are isolated. **Action item**: confirm in Vercel UI that production DB creds are NOT visible to Preview env, and that preview gets a separate seeded staging DB (or no DB).

### Vercel Analytics / Speed Insights

- `next.config.mjs:24-25` whitelists `https://*.vercel-analytics.com` and `https://*.vercel-insights.com` in CSP `connect-src`. Vercel Web Analytics sends pageview events, not request bodies. Speed Insights sends RUM perf metrics, not request bodies. **No PHI passes to Vercel Analytics by default**. URL paths can leak identifiers though — `/conversations/[id]`, `/api/share/[token]` — token is opaque and id is uuid, so low risk.
- PostHog is also wired (`https://*.posthog.com`) — separate vendor; confirm BAA / no PHI in events.

### Vercel Cron

- 11 `app/api/cron/**` routes are invoked via Vercel Cron (verified by `verifyCronRequest` in `lib/cron-auth.ts`). These run inside Vercel Functions, so they see PHI in the same way as request-driven routes. **All cron jobs that touch PHI must move to AWS** (EventBridge → Lambda, or AWS Step Functions).

---

## Part 5 — Architecture Migration Plan

### Target architecture (2-tier)

```
                ┌────────────────────────────┐
                │   Vercel (PHI-free zone)   │
                │                            │
   Browser ───► │  Next.js App Router        │
                │  - RSC page rendering      │
                │  - Static marketing pages  │
                │  - Public docs (privacy)   │
                │  - Auth pages              │
                │  - T4 + selected T3 routes │
                │    (csrf-token, healthcheck│
                │     , social JWKS verify)  │
                │                            │
                │  Server actions for forms  │
                │  proxy to AWS              │
                └──────────────┬─────────────┘
                               │ HTTPS + signed JWT
                               │ (Authorization: Bearer)
                               ▼
                ┌────────────────────────────┐
                │  AWS (PHI handling zone)   │
                │                            │
                │  CloudFront ─► API Gateway │
                │       │                    │
                │       ▼                    │
                │  Lambda functions:         │
                │   - chat, chat/mobile      │
                │   - records/*              │
                │   - cron/* (EventBridge)   │
                │   - documents/extract      │
                │   - memory pipeline        │
                │       │                    │
                │       ▼                    │
                │  Aurora Postgres (prod)    │ ◄─── already here
                │  Bedrock (Claude+Cohere)   │ ◄─── new
                │  KMS (envelope encryption) │
                │  CloudWatch (encrypted logs)│
                │  SNS → APNS/FCM (push)     │
                └────────────────────────────┘
```

### Tier 1: Vercel (PHI-free)

**Stays on Vercel forever**:
- `apps/web/src/app/(app)/**/page.tsx` and all RSC layouts — render shell only, no PHI in HTML (fetch via authenticated AWS calls from server components or client components after hydration; pre-render the user-agnostic shell).
- `app/about`, `app/privacy`, `app/terms`, `app/conditions`, `app/login`, `app/signup`, `app/contact`, `app/setup`, `app/onboarding` (UI scaffolding only — form submits go to AWS).
- `api/health/route.ts` — basic uptime probe (move actual schema check + remove PHI table reads, or keep as a separate route on AWS that the Vercel probe calls).
- `api/csrf-token/route.ts` — purely session token issuance.
- `api/feedback/route.ts` — only if the body schema is constrained to non-PHI fields (today it's a free-text logger that could contain PHI — **migrate**).
- `api/notifications/preferences/route.ts` — `userSettings` table only (toggles + timezone); confirm no PHI fields there.
- `api/welcome-email/route.ts` — only first name; arguably stays.
- NextAuth core handler (`api/auth/[...nextauth]`) — session establishment, JWT issuance. Session JWT is the auth handoff to AWS. Account row writes (`users` table) must go through an AWS Lambda to avoid touching PHI tables from Vercel.
- Static assets, PWA service worker, favicon, fonts, images.
- Vercel Web Analytics + Speed Insights (URL-only, no PHI in event payloads).

**Migrates to AWS in Phase 1-3** (all of `T1` + `T2`, and any `T3` that share imports with PHI table reads):
- All 51 T1 routes
- All 22 T2 routes
- All 11 cron routes (move to EventBridge schedules)
- All Anthropic / Gemini / Voyage call sites

### Tier 2: AWS (PHI-handling)

**Recommended surface — Option C with A-fallback**:

**Option A — API Gateway HTTP API + Lambda (Node 22)**:
- Pros: serverless, pay-per-request, mirrors Vercel Functions execution model 1:1, easy to migrate route-by-route, sub-second cold-start for warm functions with provisioned concurrency.
- Cons: per-route Lambda function explosion (89+ functions), bundling Next.js types/Drizzle/AI SDK into Lambda packages requires care, observability per-function.
- **Verdict**: best fit for 80% of routes — the per-route migration aligns with feature-flag rollout.

**Option B — ECS Fargate + ALB**:
- Pros: predictable warm latency, easier shared in-process cache, full Node runtime.
- Cons: higher idle cost; doesn't natively map to per-route deploys; container orchestration overhead.
- **Verdict**: overkill for the cron + sync surface that can run on schedule.

**Option C — App Runner**:
- Pros: managed container, simpler than ECS, no cluster to babysit.
- Cons: no per-route execution model; one container handles all traffic; less observability per route; cold-start when scale-to-zero.
- **Verdict**: useful as a single "PHI-services" container for low-traffic routes if Lambda packaging proves painful.

**Pick**: **Option A (Lambda + API Gateway) as primary; Option B (Fargate) reserved for the chat streaming endpoint** (long-lived response streams + LLM orchestrator are easier to debug as a single Node service with consistent cold path).

### LLM provider swaps

#### Anthropic → AWS Bedrock Claude

- **Available models in Bedrock** (us-east-1):
  - `anthropic.claude-sonnet-4-5-20250929-v1:0` — Sonnet 4.5 (latest in Bedrock at time of last published catalog; verify in console — Sonnet 4.6 may not yet be on Bedrock, in which case use 4.5 as the temporary destination and request 4.6 access).
  - `anthropic.claude-haiku-4-5-20251001-v1:0` — Haiku 4.5.
  - **Coverage check**: every `claude-sonnet-4-6` and `claude-haiku-4-5-20251001` usage in the codebase needs a Bedrock equivalent in the target region.
- **AWS BAA**: covers Bedrock (since 2024-09 GA expansion). PHI in inference is allowed under the BAA. Confirm AWS BAA addendum lists Bedrock in the included-services list for the active CareCompanion account.
- **Cost**: Bedrock pricing is comparable to direct Anthropic API (typically within 0-15% premium depending on region). Provisioned Throughput is NOT required for low-volume — On-Demand Throughput is fine for current scale.
- **Code change**: Replace `import { anthropic } from '@ai-sdk/anthropic'` + `anthropic('claude-sonnet-4-6')` with `import { bedrock } from '@ai-sdk/amazon-bedrock'` + `bedrock('anthropic.claude-sonnet-4-5-20250929-v1:0')`. The Vercel AI SDK has `@ai-sdk/amazon-bedrock` which preserves `generateText`/`streamText`/`Output` semantics. Prompt caching API differs: AI SDK Bedrock provider supports it via the same `cacheControl` shape (Bedrock added native Anthropic prompt cache support 2025). Verify cache hit telemetry maps.
- **Streaming on AWS Lambda**: API Gateway supports response streaming via Lambda Function URLs (or via WebSocket API). Pivot the chat endpoint to use a Lambda Function URL with `RESPONSE_STREAM` invoke mode and let CloudFront proxy from `api.carecompanion.aws/chat` to the function URL. This preserves the streaming UX.

#### Voyage AI rerank → Bedrock Cohere Rerank 3.5

- **Available**: `cohere.rerank-v3-5:0` (Bedrock multi-region).
- **AWS BAA**: covers Bedrock.
- **Code change**: replace `fetch('https://api.voyageai.com/v1/rerank', ...)` in `lib/memory/rerank.ts:17-30` with `BedrockRuntimeClient.send(new InvokeModelCommand({ modelId: 'cohere.rerank-v3-5:0', ... }))`. The response format differs (Cohere returns `{results: [{index, relevance_score}]}` — matches Voyage's shape closely).
- **Quality consideration**: Voyage `rerank-2.5-lite` and Cohere Rerank 3.5 are both top-tier; expect parity on healthcare-domain queries. Run the existing `cron/memory-eval` harness on a 1% canary before flipping.

#### Gemini embeddings → Bedrock Cohere Embed or Titan v2

- **Options**:
  - `cohere.embed-english-v3` — 1024 dimensions (fixed). Requires schema migration of the `embedding halfvec(768)` column to 1024.
  - `amazon.titan-embed-text-v2:0` — supports configurable dimensions: 256, 512, **1024**. Schema migration to 1024 (or self-host BGE-M3 / sentence-transformers on Lambda+EFS for true 768-dim parity if migration is unacceptable).
- **Recommended**: **Titan v2 at 1024-dim** + a one-time backfill migration of `memories.embedding` and `conversation_summaries.embedding`.
- **Alternative**: **self-host `all-mpnet-base-v2` or `bge-m3` on a Lambda with `lambda-python-runtime` and provisioned concurrency** if Bedrock embeddings cost is prohibitive at scale. PHI stays in-VPC.
- **Code change**: `lib/memory/embed.ts:7-9` swap `createGoogleGenerativeAI` → `bedrock` provider. Migration: write a script that re-embeds all rows in `memories` and `conversation_summaries`, store new vectors in shadow columns, swap atomically.
- **AWS BAA**: Bedrock-covered.

#### Resend (email)

- For T2 routes that send patient name in email (`care-team/invite`, `onboarding/complete`):
  - **Recommended pivot**: AWS SES with templated emails. SES is BAA-covered. Templates stored in AWS, rendered server-side in the Lambda that owns the route.
- Code change: `lib/email.ts:35-50` swap `Resend` SDK → `@aws-sdk/client-sesv2`.

#### Sentry

- **Current state**: redactor in place but incomplete (Part 4). Sentry SaaS (Functional Software, Inc.) **does offer a BAA on Business tier** — verify CareCompanion's Sentry plan. If on Team tier, either upgrade or self-host Sentry on AWS (Sentry On-Premise via Helm on EKS) — significant ops overhead.
- **Alternative**: route Lambda errors to CloudWatch Logs + CloudWatch Alarms only (drop Sentry from the AWS side). Vercel side keeps Sentry but only emits non-PHI errors (auth, csrf, marketing).

#### Push notifications

- `lib/notifications.ts:125, 215, 280` — current push body includes med names + lab values + dose. **Stop sending PHI in push body.** Replace with opaque message + deep-link:
  - Body: `"You have a new alert"` + `data: { notificationId: <uuid>, url: '/dashboard/notifications/<uuid>' }`
  - The app fetches detail from `notifications/[id]` (which is on AWS, BAA-covered) when the user taps.
- Move from `web-push` (VAPID) to **AWS SNS Mobile Push** with APNS + FCM platform applications. SNS is BAA-covered. iOS notification extension on the mobile app can fetch detail before rendering — keeps the rich content but pulls it from AWS instead of putting it in the APNS payload (which transits Apple infrastructure).
- This change alone is independent of the Lambda migration and can ship in Phase 0.

### Networking & auth

**JWT bridge**:
1. NextAuth (Vercel) issues a JWT to the browser with `sub=userId`, `careProfileId`, `role`, and a short TTL (15min) + refresh token.
2. Browser includes `Authorization: Bearer <jwt>` on all calls to `api.carecompanion.aws/*`.
3. API Gateway uses a **JWT Authorizer** validating the same signing key (asymmetric ES256; private key in Vercel env, public key as JWKS in S3 → API Gateway authorizer config).
4. CORS on API Gateway allows only `https://carecompanionai.org` and `https://*.vercel.app` (preview).
5. NextAuth session refresh stays on Vercel; the JWT is the cross-boundary credential.

**Rate limiting**:
- Move from Upstash Redis to **API Gateway usage plans + AWS WAF rate-based rules** (BAA-covered) for ingress rate limits.
- For tighter per-user budgets (chat budget reservation in `lib/budget.ts`), keep that logic inside the Lambda but back it with **DynamoDB** or **Aurora** instead of Redis. DynamoDB is BAA-covered.

**Cron**:
- Replace 11 Vercel Cron routes with **AWS EventBridge Scheduler** → invokes each Lambda on schedule. `verifyCronRequest` becomes IAM-based (EventBridge → Lambda invoke ARN).

### Phased migration

#### Phase 0 — Isolate & inventory (Week 1)
- **Effort**: S (3-5 days, 1 eng)
- Tag every route file with `// @phi-tier T1|T2|T3|T4` comment header (enforced via lint rule).
- Land a feature flag `USE_AWS_PHI_BACKEND` per route family (chat / records / cron / memory / extraction).
- Strip PHI from push notification bodies (`lib/notifications.ts`) — ship behind `USE_OPAQUE_PUSH` flag, default ON in production. **This alone removes PHI from APNS/FCM transit immediately.**
- Tighten Sentry scrubber to cover `event.exception.values[*].value` and `event.message` top-level.
- Confirm Vercel project env scoping: prod Aurora creds NOT in Preview.
- **Deliverable**: 1 PR per route family touching only feature-flag scaffolding + push body redaction.

#### Phase 1 — Bedrock pivot + AWS Lambda foundation (Week 2-3)
- **Effort**: M (8-10 days, 1 eng)
- Provision: AWS account already in place; submit Bedrock model access request for `anthropic.claude-sonnet-4-5-*`, `anthropic.claude-haiku-4-5-*`, `cohere.rerank-v3-5:0`, `amazon.titan-embed-text-v2:0` in `us-east-1`. Lead time: 1-24h typically.
- Set up: API Gateway HTTP API + first Lambda function (chat) using SAM or AWS CDK. Lambda Function URL with response streaming for chat. CloudFront in front. CloudWatch log group with KMS-encrypted log destination.
- Code:
  - Add `@ai-sdk/amazon-bedrock` dependency.
  - Create `lib/llm/bedrock.ts` adapter that exports `model(name)` returning the right Bedrock provider so the rest of the code only references `model('sonnet-4-5')` / `model('haiku-4-5')`.
  - Refactor every `anthropic('claude-...')` call to use the adapter. (`grep -l` count: 26 call sites; 1 hour of edits + tests.)
  - Behind `USE_BEDROCK_LLM=true`, the adapter returns Bedrock; otherwise Anthropic API (rollback path).
- **A/B**: route 1% of `/api/chat` POSTs through the new Lambda via a Vercel rewrite (`vercel.json` rewrites with sticky-by-user-hash).
- **Deliverable**: chat works end-to-end against Bedrock. Memory extract + retrieve still on Vercel/Anthropic — touched in Phase 2.
- Risks: prompt caching parity (Bedrock supports it but cache key format differs — verify cache hit telemetry); Sonnet 4.6 unavailability in Bedrock (fall back to 4.5 with explicit user-facing note in CHANGELOG).

#### Phase 2 — Memory pipeline + extraction routes (Week 4-5)
- **Effort**: M (8-10 days, 1 eng)
- Migrate `lib/memory/embed.ts` to Titan v2 1024-dim. Write a backfill job (run on AWS Fargate, not Vercel) that re-embeds all `memories.embedding` and `conversation_summaries.embedding` to a new shadow column `embedding_v2 halfvec(1024)`. Atomic cutover via `ALTER TABLE RENAME COLUMN`.
- Migrate `lib/memory/rerank.ts` to Bedrock Cohere Rerank 3.5.
- Migrate `lib/memory/extract.ts` and `lib/memory-conflict.ts` to Bedrock via the adapter (Phase 1 work covers this automatically).
- Port routes to AWS Lambda:
  - `documents/extract`, `extract-medications`, `scan-document` → 1 Lambda each (or one shared "extraction" Lambda).
  - `insurance/appeal`, `triage`, `prep`, `visit-prep` → 1 Lambda each.
  - `interactions/check`, `drug-interactions` lib calls.
  - `trials/[nctId]/detail`, `trials/match`.
- Vercel keeps an HTTP forwarder for each migrated route — strip body, forward bearer token, proxy to AWS. (This is a temporary stage to keep mobile clients working without a forced upgrade.)
- **A/B**: 10% → 50% → 100% over a week with `/cron/memory-eval` quality gate (existing harness).
- **Deliverable**: zero PHI in Anthropic API. zero PHI in Voyage AI. zero PHI in Gemini.

#### Phase 3 — Remaining T1/T2 routes + cron (Week 6-7)
- **Effort**: L (10-15 days, 1 eng)
- Move all remaining T1/T2 routes to Lambda:
  - `records/*` (8 routes — pure DB; trivial port).
  - `chat/history`, `chat/search`, `conversations/*` (DB-only; trivial).
  - `journal`, `labs/trends`, `compliance/*`, `caregiver/burnout`, `cycles/*`, `timeline`, `search`, `care-hub`, `care-hub/remind`.
  - `share/*`, `checkins/*`, `health-summary/*`, `healthkit/*`, `import-data`, `import-medications`, `save-scan-results`, `upload/*`, `export/*`, `export-data`, `documents/[id]`, `me`, `care-profiles/*`, `notifications/[id]`, `reminders/*`, `refills/status`.
- Move 11 cron routes to EventBridge Scheduler → Lambda.
- Move email-with-PHI routes to SES: `care-team/invite`, `onboarding/complete`.
- **Deliverable**: Vercel hosts no T1/T2 route handlers — only forwarders and pure UI/auth.

#### Phase 4 — Decommission Vercel forwarders + cleanup (Week 8)
- **Effort**: S (3-5 days, 1 eng)
- Force mobile + web clients to call AWS directly (drop Vercel forwarder routes).
- Delete handler bodies; keep `app/api/**/route.ts` files only for routes that genuinely remain on Vercel (T3/T4 list above).
- Remove `@ai-sdk/anthropic`, `@ai-sdk/google`, and remove `VOYAGE_API_KEY` from Vercel envs.
- Remove Anthropic, Voyage, Gemini from `next.config.mjs` CSP `connect-src`.
- Vercel BAA-free posture is now defensible.

### Summary table

| Phase | Duration | Effort | What ships |
|---|---|---|---|
| 0 | Week 1 | S | Feature flags, push-body redaction, Sentry hardening |
| 1 | Week 2-3 | M | Bedrock adapter, chat on Lambda (1% A/B) |
| 2 | Week 4-5 | M | Memory pipeline + extraction routes on AWS; zero Anthropic/Gemini/Voyage PHI traffic |
| 3 | Week 6-7 | L | All T1/T2 routes on Lambda; cron on EventBridge; SES for emails-with-PHI |
| 4 | Week 8 | S | Delete Vercel forwarders, clean envs and CSP |

**Total: 6-8 engineer-weeks.**

### Required AWS resources

- **Bedrock model access**: 4 model IDs (Sonnet 4.5, Haiku 4.5, Cohere Rerank 3.5, Titan Embed v2). Submit via AWS console (1-24h approval).
- **Lambda functions**: ~30 distinct functions if grouped by domain (chat, records, memory, cron-trials, cron-radar, cron-weekly, cron-nadir, extraction, share, exports, healthkit, insurance, trials, prep, etc.). One Lambda Function URL for the chat-streaming endpoint.
- **API Gateway**: 1 HTTP API with ~30 routes (matches the Lambda count, fewer if grouped under proxy integrations).
- **CloudFront**: 1 distribution fronting API Gateway + Lambda Function URL.
- **Aurora**: already in place; add a `bastion + VPC endpoint` for Lambda VPC access if not already configured (RDS Data API doesn't strictly require VPC, but Lambda-in-VPC is cleaner for KMS-encrypted traffic).
- **SES**: 1 verified sender domain (`carecompanionai.org`) + production access request.
- **SNS**: 2 platform applications (APNS prod, FCM prod) + topic per user (or single fanout topic with attributes).
- **EventBridge Scheduler**: 11 schedule rules.
- **CloudWatch**: log groups per Lambda; alarms on error rate, p95 latency, throttles.
- **KMS**: 1 customer-managed key (CMK) for CloudWatch log encryption + Lambda env var encryption.
- **Secrets Manager**: store Bedrock-not-needed (uses IAM); store NextAuth JWT signing keys, Resend (during transition), Aurora secret already there.
- **WAF**: 1 web ACL on API Gateway with rate-based rule.
- **CDK / SAM / Terraform**: infra-as-code repo (new package `apps/aws-infra` or co-located).

### Risks

1. **Bedrock Sonnet 4.6 availability**: confirm before Phase 1 starts. If not available in Bedrock, plan for Sonnet 4.5 transitional state with explicit QA on the chat quality eval suite.
2. **Cross-region latency**: Vercel default region for the user → AWS `us-east-1`. If Vercel users are routed elsewhere (Frankfurt, Singapore), add 50-150ms per call. Mitigation: CloudFront in front of API Gateway, multi-region Lambda (us-east-1 + us-west-2), or accept latency for v1.
3. **NextAuth JWT key rotation**: JWKS hosted on S3 + CloudFront with short cache TTL. Verifier in API Gateway must tolerate key rotation events (10-minute overlap window).
4. **Memory embedding migration**: re-embedding all rows is a one-shot, ~768→1024 dim change requires schema migration. Risk of double-cost during shadow column phase. Backfill job size: estimate based on prod row count (likely <10M rows → <$500 in Bedrock embeddings cost).
5. **Streaming over Lambda Function URLs**: response streaming has a 25-MB hard cap and 15-minute timeout — fits chat workloads but verify multi-tool-call orchestrator doesn't exceed.
6. **Vercel preview deploys hitting AWS prod**: must use separate Lambda deployment per environment (`-staging` aliases) and route Vercel preview to staging. New work for the CI/CD pipeline.
7. **iOS Push detail-fetch UX regression**: opaque push body requires the user to be authenticated to fetch detail. For locked-screen / unauthenticated devices, the user only sees "You have a new alert." Acceptable trade-off for HIPAA but UX should be communicated.
8. **Mobile app upgrade cycle**: forced cutover to AWS endpoints means an app store release with hard backend URL change. Use a remote config or feature-flag to flip the endpoint without forcing a binary update.
9. **Cost ceiling**: subscription-based Anthropic (Claude Code) goes away for runtime usage. Bedrock On-Demand has higher per-token cost than direct Anthropic — but the trade is BAA coverage. Estimate: at current usage tier, expect $200-500/month additional.

### What stays on Vercel forever

- Marketing pages, blog, privacy/terms.
- Auth UI (`/login`, `/signup`, `/setup`, `/onboarding`).
- All RSC page shells.
- NextAuth session establishment (the JWT issuer).
- `api/csrf-token`, `api/health` (uptime probe), `api/welcome-email` (first-name only).
- Static assets, PWA manifest, service worker.
- Vercel Web Analytics (URL-only).

### What moves to AWS

- All 51 T1 routes.
- All 22 T2 routes.
- All 11 cron jobs.
- All AI/LLM call sites.
- All embedding + rerank calls.
- All PHI emails (via SES).
- All push notifications (via SNS with redacted bodies).
- Memory pipeline.

---

## Key Citations

- `apps/web/src/lib/agents/orchestrator.ts:74` — Anthropic Haiku 4.5 call with full patient context.
- `apps/web/src/lib/agents/router.ts:40` — Anthropic Haiku 4.5 routing call with user message + history.
- `apps/web/src/lib/agents/specialists.ts:20-348` — Per-specialist system prompts that embed PHI per data key.
- `apps/web/src/lib/memory/embed.ts:7-9, 20-55` — Gemini embedding of PHI memory facts.
- `apps/web/src/lib/memory/rerank.ts:17-30` — Voyage AI rerank of PHI memory candidates.
- `apps/web/src/lib/memory/extract.ts:117, 246` — Anthropic Haiku 4.5 extraction of facts from full chat exchanges.
- `apps/web/src/lib/memory-conflict.ts:129` — Anthropic Haiku 4.5 conflict resolution over PHI facts.
- `apps/web/src/lib/extract-document.ts:20` — Anthropic Sonnet 4.6 on raw document images (lab reports, EOBs).
- `apps/web/src/lib/drug-interactions.ts:37, 86` — Anthropic Haiku 4.5 on patient med list.
- `apps/web/src/lib/appointment-prep.ts:110` — Anthropic Sonnet 4.6 on full patient context.
- `apps/web/src/lib/trials/clinicalTrialsAgent.ts:86` — Anthropic Sonnet 4.6 on cancer profile.
- `apps/web/src/lib/notifications.ts:125, 161, 195, 215, 280, 293, 306, 319` — PHI in push notification bodies.
- `apps/web/src/lib/push.ts:1-32` — VAPID web-push wrapper.
- `apps/web/src/lib/email.ts:91` — `patientName` interpolated in care-team invite email.
- `apps/web/src/lib/db/index.ts:1-19` — Aurora via RDS Data API (already AWS).
- `apps/web/src/lib/db/schema.ts:139-856` — 32 PHI-bearing tables.
- `apps/web/src/lib/logger.ts:11-15` — Structured logger (no PHI scrubber).
- `apps/web/src/lib/audit.ts:47-69` — PHI access audit logger (writes `auditLogs` table on Aurora).
- `apps/web/src/lib/sentry-utils.ts:3-21, 39-61` — PHI key-name scrubber; misses top-level `event.message` + `event.exception.values[*].value`.
- `apps/web/src/instrumentation.ts:9-29` — Sentry initialized with `beforeSend: scrubPHI` on Node and Edge.
- `apps/web/next.config.mjs:23-25` — CSP whitelists `*.anthropic.com`, `*.vercel-analytics.com`, `*.vercel-insights.com`, `*.posthog.com`.
- `apps/web/src/app/api/chat/route.ts:1-380` — Canonical chat handler, full PHI orchestration on Vercel.
- `apps/web/src/app/api/chat/mobile/route.ts:1-164` — Mobile chat with Anthropic auto-titling on user PHI.
