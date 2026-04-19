import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { parseBody } from '@/lib/api-helpers'
import { rateLimit } from '@/lib/rate-limit'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

const confirmLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 5,
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success } = await confirmLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const { body, error: bodyError } = await parseBody<{ email: string; code: string }>(req);
  if (bodyError) return bodyError;
  const { email, code } = body;
  try {
    await client.send(new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
      ConfirmationCode: code,
    }))
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'CodeMismatchException') return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 })
    if (e.name === 'ExpiredCodeException') return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 410 })
    return NextResponse.json({ error: e.message || 'Verification failed.' }, { status: 500 })
  }
}
