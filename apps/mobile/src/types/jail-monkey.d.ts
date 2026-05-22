// Type shim for jail-monkey — no @types package available.
declare module 'jail-monkey' {
  interface JailMonkey {
    isJailBroken(): boolean
    canMockLocation(): boolean
    trustsArbitraryDomains(): boolean
    isOnExternalStorage(): boolean
    hookDetected(): boolean
    AdbEnabled(): boolean
  }
  const jailMonkey: JailMonkey
  export default jailMonkey
}
