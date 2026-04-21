// apps/mobile/src/theme.ts
import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const THEME_KEY = 'cc_theme_override'
export type ThemeOverride = 'dark' | 'light' | 'system'

export interface Theme {
  bg: string
  bgWarm: string
  bgCard: string
  bgCardBorder: string
  bgElevated: string
  accent: string
  accentHover: string
  lavender: string
  text: string
  textSub: string
  textMuted: string
  green: string
  amber: string
  rose: string
  border: string
  borderHover: string
  isDark: boolean
  shadowCard: {
    shadowColor: string
    shadowOffset: { width: number; height: number }
    shadowOpacity: number
    shadowRadius: number
    elevation: number
  }
  gradientA: string[]
  gradientB: string[]
}

const dark: Theme = {
  bg: '#0C0E1A',
  bgWarm: '#10122B',
  bgCard: 'rgba(167,139,250,0.06)',
  bgCardBorder: 'rgba(167,139,250,0.12)',
  bgElevated: 'rgba(167,139,250,0.10)',
  accent: '#6366F1',
  accentHover: '#818CF8',
  lavender: '#A78BFA',
  text: '#EDE9FE',
  textSub: '#A5B4CF',
  textMuted: 'rgba(255,255,255,0.35)',
  green: '#6EE7B7',
  amber: '#FCD34D',
  rose: '#FCA5A5',
  border: 'rgba(167,139,250,0.08)',
  borderHover: 'rgba(167,139,250,0.18)',
  isDark: true,
  shadowCard: {
    shadowColor: '#0F0A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  gradientA: ['#0C0E1A', '#10122B', 'rgba(99,102,241,0.08)', '#0C0E1A'],
  gradientB: ['#10122B', '#0C0E1A', 'rgba(167,139,250,0.12)', '#10122B'],
}

const light: Theme = {
  bg: '#FAFAFA',
  bgWarm: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardBorder: 'rgba(99,102,241,0.12)',
  bgElevated: 'rgba(99,102,241,0.04)',
  accent: '#6366F1',
  accentHover: '#4F46E5',
  lavender: '#7C3AED',
  text: '#1E1B4B',
  textSub: '#475569',
  textMuted: '#94A3B8',
  green: '#059669',
  amber: '#D97706',
  rose: '#DC2626',
  border: 'rgba(99,102,241,0.10)',
  borderHover: 'rgba(99,102,241,0.20)',
  isDark: false,
  shadowCard: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  gradientA: ['#FAFAFA', '#F5F3FF', 'rgba(99,102,241,0.04)', '#FAFAFA'],
  gradientB: ['#F5F3FF', '#FAFAFA', 'rgba(99,102,241,0.07)', '#F5F3FF'],
}

export const shared = {
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 24,
} as const

export function useTheme(): Theme {
  const systemScheme = useColorScheme()
  const [override, setOverride] = useState<ThemeOverride>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark' || val === 'light' || val === 'system') setOverride(val)
    })
  }, [])

  const isDark =
    override === 'system' ? systemScheme === 'dark' : override === 'dark'
  return isDark ? dark : light
}

export async function setThemeOverride(value: ThemeOverride): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, value)
}
