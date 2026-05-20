// Nadir window safety banner.
// Days 7–14 of a chemo cycle are the immunosuppression nadir — fever
// > 100.4°F is a medical emergency. This banner is intentionally hard
// to miss but uses warm amber rather than red so it does not read as
// "something is actively wrong right now."

interface NadirBannerProps {
  dayOfCycle: number;
  cycleNumber: number;
  cycleId?: string;
}

export function NadirBanner({ dayOfCycle, cycleNumber, cycleId }: NadirBannerProps) {
  if (dayOfCycle < 7 || dayOfCycle > 14) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 'var(--top-bar-height, 56px)',
        zIndex: 50,
        margin: '0 0 12px 0',
        padding: '12px 16px',
        background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
        borderTop: '1px solid rgba(180, 83, 9, 0.18)',
        borderBottom: '1px solid rgba(180, 83, 9, 0.18)',
        boxShadow: '0 1px 6px rgba(120, 53, 15, 0.08)',
        color: '#78350f',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b45309"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              marginBottom: 2,
            }}
          >
            Nadir Week &middot; Cycle {cycleNumber}, Day {dayOfCycle}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: '#78350f' }}>
            Immune system is at its lowest point. A fever above{' '}
            <strong style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>100.4&deg;F (38&deg;C)</strong>{' '}
            is a medical emergency &mdash; call the on-call oncologist or go to the ER immediately.
          </div>
          {cycleId && (
            <a
              href={`/er-card/${cycleId}`}
              style={{
                display: 'inline-block',
                marginTop: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#fffbeb',
                background: '#b45309',
                borderRadius: 6,
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              Open ER Protocol Card &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
