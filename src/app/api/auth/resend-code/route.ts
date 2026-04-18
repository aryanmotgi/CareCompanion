import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

export async function POST(req: Request) {
  const { email } = await req.json()
  try {
    await client.send(new ResendConfirmationCodeCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email,
    }))
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message || 'Failed to resend.' })
  }
}
