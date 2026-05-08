/**
 * Export care summary as a downloadable PDF-ready HTML document.
 * Generates a printable care summary with medications, appointments, labs, conditions.
 * Returns HTML that can be printed to PDF from the browser.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import {
  careProfiles,
  medications,
  doctors,
  appointments,
  labResults,
  claims,
  wellnessCheckins,
  symptomInsights,
  reminderLogs,
} from '@/lib/db/schema'
import { eq, asc, desc, and, gte, isNull } from 'drizzle-orm'
import { ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export const maxDuration = 60

const limiter = rateLimit({ interval: 60000, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const url = new URL(req.url)
    const careProfileId = url.searchParams.get('careProfileId')
    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90)
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // If careProfileId is provided, use it; otherwise fall back to user's profile
    let profileQuery
    if (careProfileId) {
      profileQuery = db.select().from(careProfiles)
        .where(and(eq(careProfiles.id, careProfileId), eq(careProfiles.userId, dbUser!.id)))
        .limit(1)
    } else {
      profileQuery = db.select().from(careProfiles)
        .where(eq(careProfiles.userId, dbUser!.id))
        .limit(1)
    }

    const [profile] = await profileQuery

    if (!profile) return ApiErrors.notFound('Care profile')

    const [meds, docs, appts, labs, claimsData, checkins, insights, reminders] = await Promise.all([
      db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt))).orderBy(asc(medications.name)).catch(() => []),
      db.select().from(doctors).where(and(eq(doctors.careProfileId, profile.id), isNull(doctors.deletedAt))).orderBy(asc(doctors.name)).catch(() => []),
      db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt))).orderBy(asc(appointments.dateTime)).catch(() => []),
      db.select().from(labResults).where(eq(labResults.userId, dbUser!.id)).orderBy(desc(labResults.dateTaken)).limit(30).catch(() => []),
      db.select().from(claims).where(and(eq(claims.userId, dbUser!.id), isNull(claims.deletedAt))).orderBy(desc(claims.serviceDate)).limit(20).catch(() => []),
      db.select().from(wellnessCheckins)
        .where(and(eq(wellnessCheckins.careProfileId, profile.id), gte(wellnessCheckins.checkedInAt, sinceDate)))
        .orderBy(desc(wellnessCheckins.checkedInAt)).limit(100).catch(() => []),
      db.select().from(symptomInsights)
        .where(and(eq(symptomInsights.careProfileId, profile.id), gte(symptomInsights.createdAt, sinceDate)))
        .orderBy(desc(symptomInsights.createdAt)).limit(20).catch(() => []),
      db.select().from(reminderLogs)
        .where(and(eq(reminderLogs.userId, dbUser!.id), gte(reminderLogs.scheduledTime, sinceDate)))
        .limit(200).catch(() => []),
    ])

    // Compute medication adherence
    const totalReminders = reminders.length
    const takenReminders = reminders.filter(r => r.status === 'taken').length
    const adherenceRate = totalReminders > 0 ? Math.round((takenReminders / totalReminders) * 100) : null

    // Compute symptom averages
    const avgPain = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.pain, 0) / checkins.length).toFixed(1)
      : null
    const avgMood = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.mood, 0) / checkins.length).toFixed(1)
      : null

    // Energy & sleep breakdowns
    const energyCounts = { low: 0, med: 0, high: 0 }
    for (const c of checkins) {
      if (c.energy in energyCounts) energyCounts[c.energy as keyof typeof energyCounts]++
    }
    const sleepCounts = { bad: 0, ok: 0, good: 0 }
    for (const c of checkins) {
      if (c.sleep in sleepCounts) sleepCounts[c.sleep as keyof typeof sleepCounts]++
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const futureAppts = appts.filter(a => a.dateTime && new Date(a.dateTime) > now)
    const abnormalLabs = labs.filter(l => l.isAbnormal)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Care Summary — ${escapeHtml(profile.patientName) || 'Patient'}</title>
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
      <span><strong>${escapeHtml(profile.patientName) || 'Patient'}</strong></span>
      ${profile.patientAge ? `<span>Age: ${escapeHtml(String(profile.patientAge))}</span>` : ''}
      ${profile.relationship ? `<span>Caregiver relationship: ${escapeHtml(profile.relationship)}</span>` : ''}
    </div>
  </div>

  ${profile.cancerType || profile.cancerStage || profile.treatmentPhase ? `
  <div style="margin-bottom: 16px;">
    ${profile.cancerType ? `<span class="badge badge-cancer">${escapeHtml(profile.cancerType)}</span>` : ''}
    ${profile.cancerStage ? `<span class="badge badge-stage">Stage ${escapeHtml(profile.cancerStage)}</span>` : ''}
    ${profile.treatmentPhase ? `<span class="badge badge-phase">${escapeHtml(profile.treatmentPhase).replace(/_/g, ' ')}</span>` : ''}
  </div>` : ''}

  ${profile.conditions ? `<p style="margin-bottom: 8px; font-size: 14px;"><strong>Conditions:</strong> ${escapeHtml(profile.conditions)}</p>` : ''}
  ${profile.allergies ? `<p style="margin-bottom: 16px; font-size: 14px; color: #dc2626;"><strong>Allergies:</strong> ${escapeHtml(profile.allergies)}</p>` : ''}

  <h2>Medications (${meds.length})</h2>
  ${meds.length > 0 ? `
  <table>
    <thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Prescriber</th><th>Refill Date</th></tr></thead>
    <tbody>
      ${meds.map(m => `<tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.dose) || '—'}</td>
        <td>${escapeHtml(m.frequency) || '—'}</td>
        <td>${escapeHtml(m.prescribingDoctor) || '—'}</td>
        <td>${escapeHtml(m.refillDate) || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No medications recorded</p>'}

  <h2>Care Team (${docs.length})</h2>
  ${docs.length > 0 ? `
  <table>
    <thead><tr><th>Doctor</th><th>Specialty</th><th>Phone</th></tr></thead>
    <tbody>
      ${docs.map(d => `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.specialty) || '—'}</td>
        <td>${escapeHtml(d.phone) || '—'}</td>
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
        <td>${escapeHtml(a.doctorName) || '—'}</td>
        <td>${escapeHtml(a.purpose) || '—'}</td>
        <td>${escapeHtml(a.location) || '—'}</td>
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
        <td>${escapeHtml(l.testName)}</td>
        <td${l.isAbnormal ? ' class="abnormal"' : ''}>${escapeHtml(l.value) || '—'} ${escapeHtml(l.unit)}</td>
        <td>${escapeHtml(l.referenceRange) || '—'}</td>
        <td>${escapeHtml(l.dateTaken) || '—'}</td>
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
        <td>${escapeHtml(c.serviceDate) || '—'}</td>
        <td>${escapeHtml(c.providerName) || '—'}</td>
        <td>${c.billedAmount ? '$' + Number(c.billedAmount).toLocaleString() : '—'}</td>
        <td>${escapeHtml(c.status)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${checkins.length > 0 ? `
  <h2>Symptom Trends (Last ${days} Days — ${checkins.length} check-ins)</h2>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 16px;">
    <div style="background:#f8f7ff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#6366F1;">${avgPain ?? 'N/A'}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;">Avg Pain (0-10)</div>
    </div>
    <div style="background:#f8f7ff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#6366F1;">${avgMood ?? 'N/A'}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;">Avg Mood (1-5)</div>
    </div>
    <div style="background:#f8f7ff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#6366F1;">${adherenceRate !== null ? adherenceRate + '%' : 'N/A'}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;">Med Adherence</div>
    </div>
    <div style="background:#f8f7ff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#6366F1;">${profile.checkinStreak ?? 0}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;">Day Streak</div>
    </div>
  </div>
  <p style="font-size:12px;color:#555;margin-bottom:4px;">
    <strong>Energy:</strong> Low ${energyCounts.low}x, Med ${energyCounts.med}x, High ${energyCounts.high}x &middot;
    <strong>Sleep:</strong> Bad ${sleepCounts.bad}x, OK ${sleepCounts.ok}x, Good ${sleepCounts.good}x
  </p>
  <table>
    <thead><tr><th>Date</th><th>Mood</th><th>Pain</th><th>Energy</th><th>Sleep</th><th>Notes</th></tr></thead>
    <tbody>
      ${checkins.slice(0, 14).map(c => {
        const d = new Date(c.checkedInAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `<tr><td>${d}</td><td>${c.mood}/5</td><td>${c.pain}/10</td><td>${escapeHtml(c.energy)}</td><td>${escapeHtml(c.sleep)}</td><td>${escapeHtml(c.notes) || '—'}</td></tr>`
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  ${insights.length > 0 ? `
  <h2>AI Insights</h2>
  <ul style="padding-left:18px;">
    ${insights.map(i => `<li style="margin:6px 0;"><strong>${escapeHtml(i.title)}</strong> <span style="font-size:10px;font-weight:600;color:${(i.severity === 'alert' || i.severity === 'critical') ? '#dc2626' : (i.severity === 'watch' || i.severity === 'warning') ? '#d97706' : '#6366F1'};">[${escapeHtml(i.severity)}]</span><br/>${escapeHtml(i.body)}</li>`).join('')}
  </ul>
  ` : ''}

  ${profile.emergencyContactName ? `
  <h2>Emergency Contact</h2>
  <p style="font-size: 14px;">${escapeHtml(profile.emergencyContactName)}${profile.emergencyContactPhone ? ` — ${escapeHtml(profile.emergencyContactPhone)}` : ''}</p>
  ` : ''}

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This document was generated by CareCompanion AI for informational purposes only.
    It is not a medical record. Always consult your healthcare team for medical decisions.
    Verify all information against your official medical records.
  </div>
</body>
</html>`

    logger.info('pdf_export_generated', { userId: dbUser!.id, careProfileId: profile.id, days, checkins: checkins.length })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="care-summary-${profile.patientName?.replace(/\s+/g, '-').toLowerCase() || 'patient'}-${now.toISOString().split('T')[0]}.html"`,
      },
    })
  } catch (error) {
    logger.error('pdf_export_failed', { error: error instanceof Error ? error.message : String(error) })
    return ApiErrors.internal()
  }
}
