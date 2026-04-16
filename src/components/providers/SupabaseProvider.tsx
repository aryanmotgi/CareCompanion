'use client';

// Previously wrapped the Supabase client. Now a no-op pass-through since
// auth is handled by Auth.js (next-auth). The signed-out redirect is
// managed by Auth.js middleware and the signOut() function from next-auth/react.
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
