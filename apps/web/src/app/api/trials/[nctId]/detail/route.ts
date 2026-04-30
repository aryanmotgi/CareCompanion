import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getTrialDetails } from '@/lib/trials/tools'
import { assembleProfile } from '@/lib/trials/assembleProfile'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const bodySchema = z.object({
  isCloseMatch: z.boolean().default(false),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nctId: string }> }
) {
  const { user, error } = await getAuthenticatedUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json().catch(() => ({})))
  const isCloseMatch = body.success ? body.data.isCloseMatch : false

  const { nctId } = await params

  const [profileRow] = await db.select({ id: careProfiles.id })
    .from(careProfiles).where(eq(careProfiles.userId, user.id)).limit(1)
  if (!profileRow) return NextResponse.json({ error: 'No care profile' }, { status: 404 })

  // Fetch trial + patient profile in parallel
  const [trial, patient] = await Promise.all([
    getTrialDetails(nctId),
    assembleProfile(profileRow.id),
  ])

  if ('error' in trial) return NextResponse.json({ error: trial.error }, { status: 502 })

  const t = trial as Record<string, unknown>

  // Pull coordinator contact — prefer centralContacts, fall back to first location contact
  type Contact = { name: string | null; phone: string | null; email: string | null }
  const central = (t.central_contacts as Contact[] | undefined) ?? []
  const locationContacts = ((t.locations as Array<{ contacts?: Contact[] }> | undefined) ?? [])
    .flatMap(l => l.contacts ?? [])
  const allContacts: Contact[] = [...central, ...locationContacts].filter(
    c => c.name || c.email || c.phone
  )
  const primaryContact = allContacts[0] ?? null

  const mutationLines = patient.mutations.length > 0
    ? patient.mutations.map(m => `${m.name}: ${m.status} (${m.confidence} confidence, source: ${m.source})`).join('; ')
    : 'None documented'

  const priorLines = patient.priorTreatmentLines.length > 0
    ? patient.priorTreatmentLines.map(p => `${p.regimen} (${p.cycleCount} cycles)`).join('; ')
    : 'None documented'

  const emailTo = primaryContact?.email ?? null
  const emailSubject = `Inquiry Regarding ${nctId} — ${patient.cancerType ?? 'Cancer'} Patient`

  const closeMatchEmailCTA = isCloseMatch
    ? `We are not yet eligible but are actively tracking this trial. We would like to understand the enrollment timeline and whether there are any steps we can take now to prepare for eligibility.`
    : `We are inquiring about eligibility and next steps for enrolling in this trial.`

  const prompt = `You are helping a family caregiver communicate about a clinical trial. Generate three pieces of content based on the trial and patient information below.

## Trial Information
Title: ${t.title}
NCT ID: ${nctId}
Phase: ${t.phase}
Status: ${t.status}
Sponsor: ${t.organization}
Summary: ${t.brief_summary}
Detailed description: ${t.detailed_description ?? ''}
Eligibility criteria: ${t.eligibility_criteria ?? ''}
Interventions: ${(t.interventions as Array<{type: string; name: string}> | undefined)?.map(i => `${i.type}: ${i.name}`).join(', ') ?? 'Not listed'}

## Patient Information
Name: ${patient.cancerType ? 'Patient' : 'Patient'} (use "my [relationship]" or "the patient" in writing)
Cancer type: ${patient.cancerType ?? 'Unknown'}
Stage: ${patient.cancerStage ?? 'Unknown'}
Age: ${patient.age ?? 'Unknown'}
Mutations: ${mutationLines}
Current medications: ${patient.currentMedications.join(', ') || 'None listed'}
Prior treatment lines: ${priorLines}
Location: ${patient.city ?? ''} ${patient.state ?? ''}

## Generate exactly this JSON structure (no markdown, raw JSON only):
{
  "summary": "<3 sentences: (1) what the trial is testing, (2) what participation looks like week to week for the patient, (3) what the potential benefit is. Written for a non-medical caregiver — no jargon, no abbreviations.>",
  "visit_frequency": "<One sentence describing how often the patient would need to visit, based on the trial description. If not mentioned, say: 'Visit schedule not specified — ask the coordinator for details.'>",
  "email_body": "<Email body addressed to the trial team. Opening: Dear [Trial Coordinator / Research Team]. Introduce the caregiver and patient (name optional — caregiver's choice). Include: cancer type, stage, age, key mutations (with confidence level), prior treatment lines, current medications. Closing ask: ${closeMatchEmailCTA} Sign off professionally. 3–5 short paragraphs, plain language.>",
  "phone_script": "<Short plain language phone script the caregiver reads aloud. Structure: (1) who they are and who the patient is, (2) why they are calling and the trial NCT ID, (3) exactly 3 questions to ask about eligibility, enrollment timeline, and next steps. Conversational tone. 150–200 words max.>"
}`

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt,
  })

  let generated: { summary: string; visit_frequency: string; email_body: string; phone_script: string }
  try {
    // Strip any accidental markdown fencing
    const cleaned = text.replace(/^```json\n?|\n?```$/g, '').trim()
    generated = JSON.parse(cleaned)
  } catch {
    // Fallback if JSON parse fails
    generated = {
      summary: t.brief_summary as string ?? 'Summary not available.',
      visit_frequency: 'Visit schedule not specified — ask the coordinator for details.',
      email_body: `Dear Trial Coordinator,\n\nI am writing on behalf of a patient with ${patient.cancerType ?? 'cancer'} (${patient.cancerStage ?? 'unknown stage'}) to inquire about eligibility for trial ${nctId}.\n\n${closeMatchEmailCTA}\n\nThank you for your time.`,
      phone_script: `Hello, my name is [your name] and I'm calling about clinical trial ${nctId}. I'm a caregiver for a patient with ${patient.cancerType ?? 'cancer'}, ${patient.cancerStage ?? ''}, age ${patient.age ?? 'unknown'}. I'd like to ask: (1) Does this patient meet your eligibility criteria? (2) When do you expect enrollment to open? (3) What are the next steps to apply?`,
    }
  }

  return NextResponse.json({
    trial,
    contact: primaryContact,
    all_contacts: allContacts.slice(0, 3),
    email: {
      to:      emailTo,
      subject: emailSubject,
      body:    generated.email_body,
    },
    summary:         generated.summary,
    visit_frequency: generated.visit_frequency,
    phone_script:    generated.phone_script,
  })
}
