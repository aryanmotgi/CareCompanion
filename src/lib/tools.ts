import { z } from 'zod';
import { tool } from 'ai';
import { db } from '@/lib/db';
import {
  medications,
  appointments,
  doctors,
  careProfiles,
  labResults,
  insurance,
  memories,
  medicationReminders,
  symptomEntries,
  careTeamActivity,
} from '@/lib/db/schema';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';

/**
 * Build all CareCompanion tools for a given user session.
 * Each tool reads/writes to the database on behalf of the user.
 */
export function buildTools(userId: string, careProfileId: string | null) {
  return {
    // ============================================================
    // MEDICATION TOOLS
    // ============================================================
    save_medication: tool({
      description: 'Save a new medication to the patient\'s care profile. Use when the caregiver mentions a new medication, or when extracting from a photo scan.',
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe('Medication name (e.g. Metformin, Lisinopril)'),
        dose: z.string().max(100).optional().describe('Dosage (e.g. 500mg, 10mg)'),
        frequency: z.string().max(200).optional().describe('How often (e.g. twice daily, once at bedtime)'),
        prescribing_doctor: z.string().max(200).optional().describe('Name of prescribing doctor'),
        refill_date: z.string().max(20).optional().describe('Next refill date (YYYY-MM-DD)'),
        notes: z.string().max(1000).optional().describe('Any additional notes'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found. Please complete setup first.' };
        try {
          await db.insert(medications).values({
            careProfileId,
            name: params.name,
            dose: params.dose,
            frequency: params.frequency,
            prescribingDoctor: params.prescribing_doctor,
            refillDate: params.refill_date,
            notes: params.notes,
          });
          return { success: true, message: `Saved ${params.name}${params.dose ? ` ${params.dose}` : ''} to medications.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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
        const setValues: Record<string, unknown> = {};
        if (updates.dose !== undefined) setValues.dose = updates.dose;
        if (updates.frequency !== undefined) setValues.frequency = updates.frequency;
        if (updates.refill_date !== undefined) setValues.refillDate = updates.refill_date;
        if (updates.notes !== undefined) setValues.notes = updates.notes;

        try {
          const rows = await db.update(medications)
            .set(setValues)
            .where(and(
              eq(medications.careProfileId, careProfileId),
              sql`lower(${medications.name}) like lower(${'%' + name + '%'})`
            ))
            .returning({ id: medications.id });
          if (rows.length === 0) return { success: false, error: `No medication named "${name}" found.` };
          return { success: true, message: `Updated ${name}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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
        try {
          await db.delete(medications).where(and(
            eq(medications.careProfileId, careProfileId),
            sql`lower(${medications.name}) like lower(${'%' + params.name + '%'})`
          ));
          return { success: true, message: `Removed ${params.name} from medications.${params.reason ? ` Reason: ${params.reason}` : ''}` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    // ============================================================
    // APPOINTMENT TOOLS
    // ============================================================
    save_appointment: tool({
      description: 'Schedule a new appointment. Use when the caregiver mentions an upcoming visit or wants to book one.',
      inputSchema: z.object({
        doctor_name: z.string().min(1).max(200).describe('Doctor or provider name'),
        date_time: z.string().max(100).describe('Date and time (ISO format or natural like "next Tuesday at 2pm")'),
        purpose: z.string().max(500).optional().describe('Reason for visit'),
        location: z.string().max(500).optional().describe('Clinic or hospital name/address'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        try {
          await db.insert(appointments).values({
            careProfileId,
            doctorName: params.doctor_name,
            dateTime: params.date_time ? new Date(params.date_time) : null,
            purpose: params.purpose,
            location: params.location,
          });
          return { success: true, message: `Scheduled appointment with ${params.doctor_name}${params.date_time ? ` on ${params.date_time}` : ''}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    // ============================================================
    // DOCTOR TOOLS
    // ============================================================
    save_doctor: tool({
      description: 'Add a new doctor or healthcare provider to the care profile.',
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe('Doctor\'s full name'),
        specialty: z.string().max(200).optional().describe('Medical specialty (e.g. Cardiology, Primary Care)'),
        phone: z.string().max(30).optional().describe('Office phone number'),
        notes: z.string().max(1000).optional().describe('Any notes about this doctor'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };
        try {
          await db.insert(doctors).values({
            careProfileId,
            name: params.name,
            specialty: params.specialty,
            phone: params.phone,
            notes: params.notes,
          });
          return { success: true, message: `Added Dr. ${params.name}${params.specialty ? ` (${params.specialty})` : ''} to care team.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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

        const setValues: Record<string, unknown> = {};

        if (params.conditions || params.allergies) {
          const [current] = await db
            .select({ conditions: careProfiles.conditions, allergies: careProfiles.allergies })
            .from(careProfiles)
            .where(eq(careProfiles.id, careProfileId))
            .limit(1);

          if (params.conditions) {
            setValues.conditions = current?.conditions
              ? `${current.conditions}, ${params.conditions}`
              : params.conditions;
          }
          if (params.allergies) {
            setValues.allergies = current?.allergies
              ? `${current.allergies}, ${params.allergies}`
              : params.allergies;
          }
        }
        if (params.patient_age !== undefined) {
          setValues.patientAge = params.patient_age;
        }

        try {
          await db.update(careProfiles).set(setValues).where(eq(careProfiles.id, careProfileId));
          return { success: true, message: `Updated care profile.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    // ============================================================
    // LAB RESULT TOOLS
    // ============================================================
    save_lab_result: tool({
      description: 'Save a lab test result. Use when the caregiver shares lab values from a report or conversation.',
      inputSchema: z.object({
        test_name: z.string().min(1).max(200).describe('Name of the test (e.g. A1C, TSH, CBC)'),
        value: z.string().min(1).max(100).describe('The result value'),
        unit: z.string().max(50).optional().describe('Unit of measurement (e.g. mg/dL, %)'),
        reference_range: z.string().max(100).optional().describe('Normal range (e.g. 4.0-5.6%)'),
        is_abnormal: z.boolean().describe('Whether this value is outside the normal range'),
        date_taken: z.string().max(20).optional().describe('Date the test was taken (YYYY-MM-DD)'),
      }),
      execute: async (params) => {
        try {
          await db.insert(labResults).values({
            userId,
            testName: params.test_name,
            value: params.value,
            unit: params.unit,
            referenceRange: params.reference_range,
            isAbnormal: params.is_abnormal,
            dateTaken: params.date_taken,
            source: 'conversation',
          });
          const flag = params.is_abnormal ? ' (flagged as abnormal)' : '';
          return { success: true, message: `Saved ${params.test_name}: ${params.value}${params.unit ? ` ${params.unit}` : ''}${flag}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    get_lab_trends: tool({
      description: 'Look up historical lab results for a specific test to show trends over time.',
      inputSchema: z.object({
        test_name: z.string().describe('Name of the test to look up (e.g. A1C, Blood Pressure, Cholesterol)'),
      }),
      execute: async (params) => {
        try {
          const data = await db
            .select({
              testName: labResults.testName,
              value: labResults.value,
              unit: labResults.unit,
              referenceRange: labResults.referenceRange,
              isAbnormal: labResults.isAbnormal,
              dateTaken: labResults.dateTaken,
            })
            .from(labResults)
            .where(and(
              eq(labResults.userId, userId),
              sql`lower(${labResults.testName}) like lower(${'%' + params.test_name + '%'})`
            ))
            .orderBy(asc(labResults.dateTaken));

          if (data.length === 0) return { success: true, results: [], message: `No results found for "${params.test_name}".` };
          return { success: true, results: data, message: `Found ${data.length} result(s) for ${params.test_name}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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
        try {
          await db.insert(insurance).values({
            userId,
            provider: params.provider,
            memberId: params.member_id,
            groupNumber: params.group_number,
            deductibleLimit: params.deductible_limit?.toString(),
            oopLimit: params.oop_limit?.toString(),
            planYear: new Date().getFullYear(),
          }).onConflictDoUpdate({
            target: insurance.userId,
            set: {
              provider: params.provider,
              memberId: params.member_id,
              groupNumber: params.group_number,
              deductibleLimit: params.deductible_limit?.toString(),
              oopLimit: params.oop_limit?.toString(),
            },
          });
          return { success: true, message: `Saved ${params.provider} insurance details.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    // ============================================================
    // VISIT PREP & SUMMARY TOOLS
    // ============================================================
    generate_visit_prep: tool({
      description: 'Generate a pre-appointment prep sheet for an upcoming doctor visit. Gathers medications, recent labs, conditions, and suggests questions to ask. Use when the caregiver says they want to prepare for an appointment.',
      inputSchema: z.object({
        doctor_name: z.string().min(1).max(200).describe('Name of the doctor for the appointment'),
        purpose: z.string().max(500).optional().describe('Reason for the visit'),
        concerns: z.string().max(2000).optional().describe('Any specific concerns the caregiver wants to bring up'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        const [profile, meds, labs, recentMemories] = await Promise.all([
          db.select({
            patientName: careProfiles.patientName,
            patientAge: careProfiles.patientAge,
            conditions: careProfiles.conditions,
            allergies: careProfiles.allergies,
          }).from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1),
          db.select({
            name: medications.name,
            dose: medications.dose,
            frequency: medications.frequency,
            prescribingDoctor: medications.prescribingDoctor,
          }).from(medications).where(eq(medications.careProfileId, careProfileId)),
          db.select({
            testName: labResults.testName,
            value: labResults.value,
            unit: labResults.unit,
            referenceRange: labResults.referenceRange,
            isAbnormal: labResults.isAbnormal,
            dateTaken: labResults.dateTaken,
          }).from(labResults)
            .where(eq(labResults.userId, userId))
            .orderBy(desc(labResults.dateTaken))
            .limit(15),
          db.select({ fact: memories.fact, category: memories.category })
            .from(memories)
            .where(eq(memories.userId, userId))
            .orderBy(desc(memories.lastReferenced))
            .limit(20),
        ]);

        return {
          success: true,
          prep_data: {
            patient: profile[0] || null,
            doctor: params.doctor_name,
            purpose: params.purpose || 'General visit',
            concerns: params.concerns,
            medications: meds,
            recent_labs: labs,
            relevant_memories: recentMemories.map((m) => m.fact),
          },
          message: `Prepared visit summary for appointment with ${params.doctor_name}. I'll format this as a prep sheet now.`,
          instructions: 'Format this data as a clear, printable appointment prep sheet with sections: Patient Info, Current Medications, Recent Lab Results (flag abnormals), Questions to Ask (generate 3-5 based on the data and concerns), and Things to Bring.',
        };
      },
    }),

    save_visit_notes: tool({
      description: 'Save notes from a completed doctor visit. Use after the caregiver returns from an appointment and shares what happened.',
      inputSchema: z.object({
        doctor_name: z.string().min(1).max(200).describe('Name of the doctor seen'),
        visit_date: z.string().max(20).describe('Date of the visit (YYYY-MM-DD)'),
        summary: z.string().min(5).max(2000).describe('Brief summary of what was discussed'),
        medication_changes: z.string().max(1000).optional().describe('Any medications added, changed, or stopped'),
        follow_up_date: z.string().max(20).optional().describe('Date of next follow-up (YYYY-MM-DD)'),
        follow_up_instructions: z.string().max(2000).optional().describe('Any instructions or things to watch for'),
        referrals: z.string().max(500).optional().describe('Any referrals to other doctors or specialists'),
      }),
      execute: async (params) => {
        if (!careProfileId) return { success: false, error: 'No care profile found.' };

        const followUpNotes = [
          params.summary,
          params.medication_changes ? `Medication changes: ${params.medication_changes}` : null,
          params.follow_up_instructions ? `Follow-up: ${params.follow_up_instructions}` : null,
          params.referrals ? `Referrals: ${params.referrals}` : null,
        ].filter(Boolean).join('\n');

        // Find and update the most recent matching appointment
        const matchingAppts = await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(and(
            eq(appointments.careProfileId, careProfileId),
            sql`lower(${appointments.doctorName}) like lower(${'%' + params.doctor_name + '%'})`
          ))
          .orderBy(desc(appointments.dateTime))
          .limit(1);

        if (matchingAppts.length > 0) {
          await db.update(appointments)
            .set({ purpose: followUpNotes })
            .where(eq(appointments.id, matchingAppts[0].id));
        }

        // Schedule follow-up appointment if provided
        if (params.follow_up_date) {
          await db.insert(appointments).values({
            careProfileId,
            doctorName: params.doctor_name,
            dateTime: new Date(params.follow_up_date),
            purpose: 'Follow-up',
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

        await db.insert(memories).values(
          memoryFacts.map((m) => ({
            userId,
            careProfileId,
            category: m.category,
            fact: m.fact,
            source: 'conversation',
            confidence: 'high',
          }))
        );

        // Log activity for care team
        try {
          await db.insert(careTeamActivity).values({
            careProfileId,
            userId,
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
        fact: z.string().min(5).max(1000).describe('The specific fact to remember'),
      }),
      execute: async (params) => {
        try {
          await db.insert(memories).values({
            userId,
            careProfileId,
            category: params.category,
            fact: params.fact,
            source: 'conversation',
            confidence: 'high',
          });
          return { success: true, message: `Remembered: "${params.fact}"` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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
        const [med] = await db
          .select({ id: medications.id })
          .from(medications)
          .where(and(
            eq(medications.careProfileId, careProfileId),
            sql`lower(${medications.name}) like lower(${'%' + params.medication_name + '%'})`
          ))
          .limit(1);

        if (!med) return { success: false, error: `Medication "${params.medication_name}" not found. Add it first.` };

        try {
          await db.insert(medicationReminders).values({
            userId,
            medicationId: med.id,
            medicationName: params.medication_name,
            dose: params.dose || null,
            reminderTimes: params.reminder_times,
            daysOfWeek: params.days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            isActive: true,
          }).onConflictDoUpdate({
            target: [medicationReminders.userId, medicationReminders.medicationId],
            set: {
              reminderTimes: params.reminder_times,
              daysOfWeek: params.days_of_week || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
              isActive: true,
            },
          });

          const timesStr = params.reminder_times.map((t) => {
            const [h, m] = t.split(':').map(Number);
            return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
          }).join(', ');
          return { success: true, message: `Reminder set for ${params.medication_name} at ${timesStr}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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

        try {
          await db.insert(symptomEntries).values({
            userId,
            careProfileId,
            date: today,
            painLevel: params.pain_level,
            mood: params.mood,
            sleepQuality: params.sleep_quality,
            sleepHours: params.sleep_hours?.toString(),
            appetite: params.appetite,
            energy: params.energy,
            symptoms: params.symptoms,
            notes: params.notes,
          }).onConflictDoUpdate({
            target: [symptomEntries.userId, symptomEntries.date],
            set: {
              painLevel: params.pain_level,
              mood: params.mood,
              sleepQuality: params.sleep_quality,
              sleepHours: params.sleep_hours?.toString(),
              appetite: params.appetite,
              energy: params.energy,
              symptoms: params.symptoms,
              notes: params.notes,
            },
          });

          const parts = [];
          if (params.pain_level !== undefined) parts.push(`pain: ${params.pain_level}/10`);
          if (params.mood) parts.push(`mood: ${params.mood}`);
          if (params.sleep_quality) parts.push(`sleep: ${params.sleep_quality}`);
          if (params.symptoms?.length) parts.push(`symptoms: ${params.symptoms.join(', ')}`);
          return { success: true, message: `Logged today's check-in${parts.length ? ` (${parts.join(', ')})` : ''}.` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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

        try {
          const data = await db
            .select()
            .from(symptomEntries)
            .where(and(
              eq(symptomEntries.userId, userId),
              gte(symptomEntries.date, since)
            ))
            .orderBy(asc(symptomEntries.date));

          if (data.length === 0) return { success: true, entries: [], message: `No symptom entries in the last ${daysBack} days.` };

          return {
            success: true,
            entries: data,
            message: `Found ${data.length} entries over the last ${daysBack} days.`,
            instructions: 'Analyze these entries for patterns. Look for: pain trends, sleep correlation with mood, recurring symptoms, and anything the caregiver should discuss with their doctor.',
          };
        } catch (err) {
          return { success: false, error: String(err) };
        }
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
        const [ins] = await db
          .select()
          .from(insurance)
          .where(eq(insurance.userId, userId))
          .limit(1);

        if (!ins) {
          return {
            success: true,
            has_insurance: false,
            procedure: params.procedure,
            message: 'No insurance on file. Add insurance details so I can estimate costs.',
            instructions: 'Tell the user to add their insurance information first, either through the chat or Connected Accounts page.',
          };
        }

        const deductibleLimit = Number(ins.deductibleLimit) || 0;
        const deductibleUsed = Number(ins.deductibleUsed) || 0;
        const oopLimit = Number(ins.oopLimit) || 0;
        const oopUsed = Number(ins.oopUsed) || 0;
        const deductibleRemaining = deductibleLimit - deductibleUsed;
        const oopRemaining = oopLimit - oopUsed;
        const deductibleMet = deductibleRemaining <= 0;

        return {
          success: true,
          has_insurance: true,
          procedure: params.procedure,
          estimated_total: params.estimated_total || null,
          insurance_data: {
            provider: ins.provider,
            deductible_limit: deductibleLimit,
            deductible_used: deductibleUsed,
            deductible_remaining: Math.max(0, deductibleRemaining),
            deductible_met: deductibleMet,
            oop_limit: oopLimit,
            oop_used: oopUsed,
            oop_remaining: Math.max(0, oopRemaining),
          },
          message: `Retrieved insurance details for cost estimate.`,
          instructions: `Estimate the out-of-pocket cost for "${params.procedure}" using this insurance data. Explain:
1. Typical cost range for this procedure
2. Whether the deductible has been met ($${deductibleUsed}/$${deductibleLimit})
3. Estimated patient responsibility based on deductible status (if not met, patient pays full cost up to deductible; if met, typically 20% coinsurance)
4. How close they are to out-of-pocket max ($${oopUsed}/$${oopLimit})
5. Tips to reduce cost (in-network, prior auth, price shopping)
Always add: "These are estimates based on typical costs. Your actual cost depends on your specific plan, network status, and provider charges. Contact your insurance for an exact quote."`,
        };
      },
    }),
  };
}
