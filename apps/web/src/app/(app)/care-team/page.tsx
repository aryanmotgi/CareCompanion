import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CareTeamView } from '@/components/CareTeamView';

export default async function CareTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ accept?: string }>;
}) {
  const params = await searchParams;
  const acceptInviteId = params.accept || null;

  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = acceptInviteId
      ? '/care-team?accept=' + acceptInviteId
      : '/care-team';
    redirect('/login?error=session&callbackUrl=' + encodeURIComponent(callbackUrl));
  }

  return <CareTeamView acceptInviteId={acceptInviteId} />;
}
