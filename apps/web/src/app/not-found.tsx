import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080A14] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold text-white/20 mb-4">404</h1>
        <p className="text-lg text-white/40 mb-6">Page not found</p>
        <Link
          href="/chat"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
        >
          Back to Chat
        </Link>
      </div>
    </div>
  );
}
