import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      displayName: string
      isDemo: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    cognitoSub?: string
    displayName?: string
    isDemo?: boolean
  }
}
