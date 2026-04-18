import Link from 'next/link';
import { ReactNode } from 'react';

export default function ConditionsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">CareCompanion</span>
            <span className="text-xs text-gray-400 hidden sm:inline">/ Treatment Guide</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/conditions" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              All Treatments
            </Link>
            <Link
              href="/chat/guest"
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ask AI
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-100 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>This information is for educational purposes only. Always follow your oncology team&apos;s guidance.</p>
          <div className="mt-3 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
            <Link href="/about" className="hover:text-gray-600">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
