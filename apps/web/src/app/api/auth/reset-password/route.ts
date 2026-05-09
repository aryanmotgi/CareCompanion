import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

const resetLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 3 })

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local?.slice(0, 3)}***@${domain}`
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ message: 'If an account exists, we sent a reset link.' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit: 3 per email per hour
    const { success } = await resetLimiter.check(normalizedEmail)
    if (!success) {
      // Still return 200 to prevent email enumeration
      return NextResponse.json({ message: 'If an account exists, we sent a reset link.' })
    }

    const user = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) })
    if (!user) {
      // Don't reveal whether the email exists
      console.log(`[reset-password] No user found for ${maskEmail(normalizedEmail)}`)
      return NextResponse.json({ message: 'If an account exists, we sent a reset link.' })
    }

    // Generate a single-use nonce and store it
    const nonce = crypto.randomUUID()
    await db.update(users).set({ resetNonce: nonce }).where(eq(users.id, user.id))

    // Sign JWT with 1-hour expiry
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '')
    const token = await new SignJWT({ email: normalizedEmail, nonce })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .setIssuedAt()
      .sign(secret)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'https://carecompanionai.org'
    const resetUrl = `${baseUrl}/reset-password/confirm?token=${token}`

    const emailResult = await sendEmail({
      to: normalizedEmail,
      from: 'CareCompanion <noreply@carecompanionai.org>',
      subject: 'Reset your CareCompanion password',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CareCompanion</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
                Click the button below to set a new password. This link expires in 1 hour.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5;text-align:center;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">
                CareCompanion &mdash; Helping families coordinate care with confidence.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    })

    if (!emailResult.success) {
      console.error(`[reset-password] Failed to send email to ${maskEmail(normalizedEmail)}: ${emailResult.reason}`)
      return NextResponse.json({ error: "We couldn't send the email. Try again in a few minutes." }, { status: 500 })
    }

    console.log(`[reset-password] Reset email sent to ${maskEmail(normalizedEmail)}`)
    return NextResponse.json({ message: 'If an account exists, we sent a reset link.' })
  } catch (err) {
    console.error('[reset-password]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
