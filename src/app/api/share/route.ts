import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Generate a shareable link for a health summary
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type = 'health_summary' } = body;

  // Generate a unique share token
  const shareToken = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store the share link
  const { error } = await supabase.from('shared_links').insert({
    user_id: user.id,
    token: shareToken,
    type,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    // If the shared_links table doesn't exist yet, return a helpful message
    if (error.code === '42P01') {
      return NextResponse.json({
        error: 'Share feature not yet configured. Run the SQL migration to create the shared_links table.',
        sql: `CREATE TABLE shared_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'health_summary',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own links" ON shared_links FOR ALL USING (auth.uid() = user_id);`,
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shareUrl = `https://carecompanionai.org/shared/${shareToken}`;

  return NextResponse.json({ url: shareUrl, expiresAt: expiresAt.toISOString() });
}
