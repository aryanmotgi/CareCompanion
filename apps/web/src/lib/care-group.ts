/**
 * Shared care-group membership service.
 *
 * Three join paths converge here so we never duplicate membership-creation
 * logic across the 5-char code redemption, the long-token invite redemption,
 * and the name+password legacy join:
 *
 *   POST /api/care-group/join-by-code  ──┐
 *   POST /api/care-group/invite/<id>     ├─►  joinCareGroup()
 *   POST /api/care-group/join (legacy) ──┘
 *
 * Plus utilities for generating 5-char codes (Crockford base32 minus
 * visually-ambiguous chars) and the per-caregiver default permission set.
 *
 * See ~/.gstack/projects/aryanmotgi-CareCompanion/ceo-plans/2026-05-12-patient-caregiver-onboarding.md
 */
import { db } from './db'
import { careGroupMembers } from './db/schema'
import { and, eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'

const MAX_MEMBERS = 10

// Crockford base32 minus 0, O, 1, I, L, U (visually ambiguous + obscene).
// 29 chars × 5 positions = 20.5M codes. With max_uses=5 and 14-day expiry,
// rate-limited brute-force is infeasible.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 5

type UserType = 'patient' | 'caregiver'
export type Relationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'other'

interface CaregiverPerms {
  can_read_meds: boolean
  can_read_appts: boolean
  can_read_labs: boolean
  can_chat: boolean
  can_edit_appts: boolean
}

export const DEFAULT_CAREGIVER_PERMS: CaregiverPerms = {
  can_read_meds: true,
  can_read_appts: true,
  can_read_labs: true,
  can_chat: true,
  can_edit_appts: false,
}

export const DEFAULT_PATIENT_PERMS: CaregiverPerms = {
  can_read_meds: true,
  can_read_appts: true,
  can_read_labs: true,
  can_chat: true,
  can_edit_appts: true,
}

type JoinResult =
  | { ok: true; careGroupId: string }
  | { ok: false; reason: 'already-member' | 'group-full' }

interface JoinArgs {
  userId: string
  careGroupId: string
  userType: UserType
  relationship?: Relationship | null
  role?: 'owner' | 'member'
  perms?: CaregiverPerms
}

/**
 * Idempotent membership creation. Returns `already-member` if the user is
 * already in the group rather than erroring — the caller decides whether
 * that's a 409 (UX-facing) or a silent 200 (redemption retry).
 */
export async function joinCareGroup(args: JoinArgs): Promise<JoinResult> {
  const { userId, careGroupId, userType, relationship = null, role = 'member' } = args
  const perms = args.perms ?? (userType === 'caregiver' ? DEFAULT_CAREGIVER_PERMS : DEFAULT_PATIENT_PERMS)

  const existing = await db.query.careGroupMembers.findFirst({
    where: and(
      eq(careGroupMembers.careGroupId, careGroupId),
      eq(careGroupMembers.userId, userId),
    ),
  })
  if (existing) return { ok: false, reason: 'already-member' }

  const members = await db.query.careGroupMembers.findMany({
    where: eq(careGroupMembers.careGroupId, careGroupId),
  })
  if (members.length >= MAX_MEMBERS) return { ok: false, reason: 'group-full' }

  await db.insert(careGroupMembers).values({
    careGroupId,
    userId,
    role,
    userType,
    relationship,
    perms,
    paused: false,
  })

  return { ok: true, careGroupId }
}

/**
 * Generate a single 5-char code from the safe alphabet using crypto.randomBytes.
 * Rejection-sample to avoid modulo bias.
 */
export function generateCode(): string {
  const alphabetLen = CODE_ALPHABET.length
  // We need 5 alphabet picks. Pull a few extra bytes to avoid re-rolling under
  // rejection sampling. Each byte gives values 0-255; 255 % 29 = 23, so the
  // "reject if >= 232" rule keeps the distribution uniform (232 = floor(256/29)*29).
  const cap = Math.floor(256 / alphabetLen) * alphabetLen
  const out: string[] = []
  while (out.length < CODE_LENGTH) {
    const bytes = randomBytes(8)
    for (const b of bytes) {
      if (b < cap) {
        out.push(CODE_ALPHABET[b % alphabetLen])
        if (out.length === CODE_LENGTH) break
      }
    }
  }
  return out.join('')
}

/**
 * Display format: AK7QM → "AK-7QM". Used by mobile + SMS share.
 */
export function formatCodeForDisplay(code: string): string {
  if (code.length !== CODE_LENGTH) return code
  return `${code.slice(0, 2)}-${code.slice(2)}`
}

/**
 * Inverse: user types "AK-7QM" or "ak7qm" → "AK7QM" (upper, hyphen-stripped).
 * Returns null if the result isn't 5 valid alphabet chars.
 */
export function normalizeCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== CODE_LENGTH) return null
  for (const c of cleaned) {
    if (!CODE_ALPHABET.includes(c)) return null
  }
  return cleaned
}

/**
 * Verify the calling user is the patient (userType='patient') of the group.
 * Used to gate code generation, rotation, revocation, and join-request approval.
 */
export async function isGroupPatient(userId: string, careGroupId: string): Promise<boolean> {
  const m = await db.query.careGroupMembers.findFirst({
    where: and(
      eq(careGroupMembers.careGroupId, careGroupId),
      eq(careGroupMembers.userId, userId),
    ),
  })
  return Boolean(m && m.userType === 'patient')
}
