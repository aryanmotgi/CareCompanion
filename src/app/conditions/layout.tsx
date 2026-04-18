import Link from 'next/link';
import { ReactNode } from 'react';

export default function ConditionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080A14] text-white">
      <header className="border-b border-white/[0.06] bg-[#080A14]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">CareCompanion</span>
            <span className="text-xs text-white/30 hidden sm:inline">/ Treatment Guide</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/conditions" className="text-sm text-white/50 hover:text-white/90 transition-colors">
              All Treatments
            </Link>
            <Link
              href="/chat/guest"
              className="text-sm bg-[#6366F1] text-white px-3 py-1.5 rounded-lg hover:bg-[#4f52d9] transition-colors"
            >
              Ask AI
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-white/[0.06] mt-16 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-white/30">
          <p>This information is for educational purposes only. Always follow your oncology team&apos;s guidance.</p>
          <div className="mt-3 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
