import React from "react";
import { useCurrentFrame } from "remotion";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
}

const PARTICLES: Particle[] = [
  { x: 10, y: 20, size: 2, speed: 0.03, opacity: 0.4, color: "#6ee7b7" },
  { x: 85, y: 15, size: 1.5, speed: 0.02, opacity: 0.3, color: "#a78bfa" },
  { x: 20, y: 70, size: 3, speed: 0.025, opacity: 0.25, color: "#6ee7b7" },
  { x: 90, y: 60, size: 2, speed: 0.035, opacity: 0.35, color: "#60a5fa" },
  { x: 50, y: 85, size: 1, speed: 0.02, opacity: 0.2, color: "#a78bfa" },
  { x: 5, y: 45, size: 2.5, speed: 0.028, opacity: 0.3, color: "#6ee7b7" },
  { x: 75, y: 80, size: 1.5, speed: 0.022, opacity: 0.25, color: "#60a5fa" },
  { x: 35, y: 10, size: 2, speed: 0.032, opacity: 0.35, color: "#a78bfa" },
];

export const Particles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
      {PARTICLES.map((p, i) => {
        const drift = Math.sin(frame * p.speed + i * 1.5) * 3;
        const driftX = Math.cos(frame * p.speed * 0.7 + i) * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x + driftX}%`,
              top: `${p.y + drift}%`,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: "50%",
              background: p.color,
              opacity: p.opacity * (Math.sin(frame * 0.04 + i) * 0.3 + 0.7),
              boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            }}
          />
        );
      })}
    </div>
  );
};
