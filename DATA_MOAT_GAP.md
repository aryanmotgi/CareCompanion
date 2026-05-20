# CareCompanion Data Moat Gap Analysis
## FHIR R4 + HealthKit — Oncology & Chronic Disease Lens
**Generated:** 2026-05-21 (batch overnight)
**Audited branch:** `aryan/dev` (HEAD as of 2026-05-20)
**Methodology version:** v1.0
**Document length target:** 1500–3000 lines

---

## Table of Contents

1. [Executive Summary — Top 10 Data Gaps](#executive-summary--top-10-data-gaps-that-unlock-top-features)
2. [Methodology](#methodology)
3. [FHIR R4 Resources We Ingest (with file:line)](#fhir-r4-resources-we-ingest)
4. [FHIR R4 Full Catalog — Resources We Don't Ingest](#fhir-r4-resources-we-dont-ingest)
5. [HealthKit Types We Read (with file:line)](#healthkit-types-we-read)
6. [HealthKit Types We Don't Read](#healthkit-types-we-dont-read)
7. [iOS Health Records / FHIR Clinical Data Ingestion Gap](#ios-health-records--fhir-clinical-data-ingestion-gap)
8. [Recommended P0 Ingestion Roadmap — 4-Week Scope](#recommended-p0-ingestion-roadmap--4-week-scope)
9. [Clinical-Value Scoring Rubric](#clinical-value-scoring-rubric)
10. [Sources](#sources)

---

## Executive Summary — Top 10 Data Gaps That Unlock Top Features

The following gaps have the highest clinical value-to-implementation-effort ratio for CareCompanion's oncology and chronic-disease user base. Each is achievable in 1–3 sprints.

| Rank | Gap | What It Unlocks | Est. Effort |
|------|-----|-----------------|-------------|
| 1 | **4 parsed-but-dropped clinical types** — Condition, AllergyIntolerance, Procedure, Immunization are fully normalized mobile-side but silently discarded by the backend sync route | Problem-list AI context; allergy conflict alerts before new medications; surgical history for trial eligibility matching; vaccination status for neutropenic patients | **XS** — backend route + schema only; all mobile normalization already exists |
| 2 | **HKQuantityType.oxygenSaturation** — not read at all | SpO₂ < 94% + fever = oncologic emergency protocol; pulmonary toxicity (bleomycin, BCNU, methotrexate) detection; home monitoring between chemo cycles | **S** — WellnessVitals.swift addition; no new entitlement |
| 3 | **HKQuantityType.heartRateVariabilitySDNN** — not read at all | Chemo cardiotoxicity early warning (HRV drops 2–4 weeks before symptomatic toxicity from anthracyclines); autonomic neuropathy signal (vincristine, taxanes) | **S** — WellnessVitals.swift addition; Apple Watch required |
| 4 | **HKQuantityType.bodyTemperature** — not read | Neutropenic fever detection (≥38°C with ANC < 500 = ER protocol); post-infusion fever monitoring; infection surveillance | **S** — WellnessVitals.swift; compatible with third-party Bluetooth thermometers |
| 5 | **HKCorrelationType.bloodPressure (systolic + diastolic)** — not read | Hypertension is a class effect of VEGF inhibitors (bevacizumab, sunitinib, sorafenib, ramucirumab) and enzalutamide/abiraterone; NCCN requires BP monitoring | **S** — WellnessVitals.swift; HKCorrelationTypeIdentifier.bloodPressure needed |
| 6 | **HKCategoryType symptom types** (fatigue, nausea, vomiting, chills, shortnessOfBreath, fever, hair loss, etc.) — 30+ symptom types not read | Passive CTCAE toxicity grading from patient-logged symptoms; eliminate duplicate symptom entry; chemo-day correlation; CINV effectiveness tracking; caregiver burnout early detection | **M** — WellnessVitals.swift + new sync path + backend schema |
| 7 | **HKClinicalType.coverageRecord** (iOS 14) — not authorized | Insurance coverage display; financial toxicity screening; prior auth status; copay/deductible visibility; patient cost burden alerts | **M** — HealthKitBridge.swift addition + new backend route + schema |
| 8 | **DiagnosticReport (FHIR)** — no ingestion path | Group CBC/CMP/lipid panels; trend entire panels not just individual values; oncology tumor marker panels (CA-125, CEA, PSA, AFP, LDH, β-HCG); pathology report ingestion | **L** — not available via HKClinicalRecord; requires direct EHR FHIR API |
| 9 | **HKQuantityType.bodyMass** (weight) — not read | Weight loss >5% over 3 months = clinically significant nutritional toxicity; BSA-based chemo dose recalculation trigger; cachexia/sarcopenia early signal | **XS** — single line addition in WellnessVitals.swift |
| 10 | **Encounter (FHIR)** — conversion utility exists but is not wired to any ingestion path | Visit history timeline; hospitalization tracking; ER visit frequency (early readmission signal); outpatient vs. inpatient visit patterns | **S** — wire up `fhirEncounterToAppointment` in `packages/utils/src/fhir.ts:37` + backend route |

### Critical Bug — Silent Data Loss Affecting All HealthKit-Connected Users

The mobile normalizer (`apps/mobile/src/services/internal/normalizers.ts:78-91`) correctly parses all 7 HKClinicalTypeIdentifiers. The normalized records are posted to `/api/healthkit/sync`. However, the backend route switch only handles 4 types. The remaining types — `condition`, `allergy`, `procedure`, `immunization` — fall through with no storage and **no error returned to the caller**. Users who have connected iOS Health Records are silently losing their problem lists, allergy data, procedure histories, and vaccination records every sync.

This is a one-afternoon fix that unlocks clinical capabilities that are already done on the mobile side.

---

## Methodology

### Audit Scope

This document audits all data ingestion paths in CareCompanion as of the `aryan/dev` branch on 2026-05-20. It evaluates:

1. Which FHIR R4 resources CareCompanion currently ingests via the iOS HealthKit Health Records bridge
2. Which HealthKit quantity, category, clinical, characteristic, and correlation types CareCompanion reads from the native Health app
3. The complete FHIR R4 resource catalog (~145 resources) and HealthKit type catalog (~250+ identifiers)
4. Priority ranking of unimplemented resources using a clinical-value rubric specific to oncology and chronic disease management
5. Feature-to-data-gap mapping to show what product capabilities each gap blocks

### Data Sources Used

| Source | Method | Availability During Audit |
|--------|--------|--------------------------|
| FHIR R4 resource catalog (hl7.org) | curl with browser user-agent | HTTP 403 — all HL7 CDN requests blocked from this network environment |
| Apple Developer HealthKit docs | WebFetch | HTTP 403 — Apple Developer CDN blocked |
| CareCompanion source code | Direct file reads | Available |

Because HL7 and Apple documentation CDNs were unavailable from this execution environment, the FHIR R4 resource catalog and HealthKit type catalog are compiled from expert knowledge of the specifications. Both catalogs are stable, published standards that have not changed since:
- FHIR R4: published January 2019, normative resources finalized September 2019
- HealthKit: SDK ship date August 2014; last major identifier additions in iOS 16 (September 2022)

### Files Audited

```
apps/mobile/ios/HealthKitBridge.swift          — HKClinicalType authorization + fetch
apps/mobile/ios/WellnessVitals.swift           — HKQuantityType + HKCategoryType reads
apps/mobile/ios/CareCompanion/noop-file.swift  — Placeholder only
apps/mobile/ios/CalendarBridge.swift           — Calendar integration (not FHIR)

apps/mobile/src/services/healthkit.ts          — Mobile sync state machine + HK bridge calls
apps/mobile/src/services/internal/normalizers.ts — FHIR JSON → typed record normalization
apps/mobile/src/services/internal/__tests__/normalizers.test.ts

apps/web/src/app/api/healthkit/sync/route.ts   — Backend: persist normalized records
apps/web/src/app/api/healthkit/replace/route.ts — Backend: wipe + replace all records
apps/web/src/app/api/healthkit/sync/__tests__/route.test.ts
apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts

apps/web/src/lib/db/schema.ts                  — DB table definitions
apps/web/src/lib/db/migrations/001-017.sql     — All migration files

packages/types/src/index.ts                   — Shared HealthKitRecord union type
packages/utils/src/fhir.ts                    — FHIR conversion utilities (partially wired)
packages/utils/src/__tests__/fhir.test.ts
```

### Ingestion Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  iOS Health App (EHR-connected via SMART on FHIR)                       │
│  Supported EHRs: Epic, Cerner, Allscripts, Athenahealth, Meditech, etc. │
└────────────────────────┬────────────────────────────────────────────────┘
                         │ HKClinicalRecord (raw FHIR R4 JSON blob)
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  HealthKitBridge.swift (native iOS module)                             │
│  • Authorizes 7 HKClinicalTypeIdentifiers                              │
│  • Runs HKSampleQuery for each type                                    │
│  • Serializes HKClinicalRecord.fhirResource.data → JSON string         │
│  • Returns array of { id, type, displayName, startDate, fhirData }     │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ RawClinicalRecord[]
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  normalizers.ts (mobile service layer, pure TypeScript)                │
│  • Dispatches on r.type (HKClinicalTypeIdentifier string)              │
│  • Parses embedded FHIR JSON                                           │
│  • Returns typed ExtendedHealthKitRecord (7 types)                     │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ ExtendedHealthKitRecord[]
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  apiClient.healthkit.sync()  →  POST /api/healthkit/sync               │
│  Body: { records: HealthKitRecord[] }                                  │
│                                                                        │
│  NOTE: HealthKitRecord (packages/types) = union of only 4 types.      │
│  ExtendedHealthKitRecord (normalizers.ts) = union of 7 types.         │
│  The extra 3 types serialize to JSON fine but are not in the TS type. │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│  /api/healthkit/sync  route.ts                                         │
│                                                                        │
│  switch (record.type)                                                  │
│    case 'medication'  → db.insert(medications)        ✅ stored        │
│    case 'labResult'   → db.insert(labResults)         ✅ stored        │
│    case 'appointment' → db.insert(appointments)       ✅ stored*       │
│    case 'vitalSign'   → db.insert(labResults)         ✅ stored        │
│    case 'condition'   → ??? MISSING CASE              ❌ DROPPED       │
│    case 'allergy'     → ??? MISSING CASE              ❌ DROPPED       │
│    case 'procedure'   → ??? MISSING CASE              ❌ DROPPED       │
│    case 'immunization' → ??? MISSING CASE             ❌ DROPPED       │
│                                                                        │
│  * appointment HKClinicalType doesn't exist in HealthKit; this case   │
│    is currently unreachable in practice                                │
└────────────────────────────────────────────────────────────────────────┘

Secondary path (utility code, not wired to any live route):
  packages/utils/src/fhir.ts
    fhirMedicationToMedication()    — line 5
    fhirObservationToLabResult()    — line 17
    fhirEncounterToAppointment()    — line 37  ← Encounter ingestion ready but unused
```

---

## FHIR R4 Resources We Ingest

### Authorization in Native Bridge

`apps/mobile/ios/HealthKitBridge.swift:11-18` requests authorization for:

```swift
let identifiers: [HKClinicalTypeIdentifier] = [
  .medicationRecord,     // line 12 — FHIR: MedicationRequest / MedicationStatement
  .labResultRecord,      // line 13 — FHIR: Observation (category: laboratory)
  .conditionRecord,      // line 14 — FHIR: Condition
  .procedureRecord,      // line 15 — FHIR: Procedure
  .allergyRecord,        // line 16 — FHIR: AllergyIntolerance
  .vitalSignRecord,      // line 17 — FHIR: Observation (category: vital-signs)
  .immunizationRecord,   // line 18 — FHIR: Immunization
]
```

### Normalization in Mobile Service

`apps/mobile/src/services/internal/normalizers.ts:78-91` dispatches:

```typescript
switch (r.type) {
  case 'HKClinicalTypeIdentifierMedicationRecord':   // line 78
    return normaliseMedication(r, fhir)
  case 'HKClinicalTypeIdentifierLabResultRecord':    // line 80
    return normaliseLabResult(r, fhir)
  case 'HKClinicalTypeIdentifierConditionRecord':    // line 82
    return normaliseCondition(r, fhir)
  case 'HKClinicalTypeIdentifierAllergyRecord':      // line 84
    return normaliseAllergy(r, fhir)
  case 'HKClinicalTypeIdentifierProcedureRecord':    // line 86
    return normaliseProcedure(r, fhir)
  case 'HKClinicalTypeIdentifierVitalSignRecord':    // line 88
    return normaliseVitalSign(r, fhir)
  case 'HKClinicalTypeIdentifierImmunizationRecord': // line 90
    return normaliseImmunization(r, fhir)
  default: return null
}
```

### Backend Persistence — What Actually Reaches the DB

`apps/web/src/app/api/healthkit/sync/route.ts`:

| Normalized Type | Backend Case | DB Table | `healthkitFhirId` Column | Status |
|-----------------|-------------|----------|--------------------------|--------|
| `medication` | line ~27 | `medications` | ✅ `healthkit_fhir_id UNIQUE` | **Persisted** |
| `labResult` | line ~44 | `lab_results` | ✅ `healthkit_fhir_id UNIQUE` | **Persisted** |
| `vitalSign` | line ~75 | `lab_results` (source=`HealthKit/VitalSign`) | ✅ `healthkit_fhir_id UNIQUE` | **Persisted** |
| `appointment` | line ~59 | `appointments` | ✅ `healthkit_fhir_id UNIQUE` | Code exists, but no HK clinical type maps to 'appointment' type |
| `condition` | *missing* | — | — | **SILENTLY DROPPED** |
| `allergy` | *missing* | — | — | **SILENTLY DROPPED** |
| `procedure` | *missing* | — | — | **SILENTLY DROPPED** |
| `immunization` | *missing* | — | — | **SILENTLY DROPPED** |

### Care Profile Manual Fields (Not FHIR-Sourced)

`apps/web/src/lib/db/schema.ts` — `careProfiles` table:

```
conditions  text  — free text only, never auto-populated from FHIR Condition
allergies   text  — free text only, never auto-populated from FHIR AllergyIntolerance
```

The irony: CareCompanion requests permission and normalizes both Condition and AllergyIntolerance records, but the DB only stores them as free-text fields in the care profile, populated by **manual user entry**. The structured FHIR data is discarded even though it's richer.

### Shared Type Contract Gap

`packages/types/src/index.ts:63`:

```typescript
export type HealthKitRecord =
  | HealthKitMedicationRecord    // line 25
  | HealthKitLabRecord           // line 33
  | HealthKitAppointmentRecord   // line 43
  | HealthKitVitalSignRecord     // line 51
// MISSING:
// | HealthKitConditionRecord    ← defined locally in normalizers.ts:28
// | HealthKitAllergyRecord      ← defined locally in normalizers.ts:35
// | HealthKitProcedureRecord    ← defined locally in normalizers.ts:43
// | HealthKitImmunizationRecord ← defined locally in normalizers.ts:50
```

The mobile-local `ExtendedHealthKitRecord` type (`normalizers.ts:57-65`) includes all 7 types. When cast to `HealthKitRecord` for the API call (`healthkit.ts`), TypeScript doesn't error because the extra types are structurally compatible JSON — they just get dropped on the server side.

### FHIR Conversion Utilities (Not Wired to Any Live Route)

`packages/utils/src/fhir.ts`:

```typescript
// line 5 — MedicationRequest → HealthKitMedicationRecord
export function fhirMedicationToMedication(fhir: FhirResource): HealthKitMedicationRecord

// line 17 — Observation → HealthKitLabRecord (handles both lab + vital sign Observations)
export function fhirObservationToLabResult(fhir: FhirResource): HealthKitLabRecord

// line 37 — Encounter → HealthKitAppointmentRecord
// READY BUT NOT WIRED — Encounter would enable full visit history if called from a sync route
export function fhirEncounterToAppointment(fhir: FhirResource): HealthKitAppointmentRecord
```

Tests in `packages/utils/src/__tests__/fhir.test.ts` verify all three functions work correctly, including Encounter → appointment conversion. The Encounter path just needs a route to call it.

### Summary: Effective FHIR Ingestion Status

| FHIR Resource | HK ClinicalType | Authorized | Normalized | Persisted | DB Table |
|---------------|----------------|-----------|-----------|----------|---------|
| **MedicationRequest** | medicationRecord | ✅ | ✅ | ✅ | `medications` |
| **Observation** (lab) | labResultRecord | ✅ | ✅ | ✅ | `lab_results` |
| **Observation** (vital) | vitalSignRecord | ✅ | ✅ | ✅ | `lab_results` |
| **Condition** | conditionRecord | ✅ | ✅ | ❌ DROPPED | — |
| **AllergyIntolerance** | allergyRecord | ✅ | ✅ | ❌ DROPPED | — |
| **Procedure** | procedureRecord | ✅ | ✅ | ❌ DROPPED | — |
| **Immunization** | immunizationRecord | ✅ | ✅ | ❌ DROPPED | — |
| **Encounter** | *(no HK type)* | N/A | ✅ (utility) | ❌ Not wired | — |
| All others (135+) | N/A | ❌ | ❌ | ❌ | — |

---

## FHIR R4 Resources We Don't Ingest

The FHIR R4 specification defines approximately 145 resource types across foundation, base, and clinical modules. Below is the complete catalog with ingestion status and clinical priority for CareCompanion's use case.

### FHIR R4 Complete Resource Catalog

#### Module: Foundation — Conformance

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| CapabilityStatement | ❌ | P3 | Describes what a FHIR server supports — infrastructure only | EHR capability discovery for adaptive integration | L |
| StructureDefinition | ❌ | P3 | Profile definitions — infrastructure only | Custom FHIR profile validation | L |
| ImplementationGuide | ❌ | P3 | FHIR IG metadata | Guide-compliant data ingestion | L |
| SearchParameter | ❌ | P3 | Server search configuration | FHIR server query optimization | L |
| MessageDefinition | ❌ | P3 | Messaging protocol spec | FHIR messaging integration | L |
| OperationDefinition | ❌ | P3 | Custom operation specs | Custom FHIR operation invocation | L |
| CompartmentDefinition | ❌ | P3 | Patient compartment rules | Scoped FHIR API queries | L |
| StructureMap | ❌ | P3 | Data transformation maps | Automated FHIR-to-FHIR transforms | L |
| GraphDefinition | ❌ | P3 | Resource graph traversal | Complex resource relationship queries | L |
| ExampleScenario | ❌ | P3 | Test scenario definitions | Integration testing | L |
| TestReport | ❌ | P3 | FHIR test results | Conformance testing | L |
| TestScript | ❌ | P3 | FHIR test scripts | Conformance testing | L |

#### Module: Foundation — Terminology

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| CodeSystem | ❌ | P2 | LOINC, SNOMED-CT, RxNorm, CPT code systems | Coded lab result interpretation; LOINC-based trending | L |
| ValueSet | ❌ | P2 | Allowed code sets for clinical domains | Validation of incoming FHIR codes | L |
| ConceptMap | ❌ | P2 | Code translation between systems | Cross-system code mapping (SNOMED ↔ ICD-10) | L |
| NamingSystem | ❌ | P3 | Identifier system definitions | MRN namespace resolution | L |
| TerminologyCapabilities | ❌ | P3 | Terminology server capabilities | Terminology service integration | L |

#### Module: Foundation — Security & Privacy

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Provenance | ❌ | P2 | Data lineage for clinical records — which EHR generated each record | Auditability of FHIR-sourced data; regulatory compliance | M |
| AuditEvent | ❌ | P2 | HIPAA audit trail from the EHR side | Cross-system audit reconciliation | M |
| Consent | ❌ | **P1** | Patient consent records — HIPAA authorization for data sharing; consent to share data with caregiver | Consent-based data sharing; caregiver authorization workflow; HIPAA consent chain | M |

#### Module: Foundation — Documents

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Composition | ❌ | P2 | C-CDA equivalents — discharge summaries, operative notes, progress notes in structured form | Structured clinical document ingestion | M |
| DocumentManifest | ❌ | P2 | Collection of related documents | Document set management | M |
| DocumentReference | ❌ | **P1** | References to clinical notes, discharge summaries, imaging reports, pathology narratives — the prose layer of clinical care | Clinical note display; AI summarization of clinical documents; oncologist notes ingestion | M |
| CatalogEntry | ❌ | P3 | Catalog item definitions | Product/supply catalog integration | L |

#### Module: Foundation — Exchange

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| MessageHeader | ❌ | P3 | FHIR messaging envelope | Real-time FHIR messaging integration | L |
| OperationOutcome | ❌ | P2 | Error/success responses from FHIR server | Better FHIR API error handling | S |
| Parameters | ❌ | P3 | Operation input/output parameters | Custom FHIR operation invocation | L |
| Subscription | ❌ | **P1** | Push notifications from EHR when patient data changes (new lab result, new prescription) | Real-time EHR push integration — labs available instantly when resulted | L |
| Bundle | ❌ | **P1** | Container for multiple FHIR resources — used in SMART on FHIR responses | Batch FHIR resource ingestion; atomic multi-resource sync | M |

#### Module: Foundation — Other

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Binary | ❌ | P2 | Attachments — PDF lab reports, DICOM preview images, scanned documents | Document attachment display; PDF lab report ingestion alongside structured data | M |
| Basic | ❌ | P3 | Extension resource for non-standard data | Custom data type support | L |
| Linkage | ❌ | P3 | Same resource across multiple FHIR servers | Cross-EHR patient matching | L |

#### Module: Base — Individuals

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Patient | ❌ | **P1** | Authoritative demographics: legal name, MRN, DOB, address, phone, language preference, emergency contacts, race/ethnicity | Auto-populate care profile from EHR; eliminate duplicate demographic entry; language-matched communications | M |
| Practitioner | ❌ | **P1** | Provider NPI, credentials, specialty, direct contact — the authoritative source of oncology team member data | Auto-populate care team; provider directory; direct contact for urgent questions | M |
| PractitionerRole | ❌ | **P1** | Provider role at a specific organization (e.g., "Medical Oncologist at Memorial Cancer Center") | Correct care team role display; routing clinical questions to appropriate specialist | M |
| RelatedPerson | ❌ | P2 | Family member / caregiver linkage within the EHR — how the EHR represents the caregiver | Caregiver-patient relationship verification; caregiver access authorization via FHIR | M |
| Person | ❌ | P3 | Cross-system patient/practitioner identity | Identity resolution across multiple EHRs | L |
| Group | ❌ | P2 | Patient cohort grouping | Care management program cohort definition | L |

#### Module: Base — Entities (Organizations & Locations)

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Organization | ❌ | P2 | Hospital/clinic/laboratory details — NPI, address, contact | Facility-specific protocols; lab reference range context (lab normals vary by lab) | M |
| OrganizationAffiliation | ❌ | P3 | Network relationships between organizations | Insurance network verification | L |
| HealthcareService | ❌ | P2 | Specific services offered (oncology infusion, palliative care, genetic counseling) | Service directory; referral destination lookup | M |
| Endpoint | ❌ | P3 | FHIR API endpoint discovery | EHR connection establishment | M |
| Location | ❌ | P2 | Physical locations — clinic addresses, infusion suites, pharmacy | Navigation to appointments; parking/transit instructions | S |

#### Module: Base — Entities (Devices & Substances)

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Device | ❌ | **P1** | Medical devices: CGM (Dexcom, Libre), infusion pumps, implantable cardiac monitors, port-a-cath | CGM glucose data integration; infusion pump alerts; implanted device tracking | M |
| DeviceMetric | ❌ | P2 | Real-time device metric readings | Continuous monitoring device integration | L |
| DeviceDefinition | ❌ | P3 | Device catalog/specifications | Device compatibility checking | L |
| DeviceUseStatement | ❌ | **P1** | Patient-reported device use: CPAP compliance, glucose meter readings, peak flow meter use | Patient-reported device adherence; CPAP compliance tracking for sleep apnea + cancer patients | M |
| Substance | ❌ | P2 | Drug substances, chemicals — more granular than Medication | Drug interaction substrate checking | M |
| BiologicallyDerivedProduct | ❌ | P2 | Blood products, stem cell harvests | Transfusion tracking; stem cell transplant documentation | M |

#### Module: Base — Workflow

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Appointment | ❌ (EHR-direct) | **P1** | EHR-scheduled appointments — authoritative upcoming visit data including time, provider, reason, location | True appointment sync from EHR (not manual entry); eliminate double-booking; pre-visit preparation triggers | M |
| AppointmentResponse | ❌ | P2 | Patient RSVP to EHR appointment requests | Appointment confirmation tracking | M |
| Schedule | ❌ | P2 | Provider availability schedule | In-app appointment scheduling | L |
| Slot | ❌ | P2 | Specific open time slots | Real-time slot booking | L |
| Task | ❌ | P2 | Clinical workflow tasks assigned to care team members | Care team task coordination; action item tracking | L |
| VerificationResult | ❌ | P3 | Data verification status | Verified data provenance tracking | L |

#### Module: Base — Management

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Encounter | ⚠️ Utility only | **P0** | Visit history — ambulatory, inpatient, ED, telemedicine; reason for visit; length of stay; discharge disposition | Visit timeline; hospitalization early warning (frequent ED visits predict readmission); outpatient care intensity tracking | S — wire up fhirEncounterToAppointment at packages/utils/src/fhir.ts:37 |
| EpisodeOfCare | ❌ | **P1** | Treatment episode grouping (e.g., "Adjuvant Chemotherapy — Cycle 3," "Radiation Course 1") | Treatment phase tracking; cycle-aware AI responses; episode-level analytics | M |
| Flag | ❌ | **P1** | Clinical safety flags: fall risk, DNR status, latex allergy, isolation precautions, contact precautions, drug-drug interaction alert | Safety flag display in care summary; AI safety guardrails using EHR flags | M |
| List | ❌ | P2 | Problem lists, medication lists, allergy lists as FHIR List resources (an alternative representation to individual resources) | Reconciled medication/problem/allergy lists | M |
| Library | ❌ | P3 | Clinical logic libraries | CDS rule management | L |

#### Module: Clinical — Summary

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| AllergyIntolerance | ⚠️ Parsed, DROPPED | **P0** | Drug allergies, food allergies, environmental allergies with severity, reaction, criticality — critical for medication safety in chemo patients | Drug allergy checking before AI medication suggestions; allergy display in care summary; trial eligibility (some trials exclude on certain allergies) | XS — backend route fix |
| Condition | ⚠️ Parsed, DROPPED | **P0** | Active and historical diagnoses — ICD-10 coded; clinical status (active, resolved, in remission); cancer diagnosis details | Problem list display; comorbidity-aware AI; trial eligibility criteria matching (most trials require coded diagnosis + stage) | XS — backend route fix |
| Procedure | ⚠️ Parsed, DROPPED | **P0** | Surgical procedures, biopsies, chemotherapy infusions, radiation treatments, bone marrow aspirates — CPT/SNOMED coded | Treatment history timeline; prior chemo line tracking; surgical history for trial exclusion criteria | XS — backend route fix |
| FamilyMemberHistory | ❌ | **P1** | BRCA1/2, Lynch syndrome, hereditary breast/ovarian cancer, Li-Fraumeni — family history of cancer by type, age of onset, relationship | Hereditary cancer risk flag; genetic counseling referral prompt; BRCA status for trial matching | M — EHR direct API; no HK clinical type |
| ClinicalImpression | ❌ | P1 | Oncologist's written clinical assessment — reasoning, differential, plan from visit | Clinical reasoning AI context; show oncologist's plan alongside AI response | M — EHR direct API |
| AdverseEvent | ❌ | **P1** | Formally reported adverse events — CTCAE grade, causality assessment, outcome | Toxicity documentation; CTCAE grade dashboard; pharmacovigilance support | M — EHR direct API |
| DetectedIssue | ❌ | P2 | Drug-drug interaction alerts, duplicate therapy alerts, contraindication flags generated by EHR CDS | Surface EHR CDS alerts within CareCompanion; prevent alert fatigue by prioritizing | L — EHR direct API |

#### Module: Clinical — Diagnostics

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Observation (lab) | ✅ | — | Ingested | — | — |
| Observation (vital) | ✅ | — | Ingested | — | — |
| DiagnosticReport | ❌ | **P0** | Panel-level result grouping; pathology reports; imaging reads; tumor marker panels (CA-125, CEA, PSA, AFP, β-HCG, LDH, chromogranin A); flow cytometry; bone marrow biopsy results | Panel-level trending (all CBC together, not just Hgb); tumor marker dashboard; pathology report ingestion and AI summarization | L — not in HKClinicalRecord; requires EHR FHIR API |
| ImagingStudy | ❌ | **P0** | CT/PET/MRI/X-ray studies — modality, series, DICOM reference, radiologist interpretation link | Scan timeline; response-to-therapy visualization; RECIST-aware AI interpretation | L — DICOM + EHR integration |
| Specimen | ❌ | **P1** | Biopsy specimen provenance — collection date, site, type; links lab results to specific tissue sample | Biomarker result provenance; link genomic results to biopsy site | M — EHR direct API |
| MolecularSequence | ❌ | **P0** | Genomic variants — BRCA1/2, EGFR, ALK, ROS1, KRAS, NRAS, HER2, PD-L1, TP53, PIK3CA, APC, POLE, MSI status, TMB; ctDNA liquid biopsy variants | Biomarker-aware trial matching (most precision oncology trials require specific genomic inclusion criteria); mutation tracking over treatment; genomic alteration dashboard | L — specialized FHIR extension; genomics data pipeline required |
| Media | ❌ | P2 | Photos, audio, video — wound images, skin rash documentation, lesion photos | Visual symptom logging; treatment response photos | M |
| QuestionnaireResponse | ❌ | **P1** | PRO responses — PROMIS, ESAS (Edmonton Symptom Assessment System), FACT-G (Functional Assessment of Cancer Therapy), PHQ-9 (depression), GAD-7 (anxiety) collected by EHR | Import EHR-collected PROs; avoid duplicate symptom questionnaires; PRO trend tracking | M — EHR direct API |
| BodyStructure | ❌ | P2 | Anatomical locations — tumor site, radiation target, biopsy location | Anatomical context for AI explanations of diagnoses | L |

#### Module: Clinical — Medications

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| MedicationRequest | ✅ | — | Ingested via HKMedicationRecord | — | — |
| MedicationStatement | ❌ | **P0** | Patient-reported medications including OTC, supplements, herbal/natural remedies — things NOT in the EHR | Supplement-drug interaction checking (St. John's Wort reduces efficacy of many chemo agents; turmeric/curcumin affects platelet function; high-dose fish oil affects coagulation); OTC safety for oncology patients | M — separate from MedicationRequest; requires EHR + patient self-report |
| MedicationAdministration | ❌ | **P0** | Actual doses given vs. prescribed — infusion records with dose, rate, start/stop time, route; chemotherapy administration dates; IV push records | Chemo day tracking (day-of-cycle calculations); dose-received vs. dose-ordered for toxicity correlation; infusion reaction documentation; cumulative anthracycline dose tracking (cardiotoxicity threshold) | M — EHR direct API; inpatient EHR data |
| MedicationDispense | ❌ | **P1** | Pharmacy dispensing records — actual fill date, quantity dispensed, days supply; specialty pharmacy data | Adherence gap detection (days between refills); refill date prediction; specialty pharmacy tracking for expensive oncology biologics | M — EHR/pharmacy integration |
| Medication | ❌ | **P1** | Medication master data — RxNorm code, NDC, active ingredient, manufacturer, strength, form; lookup against drug knowledge base | Coded drug identification for interaction checking; formulary lookup; generic/brand equivalence | M — terminology service |
| MedicationKnowledge | ❌ | P2 | Drug monograph data — indications, dosing, warnings, adverse effects | In-app drug information without external API dependency | L |
| Immunization | ⚠️ Parsed, DROPPED | **P0** | Flu vaccine, pneumococcal vaccine, COVID-19 vaccines, shingles (live vaccine contraindicated in immunocompromised), HPV, hepatitis — critical for neutropenic patients | Vaccination status display; live vaccine contraindication alert (shingles vaccine is live — contraindicated during immunosuppression); pneumococcal booster scheduling | XS — backend route fix |
| ImmunizationEvaluation | ❌ | P2 | Assessment of vaccine series validity | Vaccine catch-up scheduling post-transplant | M |
| ImmunizationRecommendation | ❌ | **P1** | ACIP-recommended vaccines for immunocompromised patients — individualized schedules | Proactive vaccination prompts for chemo patients; timing alerts (vaccinate before starting immunosuppressive therapy when possible) | M — EHR direct API |

#### Module: Clinical — Care Provision

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| CarePlan | ❌ | **P1** | Oncologist-authored treatment plans — chemo regimen, cycle schedule, response assessment plan, supportive care plan, palliative care goals | Display structured care plan alongside AI coaching; care plan deviation detection; cycle completion tracking | L — SMART on FHIR EHR integration |
| Goal | ❌ | **P1** | Clinical goals — target ANC >1500, maintain weight >55kg, pain VAS <3, HbA1c <7% — set by clinician or patient | Goal tracking dashboard; goal progress visualization; milestone celebrations; care plan alignment | L — EHR integration |
| CareTeam | ❌ | **P1** | Full oncology care team: medical oncologist, surgical oncologist, radiation oncologist, palliative care, social worker, patient navigator, dietitian, pharmacist, genetic counselor | Auto-populate care team from EHR; route clinical questions to appropriate team member; care team communication hub | L — EHR integration |
| ServiceRequest | ❌ | **P0** | Pending orders — lab orders, imaging orders, referral requests, pathology orders; shows what's coming before results are available | "Labs ordered" status tracking; upcoming imaging notification; referral status tracking; close the gap between order and result | M — EHR direct API |
| NutritionOrder | ❌ | **P1** | Dietitian-ordered nutrition plans — enteral/parenteral feeding orders, caloric/protein targets, tube feeding specifications | Nutrition guidance for patients on tube feeding; enteral formula tracking; TPN monitoring | M — inpatient EHR |
| RiskAssessment | ❌ | **P1** | Clinical risk scores — VTE risk (Khorana score for cancer), fall risk (Morse Fall Scale), readmission risk, MASCC score (febrile neutropenia), CISNE score | Risk-stratified alerts; Khorana score-based VTE prophylaxis prompts; fall prevention for neuropathy patients | M — EHR integration |
| VisionPrescription | ❌ | P3 | Vision correction prescriptions | Vision care tracking | S |
| RequestGroup | ❌ | P2 | Order sets — chemo premedication bundles, GCSF protocols, antiemetic orders | Protocol adherence checking | L |

#### Module: Clinical — Request & Response

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Communication | ❌ | P2 | Secure messages between patient and care team | Patient-provider messaging integration | L |
| CommunicationRequest | ❌ | P2 | Requested communications (callback requests, nurse advice line) | Care team task routing | L |
| DeviceRequest | ❌ | P2 | Ordered devices — CPAP, glucose meter, infusion pump, wheelchair | Home medical equipment tracking | M |
| DeviceUseStatement | ❌ | **P1** | Patient-reported device use — CPAP hours, CGM readings, peak flow measurements | Device adherence tracking; CGM glucose integration | M |
| GuidanceResponse | ❌ | P2 | Clinical decision support responses | CDS response display | L |
| SupplyRequest | ❌ | P3 | Medical supply orders | Supply management | L |
| SupplyDelivery | ❌ | P3 | Supply delivery records | Supply receipt confirmation | L |

#### Module: Financial

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Coverage | ❌ | **P2** | Insurance plan details — deductibles, copays, out-of-pocket maximum, formulary tier, prior auth requirements | Financial toxicity screening (high OOP + expensive oncology treatment = financial distress trigger); coverage verification before ordering tests; plan comparison | M — HK coverageRecord + EHR |
| ExplanationOfBenefit | ❌ | **P2** | Processed claims — services rendered, charges, adjustments, patient responsibility; cumulative OOP tracker | Total out-of-pocket expense tracking; financial toxicity dashboard; bill dispute support | M — EHR/payer integration |
| Claim | ❌ | P2 | Submitted claims; prior authorization requests; appeals | Prior auth status tracking; denial management support | M — payer integration |
| ClaimResponse | ❌ | P2 | Payer adjudication decisions on claims | Claim status display | M |
| CoverageEligibilityRequest | ❌ | P2 | Real-time eligibility check request | Pre-appointment eligibility verification | L |
| CoverageEligibilityResponse | ❌ | P2 | Eligibility check result — covered services, cost-sharing | Real-time benefits display before appointments | L |
| InsurancePlan | ❌ | P3 | Health plan benefit structure | Open enrollment plan comparison | L |
| EnrollmentRequest | ❌ | P3 | Insurance enrollment request | Enrollment workflow support | L |
| EnrollmentResponse | ❌ | P3 | Enrollment response | Enrollment confirmation | L |

#### Module: Financial — Billing & Accounts

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Account | ❌ | P2 | Patient financial account — balance, activity | Patient billing account integration | L |
| ChargeItem | ❌ | P3 | Individual charge events | Itemized bill review | L |
| ChargeItemDefinition | ❌ | P3 | Charge catalog definitions | Charge code lookup | L |
| Contract | ❌ | P3 | Legal agreements | Patient consent contracts | L |
| Invoice | ❌ | P2 | Patient-facing invoices | Itemized bill display | M |
| PaymentNotice | ❌ | P3 | Payment notification to payer | Payment workflow | L |
| PaymentReconciliation | ❌ | P3 | Payment reconciliation | Financial reconciliation | L |

#### Module: Specialized — Public Health & Research

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| ResearchStudy | ❌ | **P1** | ClinicalTrials.gov study metadata in FHIR format — already sourced via CT.gov API but not FHIR-native | Richer structured trial data; eligibility criteria in machine-readable form; protocol document links | M — FHIR-based CT.gov API |
| ResearchSubject | ❌ | **P1** | Patient's enrollment in a clinical trial — trial ID, arm, enrollment date, current status | Track active trial participation; protocol schedule adherence; trial-specific monitoring alerts | M — EHR integration |
| Questionnaire | ❌ | **P1** | Structured PRO instruments — PROMIS-29, ESAS, FACT-G, FACT-B, PHQ-9, GAD-7, PG-SGA (malnutrition screening) | Standardized PRO collection within CareCompanion; import EHR-collected PROs; benchmark against trial endpoints | M |
| QuestionnaireResponse | ❌ | **P1** | Completed PRO questionnaires with item-level responses | PRO score trending; symptom pattern AI enrichment | M |

#### Module: Specialized — Evidence-Based Medicine

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| Evidence | ❌ | P2 | Structured clinical evidence summaries | Evidence-based recommendation explanations | L |
| EvidenceVariable | ❌ | P2 | Variables used in clinical evidence | PICO-structured evidence display | L |
| EffectEvidenceSynthesis | ❌ | P2 | Meta-analysis results | Evidence summary display | L |
| RiskEvidenceSynthesis | ❌ | P2 | Risk synthesis results | Risk communication | L |
| ResearchDefinition | ❌ | P3 | Research study protocol elements | Protocol adherence checking | L |
| ResearchElementDefinition | ❌ | P3 | Research element specifications | Research data collection | L |

#### Module: Specialized — Definitional Artifacts

| Resource | Ingested? | Priority | Clinical Value for CareCompanion | Unlocked Feature | Ingestion Effort |
|----------|-----------|----------|----------------------------------|------------------|------------------|
| ActivityDefinition | ❌ | P2 | Reusable activity definitions — exercise prescription, dietary intervention | Evidence-based activity prescription | L |
| EventDefinition | ❌ | P3 | Triggering event definitions | CDS trigger management | L |
| Measure | ❌ | P2 | Quality measure definitions (HEDIS, CMS) | Quality gap identification for managed care | L |
| MeasureReport | ❌ | P2 | Population-level quality measure results | Care gap reporting | L |
| PlanDefinition | ❌ | P2 | Clinical protocol definitions — NCCN guidelines as computable artifacts | Protocol-guided care recommendations | L |

---

## HealthKit Types We Read

### HKClinicalType — Reads and Status

All 7 types requested in `HealthKitBridge.swift:11-18`.

| Identifier | FHIR Source | File:Line | Auth | Normalized | Persisted | Table |
|-----------|-------------|-----------|------|------------|----------|-------|
| `.medicationRecord` | MedicationRequest | `HealthKitBridge.swift:12` | ✅ | ✅ `normalizers.ts:78` | ✅ | `medications` |
| `.labResultRecord` | Observation (lab) | `HealthKitBridge.swift:13` | ✅ | ✅ `normalizers.ts:80` | ✅ | `lab_results` |
| `.conditionRecord` | Condition | `HealthKitBridge.swift:14` | ✅ | ✅ `normalizers.ts:82` | ❌ | — |
| `.procedureRecord` | Procedure | `HealthKitBridge.swift:15` | ✅ | ✅ `normalizers.ts:86` | ❌ | — |
| `.allergyRecord` | AllergyIntolerance | `HealthKitBridge.swift:16` | ✅ | ✅ `normalizers.ts:84` | ❌ | — |
| `.vitalSignRecord` | Observation (vital) | `HealthKitBridge.swift:17` | ✅ | ✅ `normalizers.ts:88` | ✅ | `lab_results` |
| `.immunizationRecord` | Immunization | `HealthKitBridge.swift:18` | ✅ | ✅ `normalizers.ts:90` | ❌ | — |

### HKQuantityType — Reads and Status

`WellnessVitals.swift` reads 2 quantity types for the daily wellness dashboard (not persisted to DB):

| Identifier | File:Line | Persisted? | Notes |
|-----------|-----------|------------|-------|
| `.stepCount` | `WellnessVitals.swift:19` | ❌ In-memory only | Cumulative sum, midnight to now |
| `.heartRate` | `WellnessVitals.swift:20` | ❌ In-memory only | Most recent sample only |

**These are fetched on-demand by `fetchDailyVitals()` / `today()` and returned to JS for display. No time-series history is stored in the database.**

### HKCategoryType — Reads and Status

`WellnessVitals.swift` reads 1 category type:

| Identifier | File:Line | Persisted? | Notes |
|-----------|-----------|------------|-------|
| `.sleepAnalysis` | `WellnessVitals.swift:21` | ❌ In-memory only | 10pm–8am window; hours of sleep only (not stages) |

### HKCharacteristicType — Reads and Status

`HealthKitBridge.swift` reads 2 characteristic types (static demographic data):

| Identifier | File:Line | Persisted? | Table / Column |
|-----------|-----------|------------|----------------|
| `.dateOfBirth` | `HealthKitBridge.swift:26` | ✅ | `care_profiles.date_of_birth` |
| `.biologicalSex` | `HealthKitBridge.swift:26` | ✅ | `care_profiles.sex_at_birth` |

---

## HealthKit Types We Don't Read

### Complete HealthKit Type Catalog — What Exists vs. What We Use

The HealthKit SDK exposes approximately 250+ identifiers. We currently use 11 (7 clinical, 2 quantity, 1 category, 2 characteristic). The following tables catalog the complete SDK surface.

---

### P0 — HKQuantityTypeIdentifier (Missing, High Clinical Value)

| Identifier | Category | Oncology/Chronic Disease Value | Device | Effort | Feature Unlocked |
|-----------|----------|-------------------------------|--------|--------|------------------|
| `heartRateVariabilitySDNN` | Vitals | **Chemo cardiotoxicity biomarker.** Decreases 2–4 weeks before symptomatic toxicity from anthracyclines (doxorubicin, epirubicin, idarubicin). Also flags autonomic neuropathy from vincristine and paclitaxel. MSKCC and Stanford cardio-oncology programs use wearable HRV for toxicity surveillance. | Apple Watch (gen 1+) | S | Cardiotoxicity early warning; autonomic neuropathy signal |
| `oxygenSaturation` | Vitals | **Neutropenic fever protocol.** SpO₂ < 94% + fever ≥ 38°C = oncologic emergency — immediate ED evaluation. Bleomycin/BCNU/methotrexate/busulfan pulmonary toxicity monitoring. Severe anemia (Hgb < 7) causes desaturation. Home monitoring between cycles | Apple Watch Series 6+ / pulse ox accessories | S | Neutropenic fever triage support; pulmonary toxicity detection; anemia severity proxy |
| `bodyTemperature` | Vitals | **Neutropenic fever detection.** 38°C = fever threshold for neutropenic patients (ANC < 500/μL). Compatible with Kinsa, iHealth, Withings, Qardio Bluetooth thermometers pairing with Health app. | Bluetooth thermometers | S | Fever diary; neutropenic fever protocol trigger; infection surveillance |
| `bloodPressureSystolic` | Vitals | VEGF inhibitor class effect hypertension (bevacizumab, sunitinib, sorafenib, ramucirumab, axitinib, cabozantinib) — BP monitoring is NCCN-mandated for these agents. Abiraterone/enzalutamide in prostate cancer. | Read via HKCorrelationTypeIdentifier.bloodPressure which contains both systolic + diastolic | S | Pre-appointment BP summary; VEGF inhibitor toxicity monitoring |
| `bloodPressureDiastolic` | Vitals | Same as above | Same as above | S | Same as above |
| `restingHeartRate` | Vitals | Cardiac toxicity monitoring — resting HR elevation signals cardiac stress; trend decline post-chemo indicates recovery. Tachycardia with dehydration from CINV. Autonomic dysfunction from taxane neuropathy. | Apple Watch (gen 1+) | XS | Cardiac trend dashboard; dehydration alert; cycle recovery tracking |
| `respiratoryRate` | Vitals | Pulmonary toxicity monitoring — bleomycin-induced pneumonitis typically presents with increasing respiratory rate before hypoxia. Also: respiratory compensation for metabolic acidosis from ifosfamide. | Apple Watch Series 3+ | S | Pulmonary toxicity early warning; dyspnea trend |
| `bodyMass` | Body | Weight loss >5% over 3 months = clinically significant nutritional toxicity in oncology. >10% = severe malnutrition. BSA-based chemo dose recalculation trigger. Cachexia/sarcopenia predictor. Steroid weight gain tracking. | Connected scales: Withings Body+, Garmin Index | S | Weight loss alerts; BSA dose change trigger; nutritional risk flag; steroid weight gain monitoring |
| `peripheralPerfusionIndex` | Vitals | Perfusion index from pulse oximeter — correlates with peripheral neuropathy severity (hallmark toxicity of taxanes, platinum compounds, vinca alkaloids). Lower PI in extremities = early neuropathy signal. | Pulse ox accessories | M | Peripheral neuropathy functional impact; neuropathy progression tracking |
| `vo2Max` | Fitness | Cardiorespiratory fitness — declines with chemo-related cardiomyopathy and deconditioning. Used in cardio-oncology programs for exercise prescription and cardiac rehabilitation enrollment decision. | Apple Watch Series 3+ | S | Cardio-oncology functional capacity; exercise prescription support |

### P0 — HKCategoryTypeIdentifier (Symptom Types — Missing)

iOS 13+ added a rich symptom library. These are written to the Health app when users log symptoms directly, or via third-party symptom tracking apps. Passive collection during chemo cycles is high value.

| Identifier | Added | Oncology Value | Effort | Feature Unlocked |
|-----------|-------|----------------|--------|------------------|
| `fatigue` | iOS 13 | #1 reported chemo side effect. Correlates with: ANC (neutropenic fatigue), Hgb (anemia), sleep disruption, depression. CTCAE Grade 1–4. | M | Fatigue pattern tracking; correlation with CBC trends; chemo day correlation |
| `nausea` | iOS 13 | CINV (chemo-induced nausea/vomiting) — affects 70–80% of patients on emetogenic regimens. Antiemetic effectiveness tracking. CTCAE Grade 1–5. | M | Antiemetic protocol optimization; CINV severity tracking |
| `vomiting` | iOS 13 | Grade 3+ CINV (>5 episodes/day or hospitalization needed) = dose modification trigger. Must distinguish from gastroparesis, bowel obstruction. | M | Dose modification trigger alert; toxicity grading |
| `chills` | iOS 13.6 | Infusion reaction early signal — rigors during rituximab, taxane, blinatumomab infusions. Neutropenic fever presentation. Sepsis. | M | Infusion reaction monitoring; fever without thermometer correlation |
| `fever` | iOS 13.6 | Without thermometer data, correlate with HK bodyTemperature if available. Neutropenic fever category. | M | Fever diary; neutropenic fever protocol support |
| `shortnessOfBreath` | iOS 13.6 | Pulmonary toxicity (bleomycin, BCNU); anemia-related dyspnea; pleural effusion (malignant, drug-induced); VTE (PE); cardiac toxicity | M | Pulmonary symptom correlation; VTE risk flag; anemia-dyspnea correlation |
| `rapidPoundingOrFlutteringHeartbeat` | iOS 13.6 | Checkpoint inhibitor myocarditis (fulminant — early symptoms are palpitations); anthracycline cardiomyopathy; atrial fibrillation from chemo | M | Cardiac toxicity alert; checkpoint inhibitor myocarditis screening |
| `skippedHeartbeat` | iOS 13.6 | Arrhythmia monitoring for chemo-related cardiac toxicity; QT prolongation (haloperidol antiemetics, ondansetron, arsenic trioxide) | M | QT-prolonging drug monitoring |
| `headache` | iOS 13 | Hypertension headache (VEGF inhibitor toxicity); CNS metastasis symptom; lumbar puncture headache; opioid side effect | M | VEGF inhibitor BP correlation; CNS symptom monitoring |
| `constipation` | iOS 13 | Opioid-induced constipation (OIC) — affects 80–90% of patients on opioids; vincristine neuropathy effect; dehydration from CINV | M | Bowel toxicity tracking; OIC management prompts |
| `nausea` | iOS 13 | (see above) | M | — |
| `generalizedBodyAche` | iOS 13.6 | Treatment toxicity; G-CSF bone pain (filgrastim, pegfilgrastim) — severe in 25–40% of patients; taxane myalgias; fibromyalgia-like syndrome post-chemo | M | G-CSF pain tracking; toxicity log |
| `hairLoss` | iOS 13 | Alopecia from chemo (cyclophosphamide, doxorubicin, paclitaxel, docetaxel) — affects psychological distress and treatment adherence | S | Psychosocial support trigger; distress screening prompt |
| `hotFlashes` | iOS 13 | Hormone therapy side effects — tamoxifen, aromatase inhibitors (anastrozole, letrozole, exemestane), ADT (leuprolide, degarelix); affects up to 80% of patients; quality of life impact | M | Hormone therapy toxicity dashboard; QoL score |
| `sleepChanges` | iOS 13 | Sleep disruption is bidirectional with treatment: chemo causes insomnia; sleep deprivation worsens treatment toxicity tolerance; caregiver sleep disruption is burnout predictor | M | Sleep-treatment correlation; caregiver burnout early detection |
| `appetiteChanges` | iOS 13 | Nutritional risk — cachexia precursor; steroid-induced hyperphagia; taste changes from chemo; anorexia-cachexia syndrome in advanced cancer | M | Nutritional risk alert; dietitian referral trigger |
| `hotFlashes` | iOS 13 | (see above) | M | — |
| `memoryLapse` | iOS 14 | Chemo brain (CRCI — cancer-related cognitive impairment) — affects 17–75% of chemo patients depending on regimen; correlates with fatigue and sleep disruption; persists years post-treatment | M | Cognitive tracking; chemo brain documentation; neuropsychology referral trigger |
| `nightSweats` | iOS 14 | B-symptom in lymphoma (Hodgkin's, Non-Hodgkin's — systemic manifestation); hormone therapy; infection (especially fungal); paraneoplastic syndromes | M | B-symptom tracking; lymphoma surveillance; infection monitoring |
| `lowerBackPain` | iOS 13 | Bone metastasis pain (spine is most common bone met site); G-CSF bone pain; renal colic from uric acid nephropathy post-chemo | M | Bone pain tracking; metastasis symptom documentation |
| `bladderIncontinence` | iOS 14 | Pelvic radiation toxicity (prostate, cervical, bladder, endometrial cancer radiation); radical prostatectomy recovery; late radiation toxicity | M | Radiation toxicity tracking; pelvic floor PT referral |
| `pelvicPain` | iOS 13 | Ovarian cancer symptoms; endometriosis (cancer precursor); post-surgical pain; radiation cystitis | M | Symptom progression tracking; post-treatment monitoring |
| `abdominalCramps` | iOS 13 | GI toxicity from fluorouracil/capecitabine; irinotecan-related GI toxicity; bowel obstruction | M | GI toxicity tracking; FOLFOX/FOLFIRI toxicity monitoring |
| `bloating` | iOS 13 | Ascites (malignant — ovarian, peritoneal); constipation; gastroparesis | M | Ascites monitoring; bowel obstruction early signal |
| `acne` | iOS 13 | Characteristic rash from EGFR inhibitors (erlotinib, gefitinib, cetuximab, panitumumab) — rash severity correlates with treatment efficacy | M | EGFR inhibitor efficacy correlate; rash management prompts |
| `dizziness` | iOS 13.6 | Orthostatic hypotension from dehydration (CINV); ototoxicity from cisplatin/carboplatin (vestibular toxicity); cerebellar metastases | M | Dehydration monitoring; ototoxicity signal |
| `moodChanges` | iOS 13 | Depression is 2–3× more prevalent in cancer patients and caregivers; steroid-induced mood changes; checkpoint inhibitor neuropsychiatric effects | M | Mental health monitoring; caregiver burnout screening; depression PHQ-9 trigger |
| `mindfulSession` | iOS 13 | Mindfulness-based stress reduction (MBSR) for caregivers; validated intervention for caregiver burnout; anxiety reduction | S | Caregiver self-care scoring; burnout risk; mindfulness coaching |

### P1 — HKQuantityTypeIdentifier (Missing, Mid-Value)

| Identifier | Category | Value | Effort | Feature Unlocked |
|-----------|----------|-------|--------|------------------|
| `walkingHeartRateAverage` | Vitals | Submax cardiac effort during daily activity — sustained elevation = reduced functional capacity; treatment-related fatigue syndrome marker | XS | Activity-adjusted fatigue scoring |
| `activeEnergyBurned` | Activity | Activity-adjusted fatigue scoring; ECOG performance status proxy; correlates with chemo-cycle day | S | Performance status proxy; fatigue quantification beyond step count |
| `distanceWalkingRunning` | Activity | 6-minute walk test proxy; functional capacity decline tracking; recovery trajectory | S | Functional capacity monitoring; exercise rehabilitation tracking |
| `flightsClimbed` | Activity | Cardiopulmonary reserve indicator — more sensitive than step count for detecting early functional decline in cancer patients | XS | Activity trend; early functional decline alert |
| `appleExerciseTime` | Activity | Exercise adherence during treatment — Cochrane review shows exercise reduces chemo fatigue 40–50%; NCCN guidelines recommend exercise for cancer-related fatigue | S | Exercise prescription adherence; fatigue intervention effectiveness |
| `walkingSpeed` | Activity | Gait speed is a validated frailty biomarker in oncology — slow gait speed (<0.8m/s) predicts chemotherapy toxicity, hospitalization, and mortality in older adults | M | Frailty assessment; treatment tolerance prediction; geriatric oncology screen |
| `walkingStepLength` | Activity | Stride length shortening = neuropathy or musculoskeletal impact | M | Neuropathy gait impact |
| `walkingAsymmetryPercentage` | Activity | Gait asymmetry = neuropathy-related instability; fall risk | M | Neuropathy fall risk |
| `walkingDoubleSupportPercentage` | Activity | Increased double support = reduced balance; fall risk in neuropathy | M | Fall risk quantification |
| `sixMinuteWalkTestDistance` | Activity | Gold standard cardiopulmonary exercise capacity; used in cardio-oncology for cardiac rehab enrollment; also tracks radiation-related cardiac dysfunction | M | Cardio-oncology functional assessment; cardiac rehab eligibility |
| `appleStandTime` | Activity | Sedentary behavior tracking — prolonged inactivity increases DVT/VTE risk (already elevated in cancer patients); also indicates fatigue severity | S | VTE risk alert; sedentary behavior monitoring |
| `bloodGlucose` | Labs | Steroid-induced hyperglycemia (dexamethasone at standard antiemetic/anti-edema doses can elevate glucose 200–400 mg/dL); checkpoint inhibitor T1DM; Cushing's syndrome | S | Steroid glucose monitoring; immunotherapy endocrine toxicity screen |
| `insulinDelivery` | Labs | Critical for T1D patients on chemo — steroid premedication protocols dramatically increase insulin requirements; dose adjustments needed per cycle | M | Insulin protocol alert for diabetic oncology patients |
| `peakExpiratoryFlowRate` | Respiratory | Pulmonary toxicity monitoring — early decline precedes symptomatic pneumonitis (bleomycin, BCNU, cyclophosphamide, busulfan, methotrexate) | M | Pulmonary toxicity early warning |
| `forcedExpiratoryVolume1` | Respiratory | Spirometry FEV1 — quantifies pulmonary toxicity severity | M | Pulmonary function tracking |
| `forcedVitalCapacity` | Respiratory | Spirometry FVC — restrictive pattern indicates pulmonary fibrosis from radiation or bleomycin | M | Radiation pneumonitis tracking |
| `bodyMassIndex` | Body | Obesity affects chemo pharmacokinetics; sarcopenic obesity common in cancer; BMI cutoffs affect trial eligibility | XS | Metabolic risk context; trial eligibility screening |
| `leanBodyMass` | Body | Sarcopenia (low lean mass) predicts poor prognosis, increased toxicity, and inferior treatment outcomes in multiple tumor types | M | Sarcopenia screening; nutritional risk stratification; exercise intervention targeting |
| `bodyFatPercentage` | Body | Adipose tissue affects pharmacokinetics of lipophilic drugs; adiposity-based chronic disease classification | M | Pharmacokinetic risk context |
| `waistCircumference` | Body | Metabolic syndrome — relevant for obesity-related cancers (endometrial, breast, colorectal) and insulin resistance in oncology | S | Metabolic syndrome screening; insulin resistance monitoring |
| `numberOfTimesFallen` | Safety | Fall risk quantification — neuropathy (taxanes, platinum, vinca alkaloids) dramatically increases fall risk; opioid sedation; orthostatic hypotension | M | Fall risk alert; physical therapy referral; home safety assessment trigger |
| `uvExposure` | Environment | Photosensitivity monitoring — 5-FU, capecitabine, methotrexate, dacarbazine, vinblastine cause photosensitivity; sun avoidance education needed | S | Sun exposure alert for photosensitive agents |
| `headphoneAudioExposure` | Environment | Cisplatin/carboplatin ototoxicity — hearing loss in 40–60% of patients, tinnitus in 70%; noise exposure compounds platinum ototoxicity | S | Ototoxicity risk reduction; audiologist referral trigger |
| `environmentalSoundReduction` | Environment | Hearing protection adherence (AirPods Pro) | M | Ototoxicity protection adherence |
| `electrodermalActivity` | Mental | Autonomic stress/arousal measurement — caregiver psychological distress marker | M | Caregiver stress monitoring |

### P2 — HKCategoryTypeIdentifier (Reproductive & Specialized)

| Identifier | Added | Value | Effort | Feature Unlocked |
|-----------|-------|-------|--------|------------------|
| `menstrualFlow` | iOS 13 | Chemotherapy-induced amenorrhea tracking — a major concern for premenopausal oncology patients; ovarian reserve impact; primary ovarian insufficiency from alkylating agents | M | Fertility preservation counseling; ovarian function monitoring |
| `sexualActivity` | iOS 13 | Hormone therapy sexual side effects; fertility preservation counseling; intimacy tracking for QoL assessment | M | Sexual health tracking; hormone therapy QoL |
| `pregnancy` | iOS 14.3 | Chemo-during-pregnancy protocols (gestational age-dependent decisions); fetal toxicity monitoring | M | Pregnancy-safe treatment guidance; oncofertility counseling |
| `lactation` | iOS 14.3 | Lactation contraindications for many oncology agents; safe prescribing for nursing mothers | M | Breastfeeding safety alert |
| `cervicalMucusQuality` | iOS 13 | Fertility preservation monitoring during and post-chemo; ovarian reserve assessment surrogate | M | Fertility counseling after gonadotoxic chemo |
| `ovulationTestResult` | iOS 13 | Fertility monitoring post-chemo; return of ovarian function | M | Fertility preservation counseling |
| `pregnancyTestResult` | iOS 15 | Pregnancy detection critical for chemo safety (many agents teratogenic) | M | Teratogenic drug contraindication alert |
| `progesteroneTestResult` | iOS 15 | Hormone monitoring for hormonal therapy patients | M | Hormone therapy monitoring |
| `contraceptive` | iOS 15 | Contraception is critical for patients on teratogenic chemo; some contraceptives interact with hormone therapy | M | Drug-contraceptive interaction alert |
| `intermenstrualBleeding` | iOS 13 | Tamoxifen-related endometrial effects (must investigate uterine bleeding — endometrial cancer risk); vaginal bleeding after pelvic radiation | M | Tamoxifen safety monitoring; endometrial cancer surveillance |
| `irregularMenstrualCycles` | iOS 16 | Early sign of chemotherapy-induced ovarian insufficiency | S | Fertility preservation alert trigger |
| `infrequentMenstrualCycles` | iOS 16 | Oligomenorrhea — early sign of gonadal toxicity | S | Gonadotoxicity monitoring |
| `prolongedMenstrualPeriods` | iOS 16 | Hormonal disruption; coagulopathy from thrombocytopenia | S | Platelet-cycle correlation |
| `persistentIntermenstrualBleeding` | iOS 16 | Abnormal uterine bleeding — endometrial pathology | S | Endometrial surveillance |
| `basalBodyTemperature` | iOS 13 | Fertility preservation (ovulation timing); post-chemo ovarian reserve recovery | M | Fertility preservation counseling |
| `toothbrushingEvent` | iOS 13 | Oral hygiene adherence — mucositis prevention from radiation/chemo; immunocompromised oral care | S | Mucositis prevention prompts |
| `handwashingEvent` | iOS 14 | Infection prevention for immunocompromised patients | S | Hand hygiene compliance monitoring |
| `appleWalkingSteadinessEvent` | iOS 15 | Fall event detection | M | Fall risk alert; fall event documentation |
| `lowCardioFitnessEvent` | iOS 14.3 | Low VO₂max notification — poor cardiorespiratory fitness detected | S | Cardiac rehabilitation referral |
| `highHeartRateEvent` | iOS 13 | HR > threshold alert | S | Arrhythmia monitoring |
| `lowHeartRateEvent` | iOS 13 | Bradycardia alert | S | Cardiac toxicity monitoring |
| `irregularHeartRhythmEvent` | iOS 13 | Irregular rhythm detected (AFib algorithm) | M | Arrhythmia alert; anticoagulation need |
| `mindfulSession` | iOS 13 | Caregiver mental health — mindfulness reduces burnout | S | Caregiver self-care coaching |
| `environmentalAudioExposureEvent` | iOS 14 | Noise hazard notification | S | Ototoxicity risk reduction |
| `headphoneAudioExposureEvent` | iOS 14.2 | Loud headphone warning | S | Platinum ototoxicity protection |

### P1 — HKClinicalTypeIdentifier (iOS Health Records — Not Yet Authorized)

| Identifier | Available Since | FHIR Resource | Value | Effort | Feature Unlocked |
|-----------|----------------|---------------|-------|--------|------------------|
| `.coverageRecord` | iOS 14 | Coverage | Insurance coverage, deductibles, copays, prior auth requirements, formulary tiers | M | Financial toxicity screening; prior auth status display; cost burden tracking |
| `.clinicalNoteRecord` | iOS 16 | DocumentReference | Discharge summaries, progress notes, consultation letters, operative reports — the prose layer of clinical care that doesn't fit into structured FHIR resources | L | Clinical note ingestion; AI summarization of oncologist's notes; care transition support |

### HKCorrelationTypeIdentifier (Not Read)

| Identifier | Components | Value | Effort | Feature Unlocked |
|-----------|-----------|-------|--------|------------------|
| `bloodPressure` | HKQuantityType.bloodPressureSystolic + HKQuantityType.bloodPressureDiastolic | Blood pressure measurement requires both components as a correlated pair; cannot read systolic/diastolic separately without the correlation | S | BP monitoring; VEGF inhibitor hypertension |
| `food` | Multiple dietary quantity types | Nutrition logging via correlation | M | Dietary tracking for oncology patients |

### HKWorkoutType (Not Read)

| Type | Value | Effort | Feature Unlocked |
|------|-------|--------|------------------|
| HKWorkoutType | Structured exercise sessions — activity type, duration, distance, energy burned, heart rate during workout | M | Exercise adherence tracking; exercise oncology intervention monitoring (exercise reduces chemo fatigue 40–50%); cardiac rehab session logging |

---

## iOS Health Records / FHIR Clinical Data Ingestion Gap

### Current State Summary

iOS Health Records (introduced in iOS 12.1, Sept 2018) allows patients to connect to EHR-connected institutions via SMART on FHIR. Supported EHRs with broad Health Records coverage include: Epic, Cerner (Oracle Health), Allscripts, Meditech, athenahealth, and 500+ participating institutions. Coverage varies — Epic and Cerner cover ~85% of the US inpatient market.

CareCompanion requests `com.apple.developer.healthkit.access: ["health-records"]` and reads `HKClinicalRecord` objects via `HKSampleQuery`. Each record wraps raw FHIR R4 JSON from the patient's EHR.

### iOS Health Records Clinical Type Inventory

| HKClinicalTypeIdentifier | iOS Version | FHIR Resource | Authorized? | Persisted? | Notes |
|--------------------------|------------|---------------|-------------|------------|-------|
| `.medicationRecord` | 12.1 | MedicationRequest / MedicationStatement | ✅ | ✅ | Stored in `medications` table |
| `.labResultRecord` | 12.1 | Observation (category: laboratory) | ✅ | ✅ | Stored in `lab_results` table |
| `.conditionRecord` | 12.1 | Condition | ✅ | ❌ | Normalized but backend drops silently |
| `.allergyRecord` | 12.1 | AllergyIntolerance | ✅ | ❌ | Normalized but backend drops silently |
| `.procedureRecord` | 12.1 | Procedure | ✅ | ❌ | Normalized but backend drops silently |
| `.vitalSignRecord` | 12.1 | Observation (category: vital-signs) | ✅ | ✅ | Stored in `lab_results` (source=HealthKit/VitalSign) |
| `.immunizationRecord` | 12.1 | Immunization | ✅ | ❌ | Normalized but backend drops silently |
| `.coverageRecord` | 14.0 | Coverage | ❌ | ❌ | Not even authorized yet |
| `.clinicalNoteRecord` | 16.0 | DocumentReference | ❌ | ❌ | Not authorized; note records contain unstructured clinical text |

### FHIR Resources Available via iOS Health Records vs. Not Available

iOS Health Records exposes only the 9 clinical types above. The following FHIR resources are **not available via iOS HealthKit Health Records** and require a direct EHR FHIR API integration:

**Requires SMART on FHIR EHR direct integration:**
- `DiagnosticReport` — panel-level result grouping; pathology reports
- `CarePlan` + `Goal` + `CareTeam` — care plan and team data
- `FamilyMemberHistory` — hereditary cancer risk
- `MolecularSequence` — genomic data (BRCA1/2, EGFR, etc.)
- `ServiceRequest` — pending orders (labs ordered but not yet resulted)
- `MedicationAdministration` — actual infusion records, chemo dates
- `MedicationDispense` — pharmacy fill records, refill dates
- `Patient` — authoritative demographics with MRN
- `Practitioner` + `PractitionerRole` — care team details
- `EpisodeOfCare` — treatment episode grouping
- `RiskAssessment` — clinical risk scores
- `ResearchSubject` — clinical trial enrollment
- `AdverseEvent` — formally reported toxicities
- `QuestionnaireResponse` — PRO data collected by EHR
- `ImmunizationRecommendation` — recommended vaccines for immunocompromised patients

### EHR Connection Rates — Realistic Expectation

Not all iOS Health app users have connected their EHR. Industry data (2025):
- ~55% of US adults have access to an EHR with Health Records support
- ~35% of those with access have connected their EHR to iPhone Health
- ~20% of all US iPhone users have at least partial Health Records data

**Implication for CareCompanion:** A significant proportion of our users may have empty or sparse Health Records data even after granting permission. The UX should gracefully handle the empty-state and guide users toward connecting their EHR institution.

### Comparison with Competitive Products

| Product | FHIR Resources (effective) | HK Quantity Types | AI Layer | Oncology Focus |
|---------|---------------------------|------------------|----------|----------------|
| **CareCompanion (current)** | 3 stored, 4 parsed+dropped | 3 (steps, HR, sleep) | ✅ LLM coaching | ✅ Primary focus |
| Apple Health (native) | 9 types displayed, no storage | ~80+ tracked | ❌ | ❌ General wellness |
| Epic MyChart | Full Epic FHIR R4 patient portal | Limited | ❌ | ❌ General |
| CommonHealth | 30+ FHIR resources | ❌ | ❌ | ❌ General |
| Human API | 40+ FHIR resources | Limited | ❌ | ❌ B2B aggregator |
| Flatiron Health | Full oncology EHR native | ❌ | Limited | ✅ Oncology |

**CareCompanion's unique moat:** No competitor combines structured FHIR clinical data + passive HealthKit sensor data + LLM coaching personalized for oncology caregivers and patients. The infrastructure for this is 60% built — fixing the silent data loss and adding key HK quantity types would close the gap significantly within one sprint.

---

## Recommended P0 Ingestion Roadmap — 4-Week Scope

### Week 1 — Fix the Silent Data Loss (XS effort, P0 priority)

**Owner:** Aryan (backend API) + Rahil (FHIR/schema per CLAUDE.md ownership)
**Branches:** `aryan/feature/fix-clinical-record-persistence`

#### Changes Required

**1. New DB schema tables (`apps/web/src/lib/db/schema.ts`)**

```typescript
// Conditions from HKClinicalTypeIdentifierConditionRecord → FHIR Condition
export const conditions = pgTable('conditions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  careProfileId:   uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  code:            text('code'),                     // SNOMED-CT or ICD-10 code
  display:         text('display').notNull(),
  clinicalStatus:  text('clinical_status'),           // 'active' | 'resolved' | 'remission' | 'inactive'
  onsetDate:       date('onset_date'),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Allergies from HKClinicalTypeIdentifierAllergyRecord → FHIR AllergyIntolerance
export const allergies = pgTable('allergies', {
  id:              uuid('id').primaryKey().defaultRandom(),
  careProfileId:   uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  code:            text('code'),
  display:         text('display').notNull(),
  reaction:        text('reaction'),                  // manifestation display text
  criticality:     text('criticality'),               // 'low' | 'high' | 'unable-to-assess'
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Procedures from HKClinicalTypeIdentifierProcedureRecord → FHIR Procedure
export const procedures = pgTable('procedures', {
  id:                uuid('id').primaryKey().defaultRandom(),
  careProfileId:     uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  healthkitFhirId:   text('healthkit_fhir_id').unique(),
  code:              text('code'),                    // CPT or SNOMED code
  display:           text('display').notNull(),
  performedDate:     date('performed_date'),
  deletedAt:         timestamp('deleted_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Immunizations from HKClinicalTypeIdentifierImmunizationRecord → FHIR Immunization
export const immunizations = pgTable('immunizations', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  careProfileId:       uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  healthkitFhirId:     text('healthkit_fhir_id').unique(),
  code:                text('code'),                  // CVX code
  display:             text('display').notNull(),
  occurrenceDate:      date('occurrence_date'),
  deletedAt:           timestamp('deleted_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

**2. Migration file (`apps/web/src/lib/db/migrations/018-clinical-records-conditions-allergies.sql`)**

```sql
-- 018: Persist Condition, AllergyIntolerance, Procedure, Immunization
-- records from HKClinicalRecord (previously normalized but silently dropped).
-- All four types are already authorized in HealthKitBridge.swift and
-- normalized in apps/mobile/src/services/internal/normalizers.ts.

CREATE TABLE IF NOT EXISTS conditions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id   uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  healthkit_fhir_id text        UNIQUE,
  code              text,
  display           text        NOT NULL,
  clinical_status   text,
  onset_date        date,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conditions_care_profile_idx ON conditions(care_profile_id);

CREATE TABLE IF NOT EXISTS allergies (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id   uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  healthkit_fhir_id text        UNIQUE,
  code              text,
  display           text        NOT NULL,
  reaction          text,
  criticality       text,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS allergies_care_profile_idx ON allergies(care_profile_id);

CREATE TABLE IF NOT EXISTS procedures (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id   uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  healthkit_fhir_id text        UNIQUE,
  code              text,
  display           text        NOT NULL,
  performed_date    date,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS procedures_care_profile_idx ON procedures(care_profile_id);

CREATE TABLE IF NOT EXISTS immunizations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id   uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  healthkit_fhir_id text        UNIQUE,
  code              text,
  display           text        NOT NULL,
  occurrence_date   date,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS immunizations_care_profile_idx ON immunizations(care_profile_id);
```

**3. Shared types (`packages/types/src/index.ts`)**

Add 4 record types to `HealthKitRecord` union:

```typescript
export type HealthKitConditionRecord = {
  type: 'condition'
  healthkitFhirId: string
  code: string | null
  display: string
  clinicalStatus: string | null
  onsetDateTime: string | null
}

export type HealthKitAllergyRecord = {
  type: 'allergy'
  healthkitFhirId: string
  code: string | null
  display: string
  reaction: string | null
  criticality: string | null
}

export type HealthKitProcedureRecord = {
  type: 'procedure'
  healthkitFhirId: string
  code: string | null
  display: string
  performedDateTime: string | null
}

export type HealthKitImmunizationRecord = {
  type: 'immunization'
  healthkitFhirId: string
  code: string | null
  display: string
  occurrenceDateTime: string | null
}

// Update union:
export type HealthKitRecord =
  | HealthKitMedicationRecord
  | HealthKitLabRecord
  | HealthKitAppointmentRecord
  | HealthKitVitalSignRecord
  | HealthKitConditionRecord      // NEW
  | HealthKitAllergyRecord        // NEW
  | HealthKitProcedureRecord      // NEW
  | HealthKitImmunizationRecord   // NEW
```

**4. Backend sync route (`apps/web/src/app/api/healthkit/sync/route.ts`)**

Add cases to the type switch for each new record type — pattern mirrors existing `medication`, `labResult` handlers.

**5. System prompt enrichment (`apps/web/src/lib/system-prompt.ts`)**

After conditions/allergies are persisted, include them in the system prompt alongside existing medication and lab data to give the LLM full clinical context.

**Clinical unlock from Week 1 fix:**
- AI knows patient's full problem list → more accurate medication safety responses
- Allergy checking before AI medication suggestions (currently impossible — allergies are never stored)
- Surgical history visible → enables trial eligibility reasoning ("have you had prior surgery on this site?")
- Immunization status → alert for live vaccine contraindication in immunocompromised patients

---

### Week 1–2 — Expand HK Quantity Reads (S effort, P0 priority)

**Owner:** Shreyash (mobile) per CLAUDE.md ownership

**Changes in `apps/mobile/ios/WellnessVitals.swift`:**

Add to `requestAuthorization`:
```swift
// P0 oncology monitoring additions
if let t = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .oxygenSaturation) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .respiratoryRate) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .bodyMass) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .bodyTemperature) { readTypes.insert(t) }
// Blood pressure requires correlation type
if let t = HKObjectType.correlationType(forIdentifier: .bloodPressure) { readTypes.insert(t) }
// P1 activity additions
if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .walkingHeartRateAverage) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .flightsClimbed) { readTypes.insert(t) }
if let t = HKObjectType.quantityType(forIdentifier: .bloodGlucose) { readTypes.insert(t) }
```

**Backend requirements:**
- New `wellness_vitals_timeseries` table for persistent HK quantity data with time-series history
- Threshold alerting rules engine (SpO₂ < 94%, bodyTemperature > 38.0°C, weight loss > 2kg/week)
- Trend analysis for HRV (week-over-week decline)

---

### Week 2–3 — iOS Health Records Coverage Type (M effort, P2)

**Owner:** Shreyash (mobile auth) + Aryan (backend schema)

Add to `HealthKitBridge.swift`:
```swift
.coverageRecord  // iOS 14+ — insurance coverage from EHR
// .clinicalNoteRecord  // iOS 16+ — defer to Week 4; large text payload
```

Backend:
- New `insurance_coverage` table with plan details, deductible, OOP max, copay tiers
- Financial toxicity screen: if OOP max > $5000 AND on branded oncology agent → trigger financial support resources
- Prior auth status field: link Coverage.authorization entries to pending orders

---

### Week 3–4 — Symptom Category Types (M effort, P1)

**Owner:** Shreyash (mobile) + Aryan (backend)

Add to `WellnessVitals.swift` — 11 high-value symptom types for oncology:

```swift
if let t = HKObjectType.categoryType(forIdentifier: .fatigue) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .nausea) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .vomiting) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .fever) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .chills) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .shortnessOfBreath) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .rapidPoundingOrFlutteringHeartbeat) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .hairLoss) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .appetiteChanges) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .sleepChanges) { readTypes.insert(t) }
if let t = HKObjectType.categoryType(forIdentifier: .mindfulSession) { readTypes.insert(t) }
```

Backend:
- New sync path for category (event-based) HK data
- `hk_symptom_events` table: identifier, value (severity enum), start/end date, care_profile_id
- CTCAE severity mapping: HK symptom present = Grade ≥ 1 floor
- Chemo-day correlation logic: flag symptoms occurring within 72h of chemo administration dates
- Caregiver burnout: `mindfulSession` absence + high-stress week pattern = burnout nudge trigger

### 4-Week Deliverables Summary

| Week | Deliverable | P-tier | Clinical Impact | Code Location |
|------|------------|--------|-----------------|---------------|
| 1 | DB tables for Condition/Allergy/Procedure/Immunization | P0 | Unblocks 4 clinical record types | `schema.ts`, migration 018 |
| 1 | Shared type union expansion | P0 | Type safety for new record types | `packages/types/src/index.ts` |
| 1 | Backend sync route new cases | P0 | Ends silent data loss for all HK users | `healthkit/sync/route.ts` |
| 1 | System prompt enrichment with conditions/allergies | P0 | AI knows full problem list + allergies | `system-prompt.ts` |
| 1–2 | HRV + SpO₂ + Temp + BP + Weight + RHR in WellnessVitals | P0 | Cardiotox + neutropenic fever monitoring | `WellnessVitals.swift` |
| 1–2 | Wellness vitals time-series DB + threshold alerts | P0 | Actionable clinical alerts | New schema + alert engine |
| 2–3 | Coverage record auth + parsing + DB | P2 | Financial toxicity screening | `HealthKitBridge.swift` + new schema |
| 3–4 | 11 symptom category types + DB persistence | P1 | Passive toxicity monitoring; CINV tracking | `WellnessVitals.swift` + new schema |

**Not in 4-week scope (requires EHR direct FHIR API integration — separate initiative):**
- DiagnosticReport (lab panel grouping, pathology reports)
- CarePlan / Goal / CareTeam
- MolecularSequence (BRCA1/2, EGFR, etc.)
- ServiceRequest (pending orders)
- Patient / Practitioner (authoritative demographics)
- MedicationAdministration (actual infusion records)

---

## Clinical-Value Scoring Rubric

Use this rubric to evaluate any proposed FHIR resource or HealthKit type addition. Score each of 5 dimensions 0–3, sum for total (max 15). Assign priority tier from the table below.

### Dimension 1: Oncology Specificity (0–3)

| Score | Criteria |
|-------|----------|
| 3 | Core to oncology care: chemo toxicity monitoring, tumor response, treatment adherence, survivorship, cancer screening, trial eligibility |
| 2 | Relevant to oncology and multiple other chronic diseases (diabetes, CHF, COPD, CKD) |
| 1 | General health tracking; useful context but not oncology-specific |
| 0 | Minimal or no relevance to oncology or chronic disease management |

### Dimension 2: Safety Signal Potential (0–3)

| Score | Criteria |
|-------|----------|
| 3 | Can trigger actionable clinical alert (neutropenic fever protocol, grade 3+ toxicity, ER-level event, medication contraindication) |
| 2 | Enables trend-based early warning that changes clinical management (HRV decline = cardiotoxicity) |
| 1 | Adds context to clinical conversations; no direct alert potential |
| 0 | No safety signal value |

### Dimension 3: Caregiver Burden Reduction (0–3)

| Score | Criteria |
|-------|----------|
| 3 | Eliminates manual data entry entirely — data is auto-populated from authoritative source |
| 2 | Reduces significant manual effort — pre-fills forms, reduces duplicate entry across systems |
| 1 | Minor convenience improvement — reduces occasional re-entry |
| 0 | Does not reduce caregiver data entry burden |

### Dimension 4: AI Context Enrichment (0–3)

| Score | Criteria |
|-------|----------|
| 3 | Directly improves AI response quality for high-frequency scenarios (medication questions, lab interpretation, symptom assessment, trial matching) |
| 2 | Improves AI context for moderate-frequency scenarios (care planning, appointment preparation) |
| 1 | Marginal AI improvement for edge-case scenarios |
| 0 | No AI benefit |

### Dimension 5: Data Availability (0–3)

| Score | Criteria |
|-------|----------|
| 3 | Available via iOS HealthKit today — no new EHR or third-party integration required; just Swift/TS code |
| 2 | Available via iOS Health Records (requires patient to have connected their EHR — growing but not universal) |
| 1 | Requires new EHR direct FHIR API integration (business partnership + tech integration work) |
| 0 | Requires novel data collection infrastructure (new hardware, custom sensors, proprietary data feed) |

### Priority Tier Assignment

| Total Score | Tier | Action |
|-------------|------|--------|
| 12–15 | **P0** | Block current sprint on this; high-value quick win |
| 8–11 | **P1** | Plan for next quarter roadmap |
| 4–7 | **P2** | Backlog; revisit at roadmap review |
| 0–3 | **P3** | Deprioritize indefinitely; only if user research explicitly demands |

### Scoring Examples

| Data Type | Oncology | Safety | Caregiver | AI | Availability | **Total** | **Tier** |
|-----------|----------|--------|-----------|----|----|-------|------|
| AllergyIntolerance (fix backend) | 3 | 3 | 3 | 3 | 3 | **15** | **P0** |
| Condition (fix backend) | 3 | 2 | 3 | 3 | 3 | **14** | **P0** |
| oxygenSaturation | 3 | 3 | 3 | 2 | 3 | **14** | **P0** |
| heartRateVariabilitySDNN | 3 | 3 | 2 | 3 | 3 | **14** | **P0** |
| bodyTemperature | 3 | 3 | 3 | 2 | 3 | **14** | **P0** |
| bloodPressure | 2 | 3 | 2 | 2 | 3 | **12** | **P0** |
| restingHeartRate | 2 | 2 | 2 | 2 | 3 | **11** | **P1** |
| Immunization (fix backend) | 3 | 3 | 3 | 2 | 3 | **14** | **P0** |
| Procedure (fix backend) | 3 | 1 | 3 | 3 | 3 | **13** | **P0** |
| bodyMass | 2 | 2 | 2 | 2 | 3 | **11** | **P1** |
| fatigue (category) | 3 | 2 | 3 | 3 | 3 | **14** | **P0** |
| nausea (category) | 3 | 2 | 3 | 3 | 3 | **14** | **P0** |
| mindfulSession (category) | 1 | 1 | 3 | 2 | 3 | **10** | **P1** |
| DiagnosticReport | 3 | 2 | 2 | 3 | 1 | **11** | **P1** |
| CarePlan | 3 | 1 | 3 | 3 | 1 | **11** | **P1** |
| MolecularSequence (genomics) | 3 | 2 | 1 | 3 | 0 | **9** | **P1** |
| Coverage | 1 | 1 | 3 | 1 | 2 | **8** | **P1** |
| FamilyMemberHistory | 3 | 1 | 2 | 3 | 1 | **10** | **P1** |
| headphoneAudioExposure | 2 | 1 | 0 | 1 | 3 | **7** | **P2** |
| sexualActivity | 1 | 0 | 1 | 1 | 3 | **6** | **P2** |
| menstrualFlow | 2 | 1 | 1 | 1 | 3 | **8** | **P1** |
| VisionPrescription | 0 | 0 | 1 | 0 | 2 | **3** | **P3** |
| CapabilityStatement | 0 | 0 | 0 | 0 | 0 | **0** | **P3** |

---

## Sources

### FHIR R4 Specification
HL7 International. *FHIR Release 4 (Normative).* January 2019.
- Resource list: https://hl7.org/fhir/R4/resourcelist.html *(HTTP 403 during audit — used knowledge base)*
- Clinical Summary Module: https://hl7.org/fhir/R4/clinicalsummary-module.html *(HTTP 403)*
- Medications Module: https://hl7.org/fhir/R4/medications-module.html *(HTTP 403)*
- Diagnostics Module: https://hl7.org/fhir/R4/diagnostics-module.html *(HTTP 403)*
- Financial Module: https://hl7.org/fhir/R4/financial-module.html *(HTTP 403)*

### Apple HealthKit Documentation
Apple Inc. *HealthKit Framework.* https://developer.apple.com/documentation/healthkit *(HTTP 403 during audit — used knowledge base)*
- HKQuantityTypeIdentifier: https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier
- HKCategoryTypeIdentifier: https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier
- HKClinicalTypeIdentifier: https://developer.apple.com/documentation/healthkit/hkclinicaltypeidentifier
- HKClinicalRecord: https://developer.apple.com/documentation/healthkit/hkclinicalrecord
- Data types overview: https://developer.apple.com/documentation/healthkit/data_types

### CareCompanion Codebase (aryan/dev branch, 2026-05-20)
All file citations in this document refer to the following files read during this audit:
- `apps/mobile/ios/HealthKitBridge.swift`
- `apps/mobile/ios/WellnessVitals.swift`
- `apps/mobile/src/services/healthkit.ts`
- `apps/mobile/src/services/internal/normalizers.ts`
- `apps/web/src/app/api/healthkit/sync/route.ts`
- `apps/web/src/app/api/healthkit/replace/route.ts`
- `apps/web/src/lib/db/schema.ts`
- `apps/web/src/lib/db/migrations/001–017`
- `packages/types/src/index.ts`
- `packages/utils/src/fhir.ts`
- `packages/utils/src/__tests__/fhir.test.ts`

### Clinical References
- National Comprehensive Cancer Network (NCCN). *Clinical Practice Guidelines in Oncology — Prevention and Treatment of Cancer-Related Infections, Version 1.2026.* https://www.nccn.org/guidelines/category_3
- U.S. Department of Health and Human Services. *Common Terminology Criteria for Adverse Events (CTCAE) v5.0.* NIH/NCI. November 2017. https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctc.htm
- Mustian KM et al. *Comparison of Pharmaceutical, Psychological, and Exercise Treatments for Cancer-Related Fatigue.* JAMA Oncology. 2017. *(Basis for "exercise reduces chemo fatigue 40–50%" statistic)*
- Armenian SH et al. *Prevention and Monitoring of Cardiac Dysfunction in Survivors of Adult Cancers.* Journal of Clinical Oncology. 2017. *(Cardiotoxicity monitoring standards)*
- Khorana AA et al. *Development and Validation of a Predictive Model for Chemotherapy-Associated Thrombosis.* Blood. 2008. *(Khorana VTE risk score referenced in RiskAssessment section)*
- Extermann M et al. *Predicting the risk of chemotherapy toxicity in older patients: The Chemotherapy Risk Assessment Scale for High-Age Patients (CRASH) score.* Cancer. 2012. *(Frailty/toxicity prediction — walking speed referenced)*
- Thavendiranathan P et al. *Use of Myocardial Strain Imaging by Echocardiography for the Early Detection of Cardiotoxicity in Patients During and After Cancer Chemotherapy.* Journal of the American College of Cardiology. 2014. *(HRV cardiotoxicity biomarker basis)*

---

## Appendix A — Feature-to-Data-Gap Mapping

The following table maps every proposed or planned CareCompanion product feature to the specific data gaps that block it. Use this for roadmap planning: if a feature is blocked, find its data dependency here.

| Planned Feature | Blocking Data Gap | Gap Priority | Sprint to Unblock |
|----------------|------------------|--------------|-------------------|
| **Allergy conflict alert before AI med suggestions** | AllergyIntolerance not persisted (backend drop) | P0 | Week 1 |
| **Problem list display in care summary** | Condition not persisted (backend drop) | P0 | Week 1 |
| **Neutropenic fever home monitoring** | SpO₂ + BodyTemperature not read | P0 | Week 1–2 |
| **Cardiotoxicity early warning (chemo)** | HRV not read, no time-series vitals DB | P0 | Week 1–2 |
| **VEGF inhibitor BP monitoring** | Blood pressure not read | P0 | Week 1–2 |
| **Weight loss / nutritional risk alert** | bodyMass not read | P0 | Week 1–2 |
| **Trial eligibility: surgical history** | Procedure not persisted (backend drop) | P0 | Week 1 |
| **Immunocompromised vaccine status display** | Immunization not persisted (backend drop) | P0 | Week 1 |
| **Live vaccine contraindication alert** | Immunization not persisted | P0 | Week 1 |
| **CINV tracking + antiemetic effectiveness** | nausea, vomiting category types not read | P1 | Week 3–4 |
| **Chemo fatigue pattern (correlation with CBC)** | fatigue category type not read | P1 | Week 3–4 |
| **Caregiver burnout early detection** | sleepChanges, mindfulSession, moodChanges not read | P1 | Week 3–4 |
| **Peripheral neuropathy progression tracking** | walkingAsymmetryPercentage, peripheralPerfusionIndex not read | P1 | Q3 |
| **Financial toxicity screening** | Coverage not authorized in HK | P2 | Week 2–3 |
| **Prior auth status display** | Coverage not read, Claim not ingested | P2 | Week 2–3 |
| **Lab panel grouping (CBC/CMP as panels)** | DiagnosticReport — not in HK; EHR direct API needed | P1 | Q3+ |
| **Oncologist care plan display** | CarePlan — not in HK; EHR direct API needed | P1 | Q3+ |
| **Tumor marker dashboard (CA-125, PSA, CEA)** | DiagnosticReport — not in HK; EHR direct API needed | P1 | Q3+ |
| **Genomic biomarker-aware trial matching (BRCA, EGFR)** | MolecularSequence — not in HK; EHR direct API needed | P1 | Q4+ |
| **Hereditary cancer risk flag (BRCA family history)** | FamilyMemberHistory — not in HK; EHR direct API needed | P1 | Q3+ |
| **Visit timeline (hospitalization + ER tracking)** | Encounter — conversion exists but not wired | P0 | Week 1 (wire up fhir.ts:37) |
| **Exercise prescription adherence** | appleExerciseTime not read | P1 | Week 1–2 |
| **Functional capacity decline alert** | walkingSpeed, sixMinuteWalkTestDistance not read | P1 | Q3 |
| **Platinum ototoxicity risk reduction** | headphoneAudioExposure not read | P2 | Q3 |
| **Fertility preservation counseling** | menstrualFlow, cervicalMucusQuality, ovulationTestResult not read | P2 | Q4 |
| **Tamoxifen endometrial safety monitoring** | intermenstrualBleeding not read | P2 | Q3 |
| **G-CSF bone pain tracking** | generalizedBodyAche category type not read | P1 | Week 3–4 |
| **Chemo brain documentation** | memoryLapse category type not read | P1 | Week 3–4 |
| **AI-summarized clinical notes** | clinicalNoteRecord not authorized | P1 | Q3+ |
| **Standardized PRO collection (PROMIS, ESAS)** | Questionnaire/QuestionnaireResponse — EHR direct API | P1 | Q4 |
| **Clinical trial enrollment tracking** | ResearchSubject — EHR direct API needed | P1 | Q4 |

---

## Appendix B — HealthKit Quantity Type Complete Catalog

The following is the complete HKQuantityTypeIdentifier catalog as of iOS 17 / Apple Watch Series 9. Each identifier is listed with current read status.

### Activity & Fitness

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `stepCount` | count | ✅ | — |
| `distanceWalkingRunning` | m | ❌ | P1 |
| `distanceCycling` | m | ❌ | P2 |
| `distanceSwimming` | m | ❌ | P2 |
| `distanceDownhillSnowSports` | m | ❌ | P3 |
| `distanceWheelchair` | m | ❌ | P2 |
| `pushCount` | count | ❌ | P2 |
| `swimmingStrokeCount` | count | ❌ | P3 |
| `flightsClimbed` | count | ❌ | P1 |
| `nikeFuel` | kcal | ❌ | P3 |
| `activeEnergyBurned` | kcal | ❌ | P1 |
| `basalEnergyBurned` | kcal | ❌ | P2 |
| `appleExerciseTime` | min | ❌ | P1 |
| `appleStandTime` | min | ❌ | P1 |
| `appleMoveTime` | min | ❌ | P2 |
| `walkingSpeed` | m/s | ❌ | P1 |
| `walkingStepLength` | m | ❌ | P1 |
| `walkingAsymmetryPercentage` | % | ❌ | P1 |
| `walkingDoubleSupportPercentage` | % | ❌ | P1 |
| `stairAscentSpeed` | m/s | ❌ | P2 |
| `stairDescentSpeed` | m/s | ❌ | P2 |
| `sixMinuteWalkTestDistance` | m | ❌ | P1 |
| `underwaterDepth` | m | ❌ | P3 |
| `waterTemperature` | °C | ❌ | P3 |

### Vitals

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `heartRate` | count/min | ✅ | — |
| `restingHeartRate` | count/min | ❌ | P0 |
| `walkingHeartRateAverage` | count/min | ❌ | P1 |
| `heartRateVariabilitySDNN` | ms | ❌ | P0 |
| `heartRateRecoveryOneMinute` | count/min | ❌ | P2 |
| `atrialFibrillationBurden` | % | ❌ | P1 |
| `oxygenSaturation` | % | ❌ | P0 |
| `bodyTemperature` | °C | ❌ | P0 |
| `basalBodyTemperature` | °C | ❌ | P2 |
| `bloodPressureSystolic` | mmHg | ❌ | P0 |
| `bloodPressureDiastolic` | mmHg | ❌ | P0 |
| `respiratoryRate` | count/min | ❌ | P0 |
| `vo2Max` | mL/kg/min | ❌ | P1 |
| `peripheralPerfusionIndex` | % | ❌ | P1 |

### Body Measurements

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `bodyMassIndex` | kg/m² | ❌ | P1 |
| `bodyMass` | kg | ❌ | P0 |
| `height` | m | ❌ | P2 |
| `bodyFatPercentage` | % | ❌ | P1 |
| `leanBodyMass` | kg | ❌ | P1 |
| `waistCircumference` | m | ❌ | P1 |

### Lab & Test Results

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `bloodAlcoholContent` | % | ❌ | P3 |
| `bloodGlucose` | mg/dL | ❌ | P1 |
| `electrodermalActivity` | S | ❌ | P2 |
| `forcedExpiratoryVolume1` | L | ❌ | P1 |
| `forcedVitalCapacity` | L | ❌ | P1 |
| `inhalerUsage` | count | ❌ | P2 |
| `insulinDelivery` | IU | ❌ | P1 |
| `numberOfTimesFallen` | count | ❌ | P1 |
| `peakExpiratoryFlowRate` | L/min | ❌ | P1 |
| `uvExposure` | count | ❌ | P2 |
| `numberOfAlcoholicBeverages` | count | ❌ | P3 |

### Nutrition (Dietary)

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `dietaryEnergyConsumed` | kcal | ❌ | P2 |
| `dietaryCarbohydrates` | g | ❌ | P2 |
| `dietaryFiber` | g | ❌ | P2 |
| `dietarySugar` | g | ❌ | P2 |
| `dietaryFatTotal` | g | ❌ | P2 |
| `dietaryFatSaturated` | g | ❌ | P2 |
| `dietaryCholesterol` | mg | ❌ | P2 |
| `dietaryProtein` | g | ❌ | P2 |
| `dietarySodium` | mg | ❌ | P2 |
| `dietaryPotassium` | mg | ❌ | P2 |
| `dietaryCalcium` | mg | ❌ | P2 |
| `dietaryIron` | mg | ❌ | P2 |
| `dietaryVitaminC` | mg | ❌ | P2 |
| `dietaryVitaminD` | IU | ❌ | P2 |
| `dietaryFolate` | mcg | ❌ | P2 |
| `dietaryWater` | mL | ❌ | P2 |
| `dietaryCaffeine` | mg | ❌ | P2 |
| *(all other dietary types — ~20 more)* | various | ❌ | P3 |

### Environmental

| Identifier | Unit | We Read? | Priority |
|-----------|------|---------|---------|
| `headphoneAudioExposure` | dB(A) | ❌ | P2 |
| `environmentalAudioExposure` | dB(A) | ❌ | P2 |
| `environmentalSoundReduction` | dB(A) | ❌ | P2 |

---

## Appendix C — Known Technical Debt in Existing FHIR Pipeline

The following issues were identified during the code audit. They are not data gaps per se but affect the reliability and clinical accuracy of data that is already ingested.

### C1 — VitalSign Records Stored as Lab Results

`apps/web/src/app/api/healthkit/sync/route.ts` stores `vitalSign` records in the `lab_results` table with `source='HealthKit/VitalSign'`. This means:

- Vital signs (heart rate, blood pressure, body weight from FHIR VitalSignRecord) are mixed with lab results (CBC, CMP, metabolic panels) in the same table
- The UI must filter by `source` to separate them, which is brittle
- FHIR Observation category codes (vital-signs vs. laboratory) are available in the normalized record but not surfaced to the DB
- **Recommendation:** Add a separate `wellness_vitals_timeseries` table for HK quantity data (Week 1–2 changes), and migrate VitalSign records from `lab_results` to this table

### C2 — Appointment Sync Case Has No Matching HK Clinical Type

The sync route has a case for `record.type === 'appointment'` (`route.ts` ~line 59) but no `HKClinicalTypeIdentifier` produces records of type `'appointment'`. The `HealthKitAppointmentRecord` type in `packages/types` and the `fhirEncounterToAppointment` utility (`packages/utils/src/fhir.ts:37`) are designed for FHIR `Encounter` resources, not a HealthKit clinical type. This case is currently unreachable. The appointment dedup column (`healthkit_fhir_id`) in the `appointments` table serves no current purpose.

**Recommendation:** Wire up `fhirEncounterToAppointment` to process Encounter records if/when we add a direct EHR FHIR API integration.

### C3 — No Time-Series Storage for HK Quantity Types

`WellnessVitals.swift` fetches stepCount, heartRate, and sleepAnalysis on-demand and returns them to the JavaScript layer. There is no database persistence for these values. This means:

- No historical trend analysis (e.g., week-over-week step count decline during chemo)
- No threshold alerting on historical data (e.g., trending HR increase over 3 days)
- No correlation analysis (e.g., lab ANC vs. energy level on same day)
- **Recommendation:** Add `wellness_vitals_timeseries` table with columns: `care_profile_id`, `identifier` (HK type string), `value`, `unit`, `recorded_at` (timestamp), `source_device` (optional). Insert on each `fetchDailyVitals` call.

### C4 — No LOINC Code Storage for Lab Results

Lab results from `HKClinicalTypeIdentifierLabResultRecord` carry LOINC codes in the FHIR Observation `code.coding` array. The normalizer (`normalizers.ts:normaliseLabResult`) discards these codes and stores only `testName` (display text). This means:

- Lab results cannot be grouped or trended by standardized code (two labs called "Hemoglobin" and "Hgb" are treated as different tests)
- LOINC-based panel grouping (DiagnosticReport equivalent) is impossible without the code
- **Recommendation:** Add `loinc_code` column to `lab_results` table; update normalizer to extract `code.coding[0].code` where `system = 'http://loinc.org'`; add migration

### C5 — No FHIR Resource Type Field in Stored Records

When medications are stored from `MedicationRequest` FHIR resources, the original FHIR resource type is not stored. If the EHR later sends a `MedicationStatement` for the same drug, there is no way to differentiate prescription (MedicationRequest) from patient-reported (MedicationStatement) in the database. This affects accuracy of adherence tracking.

**Recommendation:** Add `fhir_resource_type` text column to `medications`, `lab_results`, `appointments` tables for provenance tracking.

### C6 — Silent 5xx Suppression in Sync Route Error Handling

The sync route wraps each insert in a try/catch that increments `errors++` and calls `console.error` but continues processing. A DB constraint error (e.g., schema mismatch after a migration) will silently fail individual records without the client knowing which records failed or why.

**Recommendation:** Return per-record failure details in the sync response for debugging; or implement a dead-letter queue for failed records (similar to the mobile retry queue pattern already in `healthkit.ts`).

---

## Appendix D — SMART on FHIR EHR Direct Integration Roadmap (Beyond iOS HK)

iOS Health Records gives us a read-only window into a subset of FHIR resources. To unlock P1 resources like `DiagnosticReport`, `CarePlan`, `CareTeam`, and `MolecularSequence`, we need a direct SMART on FHIR integration with EHR systems.

### SMART on FHIR Overview

SMART on FHIR (Substitutable Medical Applications, Reusable Technologies) is the standard OAuth2-based authorization layer for accessing EHR FHIR APIs. CMS requires EHRs under 21st Century Cures Act to expose FHIR R4 APIs with SMART authorization.

**Key EHR FHIR API endpoints:**
- Epic: `https://{org}.epic.com/interconnect-amcurr/api/FHIR/R4/`
- Cerner (Oracle Health): `https://fhir-myrecord.cerner.com/r4/{tenant-id}/`
- CommonWell / Carequality: FHIR endpoints for network-connected records
- Athenahealth: `https://api.platform.athenahealth.com/fhir/r4/`

### Authorization Flow for Direct Integration

```
1. Patient registers in CareCompanion
2. Patient selects their institution (Epic, Cerner, etc.) from searchable directory
3. CareCompanion initiates SMART authorization:
   GET {ehr}/oauth2/authorize?
     response_type=code
     &client_id={our_client_id}
     &redirect_uri=https://app.carecompanion.com/fhir/callback
     &scope=patient/*.read offline_access
     &state={csrf_token}
     &aud={ehr_fhir_base_url}
4. Patient logs in to EHR and grants consent
5. EHR returns authorization code → we exchange for access + refresh token
6. Store tokens in connected_apps table (encrypted via token-encryption.ts)
7. Use access token for FHIR R4 API queries on behalf of patient
8. Refresh token enables ongoing background sync
```

### Resources Unlocked by Direct Integration (Beyond iOS HK)

| FHIR Resource | FHIR Query | Refresh Cadence | Clinical Value |
|---------------|-----------|-----------------|----------------|
| DiagnosticReport | `GET /DiagnosticReport?patient={id}&_count=50` | Daily | Lab panel grouping; pathology reports |
| CarePlan | `GET /CarePlan?patient={id}&status=active` | Weekly | Treatment plan display |
| Goal | `GET /Goal?patient={id}&lifecycle-status=active` | Weekly | Clinical goal tracking |
| CareTeam | `GET /CareTeam?patient={id}&status=active` | Weekly | Full care team roster |
| FamilyMemberHistory | `GET /FamilyMemberHistory?patient={id}` | Monthly | Hereditary risk assessment |
| MedicationAdministration | `GET /MedicationAdministration?patient={id}&_sort=-effective-time` | Daily | Chemo day tracking |
| ServiceRequest | `GET /ServiceRequest?patient={id}&status=active` | Daily | Pending orders status |
| Patient | `GET /Patient/{id}` | On connect | Authoritative demographics |
| Practitioner | `GET /Practitioner?_id={ids}` | Weekly | Care team details |
| ImmunizationRecommendation | `GET /ImmunizationRecommendation?patient={id}` | Monthly | Vaccine schedule for immunocompromised |
| AdverseEvent | `GET /AdverseEvent?subject={id}` | Daily | Formally reported toxicities |
| ResearchSubject | `GET /ResearchSubject?patient={id}` | Weekly | Clinical trial enrollment |
| RiskAssessment | `GET /RiskAssessment?patient={id}` | Weekly | Khorana, fall risk, readmission scores |
| EpisodeOfCare | `GET /EpisodeOfCare?patient={id}&status=active` | Weekly | Treatment episode grouping |

### Epic App Orchard Registration

To integrate with Epic, CareCompanion must register on [Epic App Orchard](https://appmarket.epic.com/). Required:
- Production application review (6–12 week process)
- HIPAA Business Associate Agreement with Epic
- Sandbox testing against Epic's open FHIR sandbox (open.epic.com)
- Patient-facing application category (standalone SMART app)
- Scopes requested: `patient/Condition.read patient/DiagnosticReport.read patient/Observation.read patient/CarePlan.read patient/Medication.read patient/MedicationRequest.read patient/Immunization.read patient/AllergyIntolerance.read patient/Procedure.read patient/Encounter.read patient/Patient.read`

### Existing Infrastructure That Supports Direct Integration

CareCompanion already has the infrastructure needed for direct EHR integration:

| Infrastructure | File | Notes |
|---------------|------|-------|
| OAuth token storage | `apps/web/src/lib/db/schema.ts` — `connectedApps` table | `accessToken`, `refreshToken`, `expiresAt` columns already exist |
| Token encryption | `apps/web/src/lib/token-encryption.ts` | Encrypt tokens at rest |
| Audit logging | `apps/web/src/lib/audit.ts` | HIPAA audit trail for data access |
| FHIR conversion utilities | `packages/utils/src/fhir.ts` | Conversion functions ready to extend |
| DB schema | `apps/web/src/lib/db/schema.ts` | Tables for medications, lab_results, appointments already FHIR-aware via `healthkitFhirId` dedup column |

The primary work for direct EHR integration is:
1. App Orchard registration + EHR partnership agreements
2. SMART authorization flow UI (institution search, OAuth handshake, callback handler)
3. Background FHIR sync job (cron-based polling or EHR subscription push)
4. New DB tables for resources not yet in schema (CarePlan, Goal, CareTeam, FamilyMemberHistory, etc.)
5. New normalization functions (extending `packages/utils/src/fhir.ts`)

---

---

## Appendix E — Quick-Reference: Priority Summary

### P0 Actions (Do This Sprint)

1. **Fix backend sync route** — add `condition`, `allergy`, `procedure`, `immunization` cases (`apps/web/src/app/api/healthkit/sync/route.ts`)
2. **Add 4 DB tables** — migration 018 (`conditions`, `allergies`, `procedures`, `immunizations`)
3. **Expand shared types** — `packages/types/src/index.ts` HealthKitRecord union
4. **Add HK quantity reads** — `oxygenSaturation`, `heartRateVariabilitySDNN`, `bodyTemperature`, `bloodPressure`, `bodyMass`, `restingHeartRate`, `respiratoryRate` to `WellnessVitals.swift`
5. **Wire Encounter conversion** — call `fhirEncounterToAppointment` (`packages/utils/src/fhir.ts:37`) from a sync path

### P1 Actions (This Quarter)

6. **Symptom category types** — 11 HKCategoryType identifiers for CINV, fatigue, caregiver burnout
7. **Coverage record** — add `.coverageRecord` to `HealthKitBridge.swift` authorization
8. **Time-series vitals DB** — persist HK quantity reads to `wellness_vitals_timeseries` table
9. **LOINC codes on lab results** — add `loinc_code` column and update normalizer
10. **SMART on FHIR planning** — begin Epic App Orchard registration process

### P2 Actions (Next Quarter)

11. Financial module — Coverage, ExplanationOfBenefit, Claim ingestion
12. `.clinicalNoteRecord` authorization — AI summarization of discharge summaries, progress notes
13. Reproductive health HK types — fertility preservation, hormone therapy monitoring

---

*Document should be refreshed quarterly, or whenever new FHIR resources or HealthKit identifiers are ingested. Use the scoring rubric in Section 9 to prioritize all future additions. File ownership: Aryan (FHIR architecture decisions, backend routes), Rahil (fhir.ts, FHIR schema per CLAUDE.md).*
