const DELAY_MS = parseInt(process.env.EXPO_PUBLIC_NETWORK_DELAY_MS || '0', 10)
const isEnabled = __DEV__ && DELAY_MS > 0

export async function simulateNetworkDelay(): Promise<void> {
  if (!isEnabled) return
  const jitter = DELAY_MS * (0.5 + Math.random())
  await new Promise(resolve => setTimeout(resolve, jitter))
}

export function createSlowFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  if (!isEnabled) return baseFetch
  return async (input, init) => {
    await simulateNetworkDelay()
    return baseFetch(input, init)
  }
}
