# Regulatory Risk Analysis — FDA SaMD / MDR Assessment

**Date**: 2026-05-22  
**Branch**: aryan/dev  
**Prepared by**: Engineering (Aryan)  
**Scope**: apps/web/src, apps/mobile — all health-data surfaces  

---

## 1. Dose Calculation Audit Result

### Finding: No active dose-calculation logic found

A full grep of the codebase for `mg/kg`, `BSA`, `body surface area`, `eGFR`, `creatinine clearance`, and weight-based dosing algorithms found **zero** pharmacological dose-computation implementations.

The only related references:

| File | Reference | Risk |
|------|-----------|------|
| `apps/web/src/lib/seed-data.ts:32` | `dose: '5mg/kg'` | **None** — static seed/demo text only, never computed |
| `apps/mobile/src/services/scanner.ts` | Regex `(\d+(?:\.\d+)?)\s?(mg\|mcg\|ml\|g\|iu\|units?)` | **None** — OCR extraction of user-supplied data, no arithmetic |
| `apps/mobile/src/services/internal/normalizers.ts` | `normaliseMedication()` extracts `dose` field from FHIR text | **None** — passthrough normalization, no computation |
| `apps/web/src/components/TreatmentCycleTracker.tsx` | `parseCycleInfo()` calculates `dayInCycle` from refill date | **Low** — administrative cycle-day counter, no pharmacological math |

**Conclusion**: No mg/kg, BSA, or renal-adjusted dose calculation exists. No SaMD Class II/III dose-engine risk at this time.

---

## 2. Risk Surface Inventory

### 2a. Lab Result Interpretation — `LabInterpretation.tsx`

**What it does**: Displays a static knowledge-base interpretation for 20 lab tests (WBC, Creatinine, PSA, CA-125, etc.) with low/high meanings and patient-facing advice text.

**FDA SaMD concern**:  
The component provides clinical-sounding interpretation ("A low WBC means your immune system is weakened…") and actionable guidance ("call your oncologist immediately for fever above 100.4°F"). Without adequate disclaimers, this could be characterized as a decision-support tool under FDA's SaMD guidance document (2019) and Software as a Medical Device (SaMD): Clinical Evaluation (2017).

**Classification risk under FDA SaMD framework**:
- Intended use: Provide information that aids treatment/diagnosis → **Moderate** concern
- Healthcare situation: Cancer patients with immunosuppression → **Serious** situation
- State of healthcare: May require urgent intervention (e.g., neutropenic fever) → **High**
- Preliminary SaMD risk class: **Class II** (if marketed as decision support)

**Mitigations applied (this PR)**:
- Added inline disclaimer: "For informational purposes only — not for medical decisions. Always consult your care team. General oncology reference · CareCompanion AI"
- Added source attribution to every expanded interpretation panel

**Remaining gap**:
- The knowledge base has no versioning or dated source. Recommend adding a `LAST_REVIEWED` constant and displaying it (e.g. "Reference updated Jan 2025").
- Consider replacing the static knowledge base with a clearly-labeled "educational context" framing rather than "Your result" + "What to do" headings, which imply clinical direction.

---

### 2b. Lab Trend Predictions — `LabTrends.tsx`

**What it does**: Fetches trend analysis from `/api/labs/trends` and displays a `prediction_7d` (7-day predicted value) alongside trend arrows (improving / declining / rapid_decline) and red-flag alerts.

**FDA SaMD concern**:  
Predictive health analytics with actionable severity labels ("Critical", "Rapid Decline") and 7-day forecasts constitute a **Software Function** under 21 CFR 880.6310. The "Rapid Decline" label with associated alerts could be construed as a diagnostic aid.

**Classification risk**:
- 7-day predictions of lab markers during active cancer treatment → **Class II potential**
- Red-flag alert pipeline (`/api/labs/trends` → red_flags array) needs audit to confirm it is not returning clinically-actionable thresholds without physician oversight

**Mitigations applied (this PR)**:
- Added inline disclaimer: "Not for medical decisions — consult your care team. 7-day predictions are estimates, not clinical guidance."

**Remaining gap**:
- Audit `/api/labs/trends` route to confirm the `red_flags` and `prediction_7d` fields are clearly labeled as informational/statistical in API responses and documentation.
- The `overall_status` field ('critical', 'concerning') should be renamed or re-labeled to avoid clinical-severity connotation. Recommend: 'attention-needed' instead of 'critical'.

---

