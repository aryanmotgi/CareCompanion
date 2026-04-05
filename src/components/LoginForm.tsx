'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: { display_name: name.trim() || undefined },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          setError('Account created! Check Supabase dashboard → Authentication → Settings and disable "Confirm email" to skip verification.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      router.push('/onboarding');
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Wrong email or password. Or sign up if you\'re new.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('care_profiles')
        .select('id, onboarding_completed')
        .limit(1)
        .single();

      if (!profile) {
        router.push('/onboarding');
      } else if (!profile.onboarding_completed) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    }
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 space-y-5">
      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white py-3.5 px-6 text-base font-semibold text-gray-800 hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {googleLoading ? (
          <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-semibold text-[var(--text)] mb-2">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sarah"
              autoComplete="name"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-base text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 focus:ring-1 focus:ring-[#A78BFA]/20 transition-colors"
            />
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-semibold text-[var(--text)] mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-base text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 focus:ring-1 focus:ring-[#A78BFA]/20 transition-colors"
          />
        </div>
        <div className="mb-5">
          <label htmlFor="password" className="block text-sm font-semibold text-[var(--text)] mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? 'Create a password (6+ characters)' : 'Your password'}
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-base text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#A78BFA]/40 focus:ring-1 focus:ring-[#A78BFA]/20 transition-colors"
          />
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !email.trim() || !password.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {isSignUp ? 'Creating account...' : 'Signing in...'}
            </span>
          ) : (
            isSignUp ? 'Create account' : 'Sign in'
          )}
        </button>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-sm text-[var(--text-muted)] hover:text-[#A78BFA] transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </div>
      </form>
    </div>
  );
}
