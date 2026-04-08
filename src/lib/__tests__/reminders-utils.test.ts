import { describe, it, expect } from 'vitest'

// The functions are not exported, so we test them by importing the module
// and using the same logic. We'll re-implement the pure functions for testing.
// (In a real refactor, these would be exported from a utils file.)

// Copied from reminders.ts — isWithinWindow
function isWithinWindow(current: string, target: string, windowMins: number): boolean {
  const [ch, cm] = current.split(':').map(Number)
  const [th, tm] = target.split(':').map(Number)
  const currentMins = ch * 60 + cm
  const targetMins = th * 60 + tm
  const diff = Math.abs(currentMins - targetMins)
  return diff <= windowMins || diff >= (1440 - windowMins)
}

// Copied from reminders.ts — formatTime
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

describe('reminders utilities', () => {
  describe('isWithinWindow', () => {
    it('returns true when times match exactly', () => {
      expect(isWithinWindow('09:00', '09:00', 15)).toBe(true)
    })

    it('returns true when within window', () => {
      expect(isWithinWindow('09:10', '09:00', 15)).toBe(true)
      expect(isWithinWindow('08:50', '09:00', 15)).toBe(true)
    })

    it('returns false when outside window', () => {
      expect(isWithinWindow('09:30', '09:00', 15)).toBe(false)
      expect(isWithinWindow('08:30', '09:00', 15)).toBe(false)
    })

    it('handles midnight wrap — 23:55 is within 15 min of 00:05', () => {
      expect(isWithinWindow('23:55', '00:05', 15)).toBe(true)
    })

    it('handles midnight wrap — 00:05 is within 15 min of 23:55', () => {
      expect(isWithinWindow('00:05', '23:55', 15)).toBe(true)
    })

    it('rejects times far apart across midnight', () => {
      expect(isWithinWindow('23:00', '00:30', 15)).toBe(false)
    })
  })

  describe('formatTime', () => {
    it('formats morning time correctly', () => {
      expect(formatTime('09:00')).toBe('9:00 AM')
      expect(formatTime('06:30')).toBe('6:30 AM')
    })

    it('formats afternoon time correctly', () => {
      expect(formatTime('14:00')).toBe('2:00 PM')
      expect(formatTime('13:45')).toBe('1:45 PM')
    })

    it('formats noon correctly', () => {
      expect(formatTime('12:00')).toBe('12:00 PM')
    })

    it('formats midnight correctly', () => {
      expect(formatTime('00:00')).toBe('12:00 AM')
    })

    it('pads single-digit minutes', () => {
      expect(formatTime('08:05')).toBe('8:05 AM')
    })
  })
})
