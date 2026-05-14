import { SessionProvider } from '@/components/providers/SessionProvider';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
