#!/usr/bin/env bun
// Codegen step: reads /DESIGN.md (root), emits dist/globals-tokens.css.
// Run with `bun run build` inside packages/design-tokens.
// Note: For now this script is a no-op stub because the source files
// (src/colors.ts, src/glow.ts, etc.) are already authored from DESIGN.md
// by hand. Future iteration: parse DESIGN.md YAML front-matter and regenerate
// the *.ts sources automatically so DESIGN.md becomes the single editing surface.

import { colorsDark, colorsLight } from '../src/colors';
import { radii } from '../src/radii';
import { glow, glowSoft } from '../src/glow';
import { easingCss, duration } from '../src/motion';

function rgbaOrHexCssValue(v: string): string {
  return v;
}

function emit(): string {
  const dark = Object.entries(colorsDark)
    .map(([k, v]) => `  --${camelToKebab(k)}: ${rgbaOrHexCssValue(v)};`)
    .join('\n');
  const light = Object.entries(colorsLight)
    .map(([k, v]) => `  --${camelToKebab(k)}: ${rgbaOrHexCssValue(v)};`)
    .join('\n');
  const radius = Object.entries(radii)
    .map(([k, v]) => `  --radius-${k}: ${v}px;`)
    .join('\n');
  const glowVars = Object.entries(glow)
    .map(([k, v]) => `  --glow-${k}: ${v};`)
    .join('\n');
  const glowSoftVars = Object.entries(glowSoft)
    .map(([k, v]) => `  --glow-soft-${k}: ${v};`)
    .join('\n');
  const easings = Object.entries(easingCss)
    .map(([k, v]) => `  --easing-${camelToKebab(k)}: ${v};`)
    .join('\n');
  const durations = Object.entries(duration)
    .map(([k, v]) => `  --duration-${k}: ${v * 1000}ms;`)
    .join('\n');

  return `/* Auto-generated from packages/design-tokens. Do not edit by hand. */

:root {
${dark}
${radius}
${glowVars}
${glowSoftVars}
${easings}
${durations}
}

[data-theme="light"] {
${light}
}
`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

if (import.meta.main) {
  const out = emit();
  const path = new URL('../dist/globals-tokens.css', import.meta.url);
  await Bun.write(path, out);
  console.log(`wrote ${path.pathname} (${out.length} bytes)`);
}

export { emit };
