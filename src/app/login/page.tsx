import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center px-4 sm:px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] shadow-lg shadow-[#6366F1]/20 mb-5">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h1 className="text-fluid-3xl font-bold text-white mb-1">CareCompanion</h1>
          <p className="text-fluid-base text-[var(--text-secondary)]">AI-powered cancer care for patients &amp; caregivers</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
