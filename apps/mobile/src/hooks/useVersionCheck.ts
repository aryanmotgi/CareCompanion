import { useEffect, useState } from 'react'
import * as Application from 'expo-application'
import { Platform } from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
const VERSION_URL = `${API_BASE}/api/version`

interface VersionState {
  loading: boolean
  forceUpdate: boolean
  killSwitch: boolean
  killReason?: string
  message?: string
}

export function useVersionCheck(): VersionState {
  const [state, setState] = useState<VersionState>({
    loading: true,
    forceUpdate: false,
    killSwitch: false,
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(VERSION_URL, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res.ok) {
          if (!cancelled) setState({ loading: false, forceUpdate: false, killSwitch: false })
          return
        }
        const data = await res.json()
        const build = parseInt(Application.nativeBuildVersion ?? '0', 10)
        const minBuild = Platform.OS === 'ios' ? data.minIosBuild : data.minAndroidBuild
        const forceUpdate = Number.isFinite(minBuild) && build < minBuild

        if (!cancelled) {
          setState({
            loading: false,
            forceUpdate,
            killSwitch: data.killSwitch === true,
            killReason: data.killReason,
            message: data.message,
          })
        }
      } catch {
        if (!cancelled) setState({ loading: false, forceUpdate: false, killSwitch: false })
      }
    }

    void check()
    return () => { cancelled = true }
  }, [])

  return state
}
