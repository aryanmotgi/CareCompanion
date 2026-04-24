import { z } from 'zod';

export const checkinSchema = z.object({
  mood: z.number().int().min(1).max(5),
  pain: z.number().int().min(0).max(10),
  energy: z.enum(['low', 'medium', 'high']),
  sleep: z.enum(['bad', 'ok', 'good']),
  notes: z.string().max(500).optional(),
});

export type CheckinInput = z.infer<typeof checkinSchema>;

export function validateCheckin(data: unknown) {
  return checkinSchema.safeParse(data);
}

export function sanitizeNotes(notes: string): string {
  const cleaned = notes.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, 500);
}
