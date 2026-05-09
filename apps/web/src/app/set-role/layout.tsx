import { SessionProvider } from '@/components/providers/SessionProvider'

export default function SetRoleLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
