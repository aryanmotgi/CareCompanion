import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Message {
  role: "user" | "ai";
  text: string;
  appearFrame: number;
}

const MESSAGES: Message[] = [
  { role: "user", text: "What meds does Dad need tonight?", appearFrame: 25 },
  { role: "ai", text: "Lisinopril 10mg + Metformin 500mg before bed. His Aspirin is scheduled for morning. ✓", appearFrame: 90 },
  { role: "user", text: "Any drug interactions I should know?", appearFrame: 160 },
  { role: "ai", text: "No concerns — these are commonly co-prescribed and safe together.", appearFrame: 210 },
  { role: "user", text: "When's his next cardio appointment?", appearFrame: 290 },
  { role: "ai", text: "Dr. Chen — Thursday at 2:30 PM. I'll remind you the day before. ✓", appearFrame: 335 },
];

const TypingDots: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: "flex", gap: 5, padding: "12px 16px", alignItems: "center" }}>
    {[0, 10, 20].map((offset, i) => {
      const t = Math.sin((frame - offset) * 0.28) * 0.5 + 0.5;
      return (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#6ee7b7",
            opacity: 0.4 + t * 0.6,
            transform: `translateY(${-t * 4}px)`,
          }}
        />
      );
    })}
  </div>
);

export const AnimatedChat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const showTyping1 = frame >= 40 && frame < 90;
  const showTyping2 = frame >= 175 && frame < 210;
  const showTyping3 = frame >= 305 && frame < 335;
  const showTyping = showTyping1 || showTyping2 || showTyping3;

  const visibleMessages = MESSAGES.filter((m) => frame >= m.appearFrame);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#080d1a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6ee7b7 0%, #a78bfa 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#fff",
            fontWeight: 800,
          }}
        >
          ✦
        </div>
        <div>
          <div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700 }}>Care AI</div>
          <div style={{ color: "#6ee7b7", fontSize: 11, fontWeight: 500 }}>● Always available</div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          justifyContent: "flex-end",
          overflow: "hidden",
        }}
      >
        {visibleMessages.map((msg, i) => {
          const prog = spring({
            frame: frame - msg.appearFrame,
            fps,
            config: { damping: 16, stiffness: 130 },
          });
          const slideX = interpolate(prog, [0, 1], [msg.role === "user" ? 18 : -18, 0]);
          const opacity = Math.min(1, prog * 1.4);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                transform: `translateX(${slideX}px)`,
                opacity,
              }}
            >
              <div
                style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #0284c7, #0ea5e9)"
                      : "rgba(255,255,255,0.07)",
                  border:
                    msg.role === "ai"
                      ? "1px solid rgba(255,255,255,0.09)"
                      : "none",
                  color: msg.role === "user" ? "#fff" : "#cbd5e1",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {showTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "18px 18px 18px 4px",
              }}
            >
              <TypingDots frame={frame} />
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: "8px 14px",
            color: "#475569",
            fontSize: 13,
          }}
        >
          Ask about Harold's care...
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6ee7b7, #0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ↑
        </div>
      </div>
    </div>
  );
};
