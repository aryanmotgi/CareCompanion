/**
 * Email sending via Resend SDK.
 * Falls back to logging when RESEND_API_KEY is not set (dev-friendly).
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = 'CareCompanion <welcome@carecompanionai.org>',
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; reason?: string }> {
  const resend = getResend();

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — logging instead. To: ${to}, Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
      console.error('[email] Resend API error:', error);
      return { success: false, reason: error.message };
    }

    console.log(`[email] Sent "${subject}" to ${to}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[email] Failed to send:', message);
    return { success: false, reason: message };
  }
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

/**
 * Returns branded HTML for the CareCompanion welcome email.
 * Uses inline styles and table layout for maximum email client compatibility.
 */
export function welcomeEmailHtml(name: string): string {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://carecompanionai.org'}/dashboard`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to CareCompanion</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f0ff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f0ff;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 40px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:44px;height:44px;background-color:rgba(255,255,255,0.2);border-radius:12px;text-align:center;vertical-align:middle;font-size:24px;">
                    &#x1F49C;
                  </td>
                  <td style="padding-left:12px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                    CareCompanion
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.9);font-size:16px;margin:20px 0 0;line-height:1.5;">
                Your personal health assistant, powered by AI
              </p>
            </td>
          </tr>

          <!-- Welcome message -->
          <tr>
            <td style="padding:36px 40px 16px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e1b4b;">
                Welcome, ${name}!
              </h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#4b5563;">
                We&rsquo;re thrilled to have you on board. CareCompanion helps you take control of your
                health with the power of AI&mdash;making it easier to stay informed, organized, and
                proactive about your care.
              </p>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding:8px 40px 32px;">
              <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">
                Here&rsquo;s what you can do
              </p>

              <!-- Feature 1: AI Health Chat -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="width:48px;height:48px;background-color:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:22px;">
                    &#x1F4AC;
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#1e1b4b;">AI Health Chat</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                      Ask questions about symptoms, medications, and conditions in plain language.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature 2: Document Scanning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="width:48px;height:48px;background-color:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:22px;">
                    &#x1F4C4;
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#1e1b4b;">Document Scanning</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                      Upload and scan medical documents, lab results, and insurance cards.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature 3: Medication Tracking -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td style="width:48px;height:48px;background-color:#eef2ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:22px;">
                    &#x1F48A;
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#1e1b4b;">Medication Tracking</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                      Keep track of medications, dosages, and set reminders so you never miss a dose.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:8px;">
                    <a href="${dashboardUrl}"
                       target="_blank"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Go to Your Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                You&rsquo;re receiving this because you signed up for CareCompanion.<br />
                Questions? Just reply to this email&mdash;we&rsquo;d love to help.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#d1d5db;">
                &copy; ${year} CareCompanion. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
