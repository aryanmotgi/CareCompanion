import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, welcomeEmailHtml } from '@/lib/email';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 3 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = user.email;
  const name = user.user_metadata?.display_name || user.user_metadata?.full_name || 'there';

  if (!email) {
    return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  }

  const result = await sendEmail({
    to: email,
    subject: 'Welcome to CareCompanion',
    html: welcomeEmailHtml(name),
  });

  if (!result.success) {
    console.warn(`[Welcome Email] Could not send to ${email}: ${result.reason}`);
    // Still return 200 — email failure shouldn't block sign-up flows
    return NextResponse.json({ sent: false, email, reason: result.reason });
  }

  return NextResponse.json({ sent: true, email });
}
