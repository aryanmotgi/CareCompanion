'use client';

export function NoiseVeil({ opacity = 0.025 }: { opacity?: number }) {
  // Inline SVG turbulence for a quiet grain layer.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.6"/></svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 mix-blend-overlay"
      style={{ backgroundImage: url, opacity }}
    />
  );
}
