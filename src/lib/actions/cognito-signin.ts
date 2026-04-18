'use server'

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { signIn } from '@/lib/auth'

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION!,
})

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!

export type AuthResult =
  | { success: true }
  | { error: string }
  | { needsConfirmation: true; email: string }

export async function cognitoSignIn(email: string, password: string): Promise<AuthResult> {
  try {
    await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))
    // Successful auth — use NextAuth to create the session via the Cognito provider
    await signIn('cognito', { redirect: false })
    return { success: true }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'UserNotConfirmedException') {
      return { needsConfirmation: true, email }
    }
    if (e.name === 'NotAuthorizedException') {
      return { error: 'Incorrect email or password.' }
    }
    if (e.name === 'UserNotFoundException') {
      return { error: 'No account found with that email.' }
    }
    return { error: e.message || 'Sign in failed. Please try again.' }
  }
}

export async function cognitoSignUp(email: string, password: string, name: string): Promise<AuthResult> {
  try {
    await client.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    }))
    return { needsConfirmation: true, email }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'UsernameExistsException') {
      return { error: 'An account with this email already exists.' }
    }
    if (e.name === 'InvalidPasswordException') {
      return { error: 'Password must be at least 8 characters with uppercase, lowercase, and a number.' }
    }
    return { error: e.message || 'Sign up failed. Please try again.' }
  }
}

export async function cognitoConfirm(email: string, code: string): Promise<AuthResult> {
  try {
    await client.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }))
    return { success: true }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'CodeMismatchException') {
      return { error: 'Invalid verification code.' }
    }
    if (e.name === 'ExpiredCodeException') {
      return { error: 'Code expired. Please request a new one.' }
    }
    return { error: e.message || 'Verification failed.' }
  }
}

export async function cognitoResendCode(email: string): Promise<AuthResult> {
  try {
    await client.send(new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email,
    }))
    return { success: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { error: e.message || 'Failed to resend code.' }
  }
}
