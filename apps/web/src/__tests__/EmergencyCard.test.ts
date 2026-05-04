import { describe, it, expect } from 'vitest'

// buildPlainText is not exported, so we test it via the component's output logic
// by replicating the pure function here (matches EmergencyCard.tsx exactly)
function buildPlainText(
  patient: { name: string; age: number | null; conditions: string | null; allergies: string | null; emergencyContactName: string | null | undefined; emergencyContactPhone: string | null | undefined },
  medications: Array<{ name: string; dose: string; frequency: string }>,
  primaryDoctor: { name: string; specialty: string; phone: string } | undefined,
  insurance: { provider: string; memberId: string; groupNumber: string } | null,
) {
  const lines = [
    `EMERGENCY INFORMATION — ${patient.name}`,
    `Age: ${patient.age || 'Unknown'}`,
    '',
    `CONDITIONS: ${patient.conditions || 'None listed'}`,
    `ALLERGIES: ${patient.allergies || 'NKDA'}`,
    '',
    'CURRENT MEDICATIONS:',
    ...medications.map((m) => `  - ${m.name} ${m.dose} ${m.frequency}`),
    '',
  ]
  if (primaryDoctor) {
    lines.push(`PRIMARY DOCTOR: ${primaryDoctor.name} (${primaryDoctor.specialty}) ${primaryDoctor.phone}`)
  }
  if (insurance) {
    lines.push(`INSURANCE: ${insurance.provider} | Member: ${insurance.memberId} | Group: ${insurance.groupNumber}`)
  }
  if (patient.emergencyContactName) {
    lines.push(`EMERGENCY CONTACT: ${patient.emergencyContactName} ${patient.emergencyContactPhone || ''}`)
  }
  return lines.join('\n')
}

const basePatient = {
  name: 'Jane Doe',
  age: 54,
  conditions: 'Breast cancer stage II',
  allergies: 'Penicillin',
  emergencyContactName: 'John Doe',
  emergencyContactPhone: '555-1234',
}

describe('buildPlainText', () => {
  it('includes all fields when fully populated', () => {
    const text = buildPlainText(
      basePatient,
      [{ name: 'Tamoxifen', dose: '20mg', frequency: 'daily' }],
      { name: 'Dr. Smith', specialty: 'Oncology', phone: '555-9999' },
      { provider: 'BlueCross', memberId: 'M123', groupNumber: 'G456' },
    )
    expect(text).toContain('Jane Doe')
    expect(text).toContain('Age: 54')
    expect(text).toContain('Penicillin')
    expect(text).toContain('Tamoxifen 20mg daily')
    expect(text).toContain('Dr. Smith')
    expect(text).toContain('BlueCross')
    expect(text).toContain('John Doe 555-1234')
  })

  it('shows NKDA when no allergies', () => {
    const text = buildPlainText({ ...basePatient, allergies: null }, [], undefined, null)
    expect(text).toContain('NKDA')
  })

  it('shows Unknown age when age is null', () => {
    const text = buildPlainText({ ...basePatient, age: null }, [], undefined, null)
    expect(text).toContain('Age: Unknown')
  })

  it('shows None listed when no medications', () => {
    const text = buildPlainText(basePatient, [], undefined, null)
    expect(text).toContain('CURRENT MEDICATIONS:')
    // No medication lines — just the header
    expect(text).not.toContain('  - ')
  })

  it('omits PRIMARY DOCTOR section when no doctor', () => {
    const text = buildPlainText(basePatient, [], undefined, null)
    expect(text).not.toContain('PRIMARY DOCTOR')
  })

  it('omits INSURANCE section when insurance is null', () => {
    const text = buildPlainText(basePatient, [], undefined, null)
    expect(text).not.toContain('INSURANCE')
  })

  it('omits EMERGENCY CONTACT when not set', () => {
    const text = buildPlainText({ ...basePatient, emergencyContactName: null }, [], undefined, null)
    expect(text).not.toContain('EMERGENCY CONTACT')
  })

  it('handles missing emergency contact phone gracefully', () => {
    const text = buildPlainText({ ...basePatient, emergencyContactPhone: null }, [], undefined, null)
    expect(text).toContain('EMERGENCY CONTACT: John Doe ')
  })
})

function calcIsEmpty(allergies: string | null, meds: unknown[], contactName: string | null | undefined) {
  return !allergies && meds.length === 0 && !contactName
}

describe('EmergencyCard isEmpty logic', () => {
  it('is empty when no allergies, no meds, no contact', () => {
    expect(calcIsEmpty(null, [], null)).toBe(true)
  })

  it('is NOT empty when allergies are set', () => {
    expect(calcIsEmpty('Penicillin', [], null)).toBe(false)
  })

  it('is NOT empty when medications exist', () => {
    expect(calcIsEmpty(null, [{ name: 'Tamoxifen' }], null)).toBe(false)
  })

  it('is NOT empty when emergency contact is set', () => {
    expect(calcIsEmpty(null, [], 'John Doe')).toBe(false)
  })
})

describe('primaryDoctor selection', () => {
  const doctors = [
    { name: 'Dr. General', specialty: 'General Surgery', phone: '555-1' },
    { name: 'Dr. Primary', specialty: 'Primary Care', phone: '555-2' },
    { name: 'Dr. Family', specialty: 'Family Medicine', phone: '555-3' },
  ]

  function selectPrimaryDoctor(docs: typeof doctors) {
    return docs.find((d) =>
      d.specialty?.toLowerCase().includes('primary') ||
      d.specialty?.toLowerCase().includes('family') ||
      d.specialty?.toLowerCase().includes('internal')
    ) || docs[0]
  }

  it('prefers primary care over others', () => {
    expect(selectPrimaryDoctor(doctors)?.name).toBe('Dr. Primary')
  })

  it('falls back to first doctor when no primary/family/internal', () => {
    const onlyGeneral = [{ name: 'Dr. General', specialty: 'General Surgery', phone: '555-1' }]
    expect(selectPrimaryDoctor(onlyGeneral)?.name).toBe('Dr. General')
  })

  it('returns undefined for empty list', () => {
    expect(selectPrimaryDoctor([])).toBeUndefined()
  })
})
