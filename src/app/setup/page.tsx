import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // New users go straight to the connect page
  redirect('/connect');
}
