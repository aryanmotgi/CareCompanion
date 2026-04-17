import { signIn } from '@/lib/auth'

export async function GET() {
  return await signIn('cognito', { redirectTo: '/dashboard' })
}
