import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

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

  // TODO: Integrate with Resend or SendGrid to actually send emails
  // For now, log the intent and return success
  // To enable: npm install resend, add RESEND_API_KEY to env
  //
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'CareCompanion <welcome@carecompanionai.org>',
  //   to: email,
  //   subject: 'Welcome to CareCompanion',
  //   html: welcomeEmailHtml(name),
  // });

  console.log(`[Welcome Email] Would send to: ${email}, name: ${name}`);

  return NextResponse.json({ sent: true, email });
}
