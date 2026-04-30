export function ZipCodePrompt() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-amber-800">
        Add your zip code to find trials near you — distance matching is unavailable without it.
      </p>
      <a href="/settings" className="text-sm font-medium text-amber-900 underline flex-shrink-0">
        Go to Settings →
      </a>
    </div>
  )
}
