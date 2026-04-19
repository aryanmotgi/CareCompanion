import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { parseBody } from '@/lib/api-helpers'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

export async function POST(req: Request) {
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
    if (e.name === 'CodeMismatchException') return NextResponse.json({ error: 'Invalid verification code.' })
    if (e.name === 'ExpiredCodeException') return NextResponse.json({ error: 'Code expired. Request a new one.' })
    return NextResponse.json({ error: e.message || 'Verification failed.' })
  }
}
