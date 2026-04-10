import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const importSchema = z.object({
  medications: z.array(z.object({
    name: z.string(),
    dose: z.string().optional(),
    frequency: z.string().optional(),
  })).optional(),
  appointments: z.array(z.object({
    doctor_name: z.string(),
    specialty: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  lab_results: z.array(z.object({
    test_name: z.string(),
    value: z.string().optional(),
    unit: z.string().optional(),
    reference_range: z.string().optional(),
    is_abnormal: z.boolean().optional(),
    date_taken: z.string().optional(),
  })).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid import format', details: parsed.error.issues }, { status: 400 })
  }

  const { data: profile } = await supabase.from('care_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

  const results = { medications: 0, appointments: 0, lab_results: 0 }

  if (parsed.data.medications?.length) {
    const { data } = await supabase.from('medications').insert(
      parsed.data.medications.map(m => ({ ...m, care_profile_id: profile.id }))
    ).select()
    results.medications = data?.length || 0
  }

  if (parsed.data.appointments?.length) {
    const { data } = await supabase.from('appointments').insert(
      parsed.data.appointments.map(a => ({ ...a, care_profile_id: profile.id }))
    ).select()
    results.appointments = data?.length || 0
  }

  if (parsed.data.lab_results?.length) {
    const { data } = await supabase.from('lab_results').insert(
      parsed.data.lab_results.map(l => ({ ...l, user_id: user.id }))
    ).select()
    results.lab_results = data?.length || 0
  }

  return NextResponse.json({ imported: results })
}
