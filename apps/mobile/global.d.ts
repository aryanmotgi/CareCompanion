// Expo injects EXPO_PUBLIC_* vars via babel at build time.
// TypeScript doesn't know about `process` in the React Native / DOM lib set,
// so we declare only the subset our code uses.
declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string
    [key: string]: string | undefined
  }
}
