import { PublicNav } from '@/components/PublicNav';
import { ResetRequestForm } from '@/components/ResetRequestForm';
import { AuthPageBackground } from '@/components/AuthPageBackground';

export default function ResetPasswordPage() {
  return (
    <AuthPageBackground>
      <PublicNav />

      <div className="relative w-full max-w-sm" style={{ animation: 'loginFadeUp 0.6s ease both' }}>
        <div className="text-center mb-8" style={{ animation: 'loginFadeUp 0.6s ease 0.05s both' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative" style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)', boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 0 80px rgba(99,102,241,0.2)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Forgot your password?</h1>
          <p className="text-sm text-white/40">No problem — we&apos;ll send a reset link right away.</p>
        </div>
        <ResetRequestForm />
      </div>
    </AuthPageBackground>
  );
}
