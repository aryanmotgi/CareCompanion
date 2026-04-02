'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function usePullToRefresh() {
  const router = useRouter()
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const threshold = 80

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === 0) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0 && window.scrollY === 0) {
      setPulling(true)
      setPullDistance(Math.min(delta, threshold * 1.5))
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= threshold) {
      router.refresh()
    }
    setPulling(false)
    setPullDistance(0)
    startY.current = 0
  }, [pullDistance, router])

  useEffect(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { pulling, pullDistance, threshold }
}
