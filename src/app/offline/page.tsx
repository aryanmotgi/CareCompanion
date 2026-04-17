import Image from 'next/image';

export const metadata = {
  title: 'Offline',
}

const cachedPages = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/chat', label: 'Chat' },
  { href: '/care', label: 'Care' },
  { href: '/scans', label: 'Scans' },
]

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0C0E1A] px-6 text-center">
      {/* Logo */}
      <Image
        src="/logo.svg"
        alt="CareCompanion"
        width={64}
        height={64}
        className="mb-6"
      />

      <h1 className="font-outfit text-2xl font-bold text-white">
        You&apos;re offline
      </h1>

      <p className="mt-3 max-w-md text-[#94a3b8]">
        Your changes have been saved and will sync when you&apos;re back online.
      </p>

      {/* Cached page links */}
      <nav className="mt-8 w-full max-w-xs">
        <p className="mb-3 text-sm font-medium text-[#64748b]">
          Cached pages you can still visit:
        </p>
        <ul className="space-y-2">
          {cachedPages.map((page) => (
            <li key={page.href}>
              <a
                href={page.href}
                className="block rounded-lg border border-[#1e293b] bg-[#131627] px-4 py-3 text-sm font-medium text-[#A78BFA] transition-colors hover:border-[#6366F1]/40 hover:bg-[#1a1f3a]"
              >
                {page.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
