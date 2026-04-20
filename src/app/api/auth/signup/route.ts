import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { parseBody } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/csrf'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

const signupLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 10,
})

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success } = await signupLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { body, error: bodyError } = await parseBody<{ email: string; password: string; name: string }>(req);
  if (bodyError) return bodyError;
  const { email, password, name } = body;
  try {
    await client.send(new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name || email },
      ],
    }))
    return NextResponse.json({ needsConfirmation: true, email })
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'UsernameExistsException') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    if (e.name === 'InvalidPasswordException') {
      return NextResponse.json({ error: 'Password must be at least 8 characters with a number and uppercase letter.' }, { status: 400 })
    }
    return NextResponse.json({ error: e.message || 'Sign up failed.' }, { status: 500 })
  }
}
