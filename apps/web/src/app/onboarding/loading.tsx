export default function OnboardingLoading() {
  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-16 space-y-8">
        {/* Progress bar skeleton */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-8 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.08]">
            <div className="h-full w-1/6 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>

        {/* Heading skeleton */}
        <div className="text-center space-y-3 py-4">
          <div className="h-8 w-48 rounded-xl bg-white/10 animate-pulse mx-auto" />
          <div className="h-4 w-64 rounded bg-white/[0.07] animate-pulse mx-auto" />
        </div>

        {/* Role card skeletons */}
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] animate-pulse flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
                  <div className="h-3 w-48 rounded bg-white/[0.06] animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Button skeleton */}
        <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />
      </div>
    </div>
  )
}
