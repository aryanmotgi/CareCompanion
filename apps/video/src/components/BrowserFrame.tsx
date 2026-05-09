import React from "react";

interface Props {
  children: React.ReactNode;
  width?: number;
  height?: number;
  url?: string;
}

export const BrowserFrame: React.FC<Props> = ({
  children,
  width = 1380,
  height = 860,
  url = "carecompanionai.org",
}) => {
  const CHROME_H = 46;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(0,0,0,0.75)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: CHROME_H,
          background: "#161b2a",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 18,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 7 }}>
          {(["#ef4444", "#f59e0b", "#22c55e"] as const).map((c, i) => (
            <div
              key={i}
              style={{ width: 13, height: 13, borderRadius: "50%", background: c }}
            />
          ))}
        </div>

        {/* URL bar */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.07)",
              borderRadius: 7,
              padding: "5px 22px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 300,
            }}
          >
            <span style={{ fontSize: 12 }}>🔒</span>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 13,
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {url}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          width: "100%",
          height: height - CHROME_H,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};
