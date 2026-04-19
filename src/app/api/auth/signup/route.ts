import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { parseBody } from '@/lib/api-helpers'

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION! })

export async function POST(req: Request) {
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
      return NextResponse.json({ error: 'An account with this email already exists.' })
    }
    if (e.name === 'InvalidPasswordException') {
      return NextResponse.json({ error: 'Password must be at least 8 characters with a number and uppercase letter.' })
    }
    return NextResponse.json({ error: e.message || 'Sign up failed.' })
  }
}
