// apps/mobile/src/hooks/useJailbreakCheck.ts
//
// Detects jailbreak (iOS) / root (Android) at launch using jail-monkey.
// HIPAA §164.312(a)(1): access-control safeguards must prevent unauthorized
// access — a jailbroken device bypasses the Keychain sandbox that protects
// cc-session-token and cc-csrf-token, so we must warn (block is optional).
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import JailMonkey from 'jail-monkey'

export function useJailbreakCheck(): boolean {
  const [isJailbroken, setIsJailbroken] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') return
    try {
      setIsJailbroken(JailMonkey.isJailBroken())
    } catch {
      // jail-monkey unavailable (simulator without native module) — treat as safe
    }
  }, [])

  return isJailbroken
}
