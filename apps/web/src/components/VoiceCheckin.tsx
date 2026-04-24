'use client'

import { useState, useCallback, useRef } from 'react'

interface VoiceCheckinProps {
  onExtracted: (fields: {
    mood: number | null
    pain: number | null
    energy: string | null
    sleep: string | null
  }) => void
  onError?: (message: string) => void
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'done'

export function VoiceCheckin({ onExtracted, onError }: VoiceCheckinProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setState('listening')
    }

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (!transcript) {
        setState('idle')
        onError?.('Could not understand speech. Please try again.')
        return
      }

      setState('processing')

      try {
        const res = await fetch('/api/checkins/voice-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to extract check-in data')
        }

        const data = await res.json()
        const fields = data.data ?? data

        setState('done')
        onExtracted({
          mood: fields.mood ?? null,
          pain: fields.pain ?? null,
          energy: fields.energy ?? null,
          sleep: fields.sleep ?? null,
        })

        // Reset to idle after a short delay
        setTimeout(() => setState('idle'), 1500)
      } catch (err) {
        setState('idle')
        onError?.(err instanceof Error ? err.message : 'Voice extraction failed')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState('idle')
      if (event.error !== 'aborted') {
        onError?.(`Speech error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Only reset to idle if we haven't moved to processing
      setState((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognition.start()
  }, [onExtracted, onError])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  function handleClick() {
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'processing'}
      className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg transition-all btn-press ${
        state === 'listening'
          ? 'border-red-500/50 bg-red-500/10 animate-pulse'
          : state === 'processing'
            ? 'border-[var(--border)] bg-white/[0.04] cursor-wait'
            : state === 'done'
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-[var(--border)] bg-white/[0.04] hover:bg-white/[0.08]'
      }`}
      title={
        state === 'listening'
          ? 'Tap to stop recording'
          : state === 'processing'
            ? 'Processing your voice...'
            : state === 'done'
              ? 'Fields extracted!'
              : 'Voice check-in'
      }
    >
      {state === 'processing' ? (
        <span className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      ) : state === 'done' ? (
        '\u2705'
      ) : (
        '\u{1F3A4}'
      )}
    </button>
  )
}
