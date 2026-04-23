import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?error=session');

  // New users go through onboarding to create a care profile
  redirect('/onboarding');
}
