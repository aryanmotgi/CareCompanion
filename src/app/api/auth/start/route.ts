import { signIn } from '@/lib/auth'

export async function GET() {
  await signIn('cognito', { redirectTo: '/dashboard' })
}
