import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, welcomeEmailHtml } from '@/lib/email';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 3 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const email = user.email;
    const name = user.displayName || 'there';

    if (!email) {
      return apiError('No email on account', 400);
    }

    const result = await sendEmail({
      to: email,
      subject: 'Welcome to CareCompanion',
      html: welcomeEmailHtml(name),
    });

    if (!result.success) {
      console.warn(`[Welcome Email] Could not send to ${email}: ${result.reason}`);
      // Still return 200 — email failure shouldn't block sign-up flows
      return apiSuccess({ sent: false, email, reason: result.reason });
    }

    return apiSuccess({ sent: true, email });
  } catch (err) {
    console.error('[welcome-email] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
