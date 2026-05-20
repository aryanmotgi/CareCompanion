'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="er-print-button"
      style={{
        padding: '10px 18px',
        fontSize: 15,
        fontWeight: 700,
        border: '2px solid #000',
        background: '#000',
        color: '#fff',
        borderRadius: 6,
        cursor: 'pointer',
        letterSpacing: '0.02em',
      }}
    >
      Print / Save as PDF
    </button>
  );
}
