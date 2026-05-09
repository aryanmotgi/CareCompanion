import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedGradient } from "../components/AnimatedGradient";
import { Particles } from "../components/Particles";

interface NodeDef {
  cx: number;
  cy: number;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  delay: number;
  w: number;
  h: number;
}

const NODES: NodeDef[] = [
  { cx: 960, cy: 500, label: "CareCompanion", sublabel: "React Native · Node.js", color: "#6ee7b7", bg: "rgba(110,231,183,0.1)", delay: 10, w: 240, h: 90 },
  { cx: 480, cy: 240, label: "Apple Sign-In", sublabel: "Healthcare auth", color: "#f1f5f9", bg: "rgba(241,245,249,0.07)", delay: 40, w: 200, h: 80 },
  { cx: 1440, cy: 240, label: "Apple HealthKit", sublabel: "Medical records sync", color: "#f43f5e", bg: "rgba(244,63,94,0.08)", delay: 55, w: 200, h: 80 },
  { cx: 480, cy: 760, label: "AWS Backend", sublabel: "HIPAA-compliant infra", color: "#fb923c", bg: "rgba(251,146,60,0.08)", delay: 70, w: 200, h: 80 },
  { cx: 1440, cy: 760, label: "Claude API", sublabel: "AI medical intelligence", color: "#a78bfa", bg: "rgba(167,139,250,0.08)", delay: 85, w: 200, h: 80 },
];

// Lines: from edge of source node to edge of target node
// [srcIdx, tgtIdx, color]
const LINES: Array<[number, number, string, number]> = [
  [1, 0, "#f1f5f929", 38],   // Sign-In → App
  [2, 0, "#f43f5e29", 48],   // HealthKit → App
  [0, 3, "#fb923c29", 58],   // App → AWS
  [0, 4, "#a78bfa29", 68],   // App → Claude
];

function edgePoint(n: NodeDef, toward: NodeDef): [number, number] {
  const dx = toward.cx - n.cx;
  const dy = toward.cy - n.cy;
  const angle = Math.atan2(dy, dx);
  const hw = n.w / 2;
  const hh = n.h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scaleX = Math.abs(cos) > 1e-9 ? hw / Math.abs(cos) : Infinity;
  const scaleY = Math.abs(sin) > 1e-9 ? hh / Math.abs(sin) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return [n.cx + cos * scale, n.cy + sin * scale];
}

const TechNode: React.FC<{ node: NodeDef }> = ({ node }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - node.delay, fps, config: { damping: 14, stiffness: 120 } });
  const scale = interpolate(prog, [0, 1], [0.7, 1]);
  const opacity = Math.min(1, prog * 1.5);

  return (
    <div
      style={{
        position: "absolute",
        left: node.cx - node.w / 2,
        top: node.cy - node.h / 2,
        width: node.w,
        height: node.h,
        background: node.bg,
        border: `1px solid ${node.color}44`,
        borderLeft: `3px solid ${node.color}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity,
        transform: `scale(${scale})`,
        zIndex: 4,
      }}
    >
      <div
        style={{
          color: node.color,
          fontSize: node.cx === 960 ? 18 : 16,
          fontWeight: 800,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          letterSpacing: "0.01em",
        }}
      >
        {node.label}
      </div>
      <div
        style={{
          color: "#475569",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "-apple-system, sans-serif",
          letterSpacing: "0.04em",
        }}
      >
        {node.sublabel}
      </div>
    </div>
  );
};

export const TechStack: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [120, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ background: "#050810" }}
    >
      <AnimatedGradient accentRgb="110,231,183" />
      <Particles />

      {/* SVG lines + particles */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: 1920,
          height: 1080,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {LINES.map(([si, ti, color, drawFrame], i) => {
          const src = NODES[si];
          const tgt = NODES[ti];
          const [x1, y1] = edgePoint(src, tgt);
          const [x2, y2] = edgePoint(tgt, src);
          const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          const drawProg = interpolate(frame, [drawFrame, drawFrame + 35], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const dashOffset = len * (1 - drawProg);
          const particlesVisible = drawProg >= 1;

          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
              />
              {particlesVisible &&
                [0, 0.35, 0.68].map((phase, pi) => {
                  const t = (frame * 0.011 + phase) % 1;
                  const px = x1 + (x2 - x1) * t;
                  const py = y1 + (y2 - y1) * t;
                  return (
                    <circle
                      key={pi}
                      cx={px}
                      cy={py}
                      r={3.5}
                      fill={NODES[si].color}
                      opacity={0.85}
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {NODES.map((n, i) => (
        <TechNode key={i} node={n} />
      ))}

      {/* Scene title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          zIndex: 10,
        }}
      >
        <div style={{
          color: "#475569",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "-apple-system, sans-serif",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}>
          BUILT ON
        </div>
        <div style={{
          color: "#f1f5f9",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          Production-Grade Infrastructure
        </div>
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 55,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          color: "#64748b",
          fontSize: 18,
          fontFamily: "-apple-system, sans-serif",
          fontWeight: 400,
          fontStyle: "italic",
          zIndex: 10,
        }}
      >
        Not a prototype — live at carecompanionai.org
      </div>
    </AbsoluteFill>
  );
};
