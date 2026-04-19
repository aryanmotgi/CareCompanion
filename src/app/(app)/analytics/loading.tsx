export default function AnalyticsLoading() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-xl bg-[var(--bg-card)] animate-pulse" />
      ))}
    </div>
  );
}