### 2c. Creatinine Tracking (Kidney Function Proxy)

**What it does**: `HealthDataChart.tsx` and `LabInterpretation.tsx` both include Creatinine with reference range 0.6–1.2 mg/dL and display "High creatinine suggests your kidneys may not be filtering well."

**FDA SaMD concern**:  
Creatinine is used clinically as a proxy for eGFR. Displaying it with a normal range and interpretation ("kidneys may not be filtering well") is not dose-calculation, but combined with the chemo context it could influence dosing decisions made by patients or informal caregivers.

**Classification risk**: **Low** — informational display with reference range, no computation.

**Mitigation**: Existing "consult your care team" text in the Creatinine advice block. No further action required beyond general disclaimer already added.

---

### 2d. Treatment Cycle Phase Tracking — `TreatmentCycleTracker.tsx`

**What it does**: Calculates which phase of a chemotherapy cycle a patient is in (Infusion / Nadir / Recovery / Pre-Infusion) based on medication notes and refill dates. Surfaces a "Watch for fever > 100.4°F" alert during nadir phase.

**FDA SaMD concern**:  
Automated nadir identification and fever-threshold alerting during chemotherapy is clinically significant. "Nadir" identification is based on a hard-coded `dayInCycle >= 8 && dayInCycle <= 14` rule. This is:
- Simplified (nadir timing varies widely by regimen)
- User-data-driven (relies on `med.refillDate` accuracy)
- Potentially alarming or falsely reassuring

**Classification risk**: **Class I / Low Class II** — educational cycle calendar, but the fever alert is actionable.

**Mitigations applied (this PR)**:
- Added disclaimer in the progress footer.

**Remaining gaps**:
- The fever-alert hardcode (`dayInCycle >= 8 && dayInCycle <= 14`) should include a note that nadir timing varies by regimen: "Typical nadir window. Actual timing varies by regimen — follow your oncologist's guidance."
- Consider adding a tooltip or secondary label to the "Nadir Period" phase label clarifying it is an estimate.

---

## 3. MDR (EU Medical Device Regulation) Considerations

Under MDR 2017/745, software qualifies as a medical device if it has a **medical purpose** (Article 2(1)). CareCompanion's current positioning as an "organizer" / "companion" tool is the primary defense.

Key risks under MDR:

| Feature | MDR Risk Class | Basis |
|---------|---------------|-------|
| Lab interpretation with clinical guidance text | **Class IIa** potential | MDCG 2019-11 Rule 11 (software providing diagnosis/monitoring information) |
| 7-day lab predictions with severity labels | **Class IIa** potential | Active predictive analytics on serious health conditions |
| Cycle phase / nadir alerting | **Class I / IIa boundary** | Informational calendar vs. clinical alert |
| Medication dose display (passthrough) | **Class I** | No computation; displays provider-entered data |

**Recommendation**: Legal/regulatory review before any EU launch. Current product is likely defensible as Class I if the interpretation text is clearly framed as educational/informational. The `overall_status: 'critical'` label and the 7-day predictions are the clearest Class IIa triggers and should be addressed before an EU release.

---

## 4. Action Items

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| **P0** | Inline disclaimers on all web health-data screens | Aryan | ✅ Done (this PR) |
| **P0** | Mobile disclaimer patches | Shreyash | ⬜ Pending Shreyash review |
| **P1** | Audit `/api/labs/trends` — confirm `red_flags` are informational, not clinical | Aryan | ⬜ Open |
| **P1** | Rename `overall_status: 'critical'` → `'attention-needed'` in API + UI | Aryan | ⬜ Open |
| **P1** | Add `LAST_REVIEWED` date to `LAB_TEST_KNOWLEDGE` in `LabInterpretation.tsx` | Aryan | ⬜ Open |
| **P2** | Add regimen-variation caveat to Nadir phase label | Aryan | ⬜ Open |
| **P2** | Reframe "Your result / What to do" headings as "General context / Common actions" | Aryan | ⬜ Open |
| **P3** | Legal/regulatory review before any EU launch | All | ⬜ Open |

---

## 5. Out of Scope

The following were checked and found to pose **no active risk**:

- **eGFR calculations**: Not present. Creatinine is displayed (reference range), not used to compute eGFR or adjust doses.
- **BSA-based dosing**: Not present. No weight × height calculation exists.
- **CYP enzyme interaction checking**: Not present.
- **Allergy/contraindication alerts**: Not present in codebase.
- **Prescription generation or modification**: Not present.
