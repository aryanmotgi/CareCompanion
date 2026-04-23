export const flags = {
  // Add feature flags here as needed. Driven by EXPO_PUBLIC_ env vars.
  // Example: NEW_CHAT_UI: process.env.EXPO_PUBLIC_FF_NEW_CHAT_UI === 'true',
} as const

export type FeatureFlag = keyof typeof flags

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag]
}
