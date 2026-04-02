'use client'

export function useHaptic() {
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  return {
    tap: () => vibrate(10),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([50, 30, 50]),
  }
}
