import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

try {
  const envFile = readFileSync('.env.local', 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  });
} catch {}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin.auth.admin.listUsers();
  const demos = data.users.filter(u => u.email?.includes('demo-'));
  console.log(`Found ${demos.length} demo users`);
  if (demos.length > 0) {
    const latest = demos[0];
    console.log('Latest demo user:');
    console.log('  Email:', latest.email);
    console.log('  user_metadata:', JSON.stringify(latest.user_metadata));
  }
}
main();
