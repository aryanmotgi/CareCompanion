import { z } from 'zod'

export const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  prescribingDoctor: z.string().optional(),
  refillDate: z.string().optional(),
  notes: z.string().optional(),
  pharmacyPhone: z.string().optional(),
})

export const labResultSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  value: z.string().min(1, 'Value is required'),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  dateTaken: z.string().optional(),
  notes: z.string().optional(),
})

export const appointmentSchema = z.object({
  doctorName: z.string().min(1, 'Doctor name is required'),
  specialty: z.string().optional(),
  dateTime: z.string().min(1, 'Date is required'),
  location: z.string().optional(),
  purpose: z.string().optional(),
})

export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required'),
  role: z.enum(['caregiver', 'patient', 'self']).optional(),
})

export type MedicationInput = z.infer<typeof medicationSchema>
export type LabResultInput = z.infer<typeof labResultSchema>
export type AppointmentInput = z.infer<typeof appointmentSchema>
export type RegisterInput = z.infer<typeof registerSchema>
