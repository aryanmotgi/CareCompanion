import { z } from 'zod';
import { tool } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Build all CareCompanion tools for a given user session.
 * Each tool can read/write to Supabase on behalf of the user.
 */
export function buildTools(userId: string, careProfileId: string | null) {
  const admin = createAdminClient();

  return {
    // ============================================================
    // MEDICATION TOOLS
    // ============================================================
    save_medication: tool({
      description: 'Save a new medication to the patient\'s care profile. Use when the caregiver mentions a new medication, or when extracting from a photo scan.',
      inputSchema: z.object({
        name: z.string().describe('Medication name (e.g. Metformin, Lisinopril)'),
        dose: z.string().optional().describe('Dosage (e.g. 500mg, 10mg)'),
        frequency: z.string().optional().describe('How often (e.g. twice daily, once at bedtime)'),
        prescribing_doctor: z.string().optional().describe('Name of prescribing doctor'),
        refill_date: z.string().optional().describe('Next refill date (YYYY-MM-DD)'),
        notes: z.string().optional().describe('Any additional notes'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found. Please complete setup first.' };
        const { error } = await admin.from('medications').insert({
          care_profile_id: careProfileId,
          ...params,
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Saved ${params.name}${params.dose ? ` ${params.dose}` : ''} to medications.` };
      },
    }),

    update_medication: tool({
      description: 'Update an existing medication (e.g. change dose, frequency, or refill date). Search by medication name.',
      inputSchema: z.object({
        name: z.string().describe('Name of the medication to update'),
        dose: z.string().optional().describe('New dosage'),
        frequency: z.string().optional().describe('New frequency'),
        refill_date: z.string().optional().describe('New refill date (YYYY-MM-DD)'),
        notes: z.string().optional().describe('Updated notes'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        const { name, ...updates } = params;
        const cleanUpdates = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined)
        );
        const { data, error } = await admin.from('medications')
          .update(cleanUpdates)
          .eq('care_profile_id', careProfileId)
          .ilike('name', name)
          .select();
        if (error) return { success: false, error: error.message };
        if (!data || data.length === 0) return { success: false, error: `No medication named "${name}" found.` };
        return { success: true, message: `Updated ${name}.` };
      },
    }),

    remove_medication: tool({
      description: 'Remove a medication from the care profile. Use when a doctor discontinues a medication.',
      inputSchema: z.object({
        name: z.string().describe('Name of the medication to remove'),
        reason: z.string().optional().describe('Why it was discontinued'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        const { error } = await admin.from('medications')
          .delete()
          .eq('care_profile_id', careProfileId)
          .ilike('name', params.name);
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Removed ${params.name} from medications.${params.reason ? ` Reason: ${params.reason}` : ''}` };
      },
    }),

    // ============================================================
    // APPOINTMENT TOOLS
    // ============================================================
    save_appointment: tool({
      description: 'Schedule a new appointment. Use when the caregiver mentions an upcoming visit or wants to book one.',
      inputSchema: z.object({
        doctor_name: z.string().describe('Doctor or provider name'),
        date_time: z.string().describe('Date and time (ISO format or natural like "next Tuesday at 2pm")'),
        purpose: z.string().optional().describe('Reason for visit'),
        location: z.string().optional().describe('Clinic or hospital name/address'),
        prep_notes: z.string().optional().describe('How to prepare for the visit'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        const { error } = await admin.from('appointments').insert({
          care_profile_id: careProfileId,
          ...params,
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Scheduled appointment with ${params.doctor_name}${params.date_time ? ` on ${params.date_time}` : ''}.` };
      },
    }),

    // ============================================================
    // DOCTOR TOOLS
    // ============================================================
    save_doctor: tool({
      description: 'Add a new doctor or healthcare provider to the care profile.',
      inputSchema: z.object({
        name: z.string().describe('Doctor\'s full name'),
        specialty: z.string().optional().describe('Medical specialty (e.g. Cardiology, Primary Care)'),
        phone: z.string().optional().describe('Office phone number'),
        address: z.string().optional().describe('Office address'),
        notes: z.string().optional().describe('Any notes about this doctor'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        const { error } = await admin.from('doctors').insert({
          care_profile_id: careProfileId,
          ...params,
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Added Dr. ${params.name}${params.specialty ? ` (${params.specialty})` : ''} to care team.` };
      },
    }),

    // ============================================================
    // CARE PROFILE TOOLS
    // ============================================================
    update_care_profile: tool({
      description: 'Update the patient\'s care profile — conditions, allergies, age, or relationship.',
      inputSchema: z.object({
        conditions: z.string().optional().describe('New conditions to add (appends to existing)'),
        allergies: z.string().optional().describe('New allergies to add (appends to existing)'),
        patient_age: z.number().optional().describe('Patient\'s age'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        const updateData: Record<string, unknown> = {};

        // For conditions and allergies, append rather than replace
        if (params.conditions || params.allergies) {
          const { data: current } = await admin.from('care_profiles').select('conditions, allergies').eq('id', careProfileId).single();
          if (params.conditions) {
            updateData.conditions = current?.conditions
              ? `${current.conditions}, ${params.conditions}`
              : params.conditions;
          }
          if (params.allergies) {
            updateData.allergies = current?.allergies
              ? `${current.allergies}, ${params.allergies}`
              : params.allergies;
          }
        }
        if (params.patient_age !== undefined) {
          updateData.patient_age = params.patient_age;
        }

        const { error } = await admin.from('care_profiles').update(updateData).eq('id', careProfileId);
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Updated care profile.` };
      },
    }),

    // ============================================================
    // LAB RESULT TOOLS
    // ============================================================
    save_lab_result: tool({
      description: 'Save a lab test result. Use when the caregiver shares lab values from a report or conversation.',
      inputSchema: z.object({
        test_name: z.string().describe('Name of the test (e.g. A1C, TSH, CBC)'),
        value: z.string().describe('The result value'),
        unit: z.string().optional().describe('Unit of measurement (e.g. mg/dL, %)'),
        reference_range: z.string().optional().describe('Normal range (e.g. 4.0-5.6%)'),
        is_abnormal: z.boolean().describe('Whether this value is outside the normal range'),
        date_taken: z.string().optional().describe('Date the test was taken (YYYY-MM-DD)'),
      }),
      execute: async (params) => {
        const { error } = await admin.from('lab_results').insert({
          user_id: userId,
          ...params,
          source: 'conversation',
        });
        if (error) return { success: false, error: error.message };
        const flag = params.is_abnormal ? ' (flagged as abnormal)' : '';
        return { success: true, message: `Saved ${params.test_name}: ${params.value}${params.unit ? ` ${params.unit}` : ''}${flag}.` };
      },
    }),

    get_lab_trends: tool({
      description: 'Look up historical lab results for a specific test to show trends over time.',
      inputSchema: z.object({
        test_name: z.string().describe('Name of the test to look up (e.g. A1C, Blood Pressure, Cholesterol)'),
      }),
      execute: async (params) => {
        const { data, error } = await admin.from('lab_results')
          .select('test_name, value, unit, reference_range, is_abnormal, date_taken')
          .eq('user_id', userId)
          .ilike('test_name', `%${params.test_name}%`)
          .order('date_taken', { ascending: true });
        if (error) return { success: false, error: error.message };
        if (!data || data.length === 0) return { success: true, results: [], message: `No results found for "${params.test_name}".` };
        return { success: true, results: data, message: `Found ${data.length} result(s) for ${params.test_name}.` };
      },
    }),

    // ============================================================
    // INSURANCE TOOLS
    // ============================================================
    save_insurance: tool({
      description: 'Save or update insurance plan details.',
      inputSchema: z.object({
        provider: z.string().describe('Insurance company name (e.g. Blue Cross, Aetna, UnitedHealthcare)'),
        member_id: z.string().optional().describe('Member ID number'),
        group_number: z.string().optional().describe('Group number'),
        deductible_limit: z.number().optional().describe('Annual deductible amount'),
        oop_limit: z.number().optional().describe('Out-of-pocket maximum'),
      }),
      execute: async (params) => {
        const { error } = await admin.from('insurance').upsert({
          user_id: userId,
          ...params,
          plan_year: new Date().getFullYear(),
        }, { onConflict: 'id' });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Saved ${params.provider} insurance details.` };
      },
    }),

    // ============================================================
    // VISIT PREP & SUMMARY TOOLS
    // ============================================================
    generate_visit_prep: tool({
      description: 'Generate a pre-appointment prep sheet for an upcoming doctor visit. Gathers medications, recent labs, conditions, and suggests questions to ask. Use when the caregiver says they want to prepare for an appointment.',
      inputSchema: z.object({
        doctor_name: z.string().describe('Name of the doctor for the appointment'),
        purpose: z.string().optional().describe('Reason for the visit'),
        concerns: z.string().optional().describe('Any specific concerns the caregiver wants to bring up'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        // Gather all relevant data
        const [
          { data: profile },
          { data: meds },
          { data: labs },
          { data: recentMemories },
        ] = await Promise.all([
          admin.from('care_profiles').select('patient_name, patient_age, conditions, allergies').eq('id', careProfileId).single(),
          admin.from('medications').select('name, dose, frequency, prescribing_doctor').eq('care_profile_id', careProfileId),
          admin.from('lab_results').select('test_name, value, unit, reference_range, is_abnormal, date_taken').eq('user_id', userId).order('date_taken', { ascending: false }).limit(15),
          admin.from('memories').select('fact, category').eq('user_id', userId).order('last_referenced', { ascending: false }).limit(20),
        ]);

        return {
          success: true,
          prep_data: {
            patient: profile,
            doctor: params.doctor_name,
            purpose: params.purpose || 'General visit',
            concerns: params.concerns,
            medications: meds || [],
            recent_labs: labs || [],
            relevant_memories: (recentMemories || []).map((m) => m.fact),
          },
          message: `Prepared visit summary for appointment with ${params.doctor_name}. I'll format this as a prep sheet now.`,
          instructions: 'Format this data as a clear, printable appointment prep sheet with sections: Patient Info, Current Medications, Recent Lab Results (flag abnormals), Questions to Ask (generate 3-5 based on the data and concerns), and Things to Bring.',
        };
      },
    }),

    save_visit_notes: tool({
      description: 'Save notes from a completed doctor visit. Use after the caregiver returns from an appointment and shares what happened.',
      inputSchema: z.object({
        doctor_name: z.string().describe('Name of the doctor seen'),
        visit_date: z.string().describe('Date of the visit (YYYY-MM-DD)'),
        summary: z.string().describe('Brief summary of what was discussed'),
        medication_changes: z.string().optional().describe('Any medications added, changed, or stopped'),
        follow_up_date: z.string().optional().describe('Date of next follow-up (YYYY-MM-DD)'),
        follow_up_instructions: z.string().optional().describe('Any instructions or things to watch for'),
        referrals: z.string().optional().describe('Any referrals to other doctors or specialists'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        // Find the matching appointment and update it with follow-up notes
        const { data: appointments } = await admin.from('appointments')
          .select('id')
          .eq('care_profile_id', careProfileId)
          .ilike('doctor_name', params.doctor_name)
          .order('date_time', { ascending: false })
          .limit(1);

        const followUpNotes = [
          params.summary,
          params.medication_changes ? `Medication changes: ${params.medication_changes}` : null,
          params.follow_up_instructions ? `Follow-up: ${params.follow_up_instructions}` : null,
          params.referrals ? `Referrals: ${params.referrals}` : null,
        ].filter(Boolean).join('\n');

        if (appointments && appointments.length > 0) {
          await admin.from('appointments')
            .update({ follow_up_notes: followUpNotes })
            .eq('id', appointments[0].id);
        }

        // Schedule follow-up appointment if provided
        if (params.follow_up_date) {
          await admin.from('appointments').insert({
            care_profile_id: careProfileId,
            doctor_name: params.doctor_name,
            date_time: params.follow_up_date,
            purpose: 'Follow-up',
            prep_notes: params.follow_up_instructions || null,
          });
        }

        // Save visit notes as memories
        const memoryFacts: Array<{ category: string; fact: string }> = [
          { category: 'appointment', fact: `Visited ${params.doctor_name} on ${params.visit_date}: ${params.summary}` },
        ];
        if (params.medication_changes) {
          memoryFacts.push({ category: 'medication', fact: `${params.visit_date} — ${params.doctor_name}: ${params.medication_changes}` });
        }
        if (params.referrals) {
          memoryFacts.push({ category: 'provider', fact: `${params.doctor_name} referred to: ${params.referrals}` });
        }

        await admin.from('memories').insert(
          memoryFacts.map((m) => ({
            user_id: userId,
            care_profile_id: careProfileId,
            category: m.category,
            fact: m.fact,
            source: 'conversation',
            confidence: 'high',
          }))
        );

        // Log activity for care team (table may not exist yet)
        try {
          await admin.from('care_team_activity').insert({
            care_profile_id: careProfileId,
            user_id: userId,
            action: `added visit notes from ${params.doctor_name} (${params.visit_date})`,
          });
        } catch { /* care_team_activity might not exist yet */ }

        const parts = [`Saved visit notes from ${params.doctor_name}.`];
        if (params.follow_up_date) parts.push(`Follow-up scheduled for ${params.follow_up_date}.`);
        if (params.medication_changes) parts.push(`Medication changes noted.`);
        return { success: true, message: parts.join(' ') };
      },
    }),

    // ============================================================
    // MEMORY TOOLS
    // ============================================================
    save_memory: tool({
      description: 'Explicitly save an important fact to long-term memory. Use for critical information the caregiver wants remembered.',
      inputSchema: z.object({
        category: z.enum(['medication', 'condition', 'allergy', 'insurance', 'financial', 'appointment', 'preference', 'family', 'provider', 'lab_result', 'lifestyle', 'legal', 'other']),
        fact: z.string().describe('The specific fact to remember'),
      }),
      execute: async (params) => {
        const { error } = await admin.from('memories').insert({
          user_id: userId,
          care_profile_id: careProfileId,
          category: params.category,
          fact: params.fact,
          source: 'conversation',
          confidence: 'high',
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `Remembered: "${params.fact}"` };
      },
    }),

    // ============================================================
    // MEDICATION REMINDER TOOLS
    // ============================================================
    set_medication_reminder: tool({
      description: 'Set a daily reminder to take a medication at specific times. Use when the caregiver wants to be reminded about a medication.',
      inputSchema: z.object({
        medication_name: z.string().describe('Name of the medication'),
        dose: z.string().optional().describe('Dosage to take'),
        reminder_times: z.array(z.string()).describe('Times to take the medication in 24h format, e.g. ["08:00", "20:00"]'),
        days_of_week: z.array(z.string()).optional().describe('Days to remind, e.g. ["mon","wed","fri"]. Defaults to every day.'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        // Find the medication
        const { data: med } = await admin.from('medications')
          .select('id')
          .eq('care_profile_id', careProfileId)
          .ilike('name', `%${params.medication_name}%`)
          .limit(1)
          .single();

        if (!med) return { success: false, error: `Medication "${params.medication_name}" not found. Add it first.` };

        const { error } = await admin.from('medication_reminders').upsert({
          user_id: userId,
          medication_id: med.id,
          medication_name: params.medication_name,
          dose: params.dose || null,
          reminder_times: params.reminder_times,
          days_of_week: params.days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          is_active: true,
        }, { onConflict: 'user_id,medication_id' });

        if (error) return { success: false, error: error.message };
        const timesStr = params.reminder_times.map((t) => {
          const [h, m] = t.split(':').map(Number);
          return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
        }).join(', ');
        return { success: true, message: `Reminder set for ${params.medication_name} at ${timesStr}.` };
      },
    }),

    // ============================================================
    // SYMPTOM JOURNAL TOOLS
    // ============================================================
    log_symptoms: tool({
      description: 'Log a daily symptom journal entry. Use when the caregiver reports symptoms, pain, mood, sleep, or energy levels.',
      inputSchema: z.object({
        pain_level: z.number().min(0).max(10).optional().describe('Pain level 0-10 (0=none, 10=worst)'),
        mood: z.enum(['great', 'good', 'okay', 'bad', 'terrible']).optional().describe('Overall mood'),
        sleep_quality: z.enum(['great', 'good', 'fair', 'poor', 'terrible']).optional().describe('Sleep quality last night'),
        sleep_hours: z.number().optional().describe('Hours of sleep'),
        appetite: z.enum(['normal', 'increased', 'decreased', 'none']).optional().describe('Appetite level'),
        energy: z.enum(['high', 'normal', 'low', 'very_low']).optional().describe('Energy level'),
        symptoms: z.array(z.string()).optional().describe('List of symptoms, e.g. ["headache", "nausea", "dizziness"]'),
        notes: z.string().optional().describe('Any additional notes about how they feel'),
      }),
      execute: async (params) => {
        const today = new Date().toISOString().split('T')[0];
        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        );

        const { error } = await admin.from('symptom_entries').upsert({
          user_id: userId,
          care_profile_id: careProfileId,
          date: today,
          ...cleanParams,
        }, { onConflict: 'user_id,date' });

        if (error) return { success: false, error: error.message };

        const parts = [];
        if (params.pain_level !== undefined) parts.push(`pain: ${params.pain_level}/10`);
        if (params.mood) parts.push(`mood: ${params.mood}`);
        if (params.sleep_quality) parts.push(`sleep: ${params.sleep_quality}`);
        if (params.symptoms?.length) parts.push(`symptoms: ${params.symptoms.join(', ')}`);
        return { success: true, message: `Logged today's check-in${parts.length ? ` (${parts.join(', ')})` : ''}.` };
      },
    }),

    get_symptom_trends: tool({
      description: 'Look up symptom journal entries over time to identify trends and patterns.',
      inputSchema: z.object({
        days: z.number().optional().describe('Number of days to look back (default 14)'),
      }),
      execute: async (params) => {
        const daysBack = params.days || 14;
        const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data, error } = await admin.from('symptom_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('date', since)
          .order('date', { ascending: true });

        if (error) return { success: false, error: error.message };
        if (!data || data.length === 0) return { success: true, entries: [], message: `No symptom entries in the last ${daysBack} days.` };

        return {
          success: true,
          entries: data,
          message: `Found ${data.length} entries over the last ${daysBack} days.`,
          instructions: 'Analyze these entries for patterns. Look for: pain trends, sleep correlation with mood, recurring symptoms, and anything the caregiver should discuss with their doctor.',
        };
      },
    }),

    // ============================================================
    // HEALTH SUMMARY TOOL
    // ============================================================
    generate_health_summary: tool({
      description: 'Generate a comprehensive health summary document for sharing with a doctor. Use when the caregiver asks to create a summary, export health records, or prepare for a new doctor visit.',
      inputSchema: z.object({
        reason: z.string().optional().describe('Why the summary is being generated, e.g. "new specialist visit", "ER visit", "annual checkup"'),
      }),
      execute: async () => {
        return {
          success: true,
          message: 'Health summary is being generated. Redirecting to the summary page...',
          redirect: '/health-summary',
          instructions: 'Tell the user their health summary is ready and they can view, print, or share it from the Health Summary page. Mention they can access it anytime from the profile menu.',
        };
      },
    }),

    // ============================================================
    // COST ESTIMATOR TOOL
    // ============================================================
    estimate_cost: tool({
      description: 'Estimate out-of-pocket cost for a medical procedure or service based on the patient\'s insurance. Use when the caregiver asks "how much will X cost" or "what will I pay for Y".',
      inputSchema: z.object({
        procedure: z.string().describe('The procedure or service (e.g. "MRI of knee", "physical therapy session", "specialist visit")'),
        estimated_total: z.number().optional().describe('Estimated total cost if known'),
      }),
      execute: async (params) => {
        // Fetch insurance data
        const { data: insurance } = await admin.from('insurance')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (!insurance) {
          return {
            success: true,
            has_insurance: false,
            procedure: params.procedure,
            message: 'No insurance on file. Add insurance details so I can estimate costs.',
            instructions: 'Tell the user to add their insurance information first, either through the chat or Connected Accounts page.',
          };
        }

        const deductibleRemaining = (insurance.deductible_limit || 0) - (insurance.deductible_used || 0);
        const oopRemaining = (insurance.oop_limit || 0) - (insurance.oop_used || 0);
        const deductibleMet = deductibleRemaining <= 0;

        return {
          success: true,
          has_insurance: true,
          procedure: params.procedure,
          estimated_total: params.estimated_total || null,
          insurance_data: {
            provider: insurance.provider,
            deductible_limit: insurance.deductible_limit,
            deductible_used: insurance.deductible_used,
            deductible_remaining: Math.max(0, deductibleRemaining),
            deductible_met: deductibleMet,
            oop_limit: insurance.oop_limit,
            oop_used: insurance.oop_used,
            oop_remaining: Math.max(0, oopRemaining),
          },
          message: `Retrieved insurance details for cost estimate.`,
          instructions: `Estimate the out-of-pocket cost for "${params.procedure}" using this insurance data. Explain:
1. Typical cost range for this procedure
2. Whether the deductible has been met ($${insurance.deductible_used}/$${insurance.deductible_limit})
3. Estimated patient responsibility based on deductible status (if not met, patient pays full cost up to deductible; if met, typically 20% coinsurance)
4. How close they are to out-of-pocket max ($${insurance.oop_used}/$${insurance.oop_limit})
5. Tips to reduce cost (in-network, prior auth, price shopping)
Always add: "These are estimates based on typical costs. Your actual cost depends on your specific plan, network status, and provider charges. Contact your insurance for an exact quote."`,
        };
      },
    }),
  };
}
