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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (isSignUp) {
      // Sign up — no email verification
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

      // Auto sign in after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        // If "email not confirmed" error, the user was created but needs confirmation
        // Since we want to skip verification, try to proceed anyway
        if (signInError.message.includes('Email not confirmed')) {
          setError('Account created! Check Supabase dashboard → Authentication → Settings and disable "Confirm email" to skip verification.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      router.push('/connect');
    } else {
      // Sign in
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

      // Check if user has a profile
      const { data: profile } = await supabase
        .from('care_profiles')
        .select('id')
        .limit(1)
        .single();

      router.push(profile ? '/dashboard' : '/connect');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8">
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
          autoFocus
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
  );
}
