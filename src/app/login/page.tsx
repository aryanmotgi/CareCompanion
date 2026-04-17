import { PublicNav } from '@/components/PublicNav';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const { error, mode } = await searchParams
  const errorMsg = error === 'db'
    ? 'Database is temporarily unavailable. Please try again in a moment.'
    : error
    ? `Sign in failed (${error}). Please try again.`
    : undefined

  return (
    <div className="relative min-h-screen min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden" style={{ background: '#05060F' }}>

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.15]" style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.12]" style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(ellipse, #6366F1 0%, transparent 60%)', filter: 'blur(80px)' }} />
      </div>

      {/* Subtle dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Fade-in vignette edges */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, #05060F 100%)' }} />

      <PublicNav />

      <div className="relative w-full max-w-sm" style={{ animation: 'loginFadeUp 0.6s ease both' }}>

        {/* Logo + headline */}
        <div className="text-center mb-8" style={{ animation: 'loginFadeUp 0.6s ease 0.05s both' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative" style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)', boxShadow: '0 0 40px rgba(99,102,241,0.5), 0 0 80px rgba(99,102,241,0.2)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">CareCompanion</h1>
          <p className="text-sm text-white/40">AI-powered cancer care for patients &amp; caregivers</p>
        </div>

        <LoginForm initialError={errorMsg} mode={mode} />
      </div>

      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
