import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CareTeamView } from '@/components/CareTeamView';

export default async function CareTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ accept?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const acceptInviteId = params.accept || null;

  return <CareTeamView acceptInviteId={acceptInviteId} />;
}
