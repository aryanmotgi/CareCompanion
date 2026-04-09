/**
 * Email sending via Resend API (no SDK needed).
 */

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send');
    return { success: false, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'CareCompanion <noreply@carecompanionai.org>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    console.error('[email] Send failed:', await res.text());
    return { success: false, reason: 'send_failed' };
  }

  return { success: true };
}

/**
 * Generates the HTML body for a care team invite email.
 */
export function careTeamInviteEmail({
  inviterName,
  patientName,
  role,
  acceptUrl,
}: {
  inviterName: string;
  patientName: string;
  role: string;
  acceptUrl: string;
}): string {
  const roleLabel = role === 'editor' ? 'Editor (can view and edit)' : 'Viewer (view only)';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CareCompanion</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">You're invited to a care team</h2>
              <p style="margin:0 0 20px;color:#52525b;font-size:14px;line-height:1.6;">
                <strong>${inviterName}</strong> has invited you to join <strong>${patientName}'s</strong> care team as a <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
                CareCompanion helps families coordinate care, track medications, and stay on top of appointments together.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5;text-align:center;">
                This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
</html>`.trim();
}
