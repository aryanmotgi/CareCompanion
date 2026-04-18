/**
 * Export care summary as a downloadable PDF-ready HTML document.
 * Generates a printable care summary with medications, appointments, labs, conditions.
 * Returns HTML that can be printed to PDF from the browser.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles, medications, doctors, appointments, labResults, claims } from '@/lib/db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60000, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)

    if (!profile) return ApiErrors.notFound('Care profile')

    const [meds, docs, appts, labs, claimsData] = await Promise.all([
      db.select().from(medications).where(eq(medications.careProfileId, profile.id)).orderBy(asc(medications.name)),
      db.select().from(doctors).where(eq(doctors.careProfileId, profile.id)).orderBy(asc(doctors.name)),
      db.select().from(appointments).where(eq(appointments.careProfileId, profile.id)).orderBy(asc(appointments.dateTime)),
      db.select().from(labResults).where(eq(labResults.userId, dbUser!.id)).orderBy(desc(labResults.dateTaken)).limit(30),
      db.select().from(claims).where(eq(claims.userId, dbUser!.id)).orderBy(desc(claims.serviceDate)).limit(20),
    ])

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const futureAppts = appts.filter(a => a.dateTime && new Date(a.dateTime) > now)
    const abnormalLabs = labs.filter(l => l.isAbnormal)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Care Summary — ${profile.patientName || 'Patient'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #1a1a2e; }
    h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #6366f1; color: #4338ca; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: #374151; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .patient-info { font-size: 14px; color: #374151; }
    .patient-info span { display: block; margin-bottom: 2px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; margin-right: 4px; }
    .badge-cancer { background: #fef3c7; color: #92400e; }
    .badge-stage { background: #e0e7ff; color: #3730a3; }
    .badge-phase { background: #d1fae5; color: #065f46; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; }
    th { text-align: left; padding: 8px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; font-weight: 600; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    .abnormal { color: #dc2626; font-weight: 600; }
    .disclaimer { margin-top: 32px; padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e; }
    .empty { color: #9ca3af; font-style: italic; padding: 8px 0; }
    @media print {
      body { padding: 20px; }
      h2 { break-after: avoid; }
      table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Care Summary</h1>
      <p class="subtitle">Generated ${dateStr} by CareCompanion</p>
    </div>
    <div class="patient-info">
      <span><strong>${profile.patientName || 'Patient'}</strong></span>
      ${profile.patientAge ? `<span>Age: ${profile.patientAge}</span>` : ''}
      ${profile.relationship ? `<span>Caregiver relationship: ${profile.relationship}</span>` : ''}
    </div>
  </div>

  ${profile.cancerType || profile.cancerStage || profile.treatmentPhase ? `
  <div style="margin-bottom: 16px;">
    ${profile.cancerType ? `<span class="badge badge-cancer">${profile.cancerType}</span>` : ''}
    ${profile.cancerStage ? `<span class="badge badge-stage">Stage ${profile.cancerStage}</span>` : ''}
    ${profile.treatmentPhase ? `<span class="badge badge-phase">${profile.treatmentPhase.replace(/_/g, ' ')}</span>` : ''}
  </div>` : ''}

  ${profile.conditions ? `<p style="margin-bottom: 8px; font-size: 14px;"><strong>Conditions:</strong> ${profile.conditions}</p>` : ''}
  ${profile.allergies ? `<p style="margin-bottom: 16px; font-size: 14px; color: #dc2626;"><strong>Allergies:</strong> ${profile.allergies}</p>` : ''}

  <h2>Medications (${meds.length})</h2>
  ${meds.length > 0 ? `
  <table>
    <thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Prescriber</th><th>Refill Date</th></tr></thead>
    <tbody>
      ${meds.map(m => `<tr>
        <td>${m.name}</td>
        <td>${m.dose || '—'}</td>
        <td>${m.frequency || '—'}</td>
        <td>${m.prescribingDoctor || '—'}</td>
        <td>${m.refillDate || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No medications recorded</p>'}

  <h2>Care Team (${docs.length})</h2>
  ${docs.length > 0 ? `
  <table>
    <thead><tr><th>Doctor</th><th>Specialty</th><th>Phone</th></tr></thead>
    <tbody>
      ${docs.map(d => `<tr>
        <td>${d.name}</td>
        <td>${d.specialty || '—'}</td>
        <td>${d.phone || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No doctors recorded</p>'}

  <h2>Upcoming Appointments (${futureAppts.length})</h2>
  ${futureAppts.length > 0 ? `
  <table>
    <thead><tr><th>Date</th><th>Doctor</th><th>Purpose</th><th>Location</th></tr></thead>
    <tbody>
      ${futureAppts.map(a => `<tr>
        <td>${a.dateTime ? new Date(a.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
        <td>${a.doctorName || '—'}</td>
        <td>${a.purpose || '—'}</td>
        <td>${a.location || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No upcoming appointments</p>'}

  <h2>Recent Lab Results (${labs.length})</h2>
  ${abnormalLabs.length > 0 ? `<p style="color: #dc2626; font-size: 13px; margin-bottom: 8px;">⚠️ ${abnormalLabs.length} abnormal result(s)</p>` : ''}
  ${labs.length > 0 ? `
  <table>
    <thead><tr><th>Test</th><th>Value</th><th>Reference Range</th><th>Date</th><th>Status</th></tr></thead>
    <tbody>
      ${labs.map(l => `<tr>
        <td>${l.testName}</td>
        <td${l.isAbnormal ? ' class="abnormal"' : ''}>${l.value || '—'} ${l.unit || ''}</td>
        <td>${l.referenceRange || '—'}</td>
        <td>${l.dateTaken || '—'}</td>
        <td${l.isAbnormal ? ' class="abnormal"' : ''}>${l.isAbnormal ? '⚠️ Abnormal' : 'Normal'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No lab results recorded</p>'}

  ${claimsData.length > 0 ? `
  <h2>Recent Claims (${claimsData.length})</h2>
  <table>
    <thead><tr><th>Date</th><th>Provider</th><th>Billed</th><th>Status</th></tr></thead>
    <tbody>
      ${claimsData.map(c => `<tr>
        <td>${c.serviceDate || '—'}</td>
        <td>${c.providerName || '—'}</td>
        <td>${c.billedAmount ? '$' + Number(c.billedAmount).toLocaleString() : '—'}</td>
        <td>${c.status}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${profile.emergencyContactName ? `
  <h2>Emergency Contact</h2>
  <p style="font-size: 14px;">${profile.emergencyContactName}${profile.emergencyContactPhone ? ` — ${profile.emergencyContactPhone}` : ''}</p>
  ` : ''}

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This document was generated by CareCompanion AI for informational purposes only.
    It is not a medical record. Always consult your healthcare team for medical decisions.
    Verify all information against your official medical records.
  </div>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="care-summary-${profile.patientName?.replace(/\s+/g, '-').toLowerCase() || 'patient'}-${now.toISOString().split('T')[0]}.html"`,
      },
    })
  } catch (error) {
    console.error('[export-pdf] Error:', error)
    return ApiErrors.internal()
  }
}
