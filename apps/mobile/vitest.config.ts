import { defineConfig } from 'vitest/config'

// Mobile uses vitest only for pure-logic tests (no React Native runtime).
// Tests live under src/services/internal/__tests__ so the runner never imports
// modules that pull in react-native / expo / native bridges.
//
// `bun test` is also supported — the describe/it/expect API is compatible.
export default defineConfig({
  test: {
    include: ['src/services/internal/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
