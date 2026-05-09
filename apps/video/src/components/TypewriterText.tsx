import React from "react";
import { useCurrentFrame } from "remotion";

interface Props {
  text: string;
  startFrame: number;
  speed?: number; // chars per frame, default 0.55
  style?: React.CSSProperties;
  showCursor?: boolean;
}

export const TypewriterText: React.FC<Props> = ({
  text,
  startFrame,
  speed = 0.55,
  style,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const charsToShow = Math.min(
    text.length,
    Math.max(0, Math.floor((frame - startFrame) * speed))
  );

  const cursorVisible =
    showCursor &&
    charsToShow > 0 &&
    charsToShow < text.length &&
    Math.floor(frame * 0.08) % 2 === 0;

  if (charsToShow === 0) return null;

  return (
    <span style={style}>
      {text.slice(0, charsToShow)}
      {cursorVisible && (
        <span style={{ opacity: 0.7, marginLeft: 1 }}>|</span>
      )}
    </span>
  );
};
