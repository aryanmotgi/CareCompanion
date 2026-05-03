'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface InfoTooltipProps {
  content: string
  patientName?: string
}

export function InfoTooltip({ content, patientName }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Replace [patient name] in content if patientName is provided
  const displayContent = patientName ? content.replace('[patient name]', patientName) : content

  // Handle click outside to close popover
  const handleDocumentMouseDown = (event: MouseEvent) => {
    if (!buttonRef.current || !popoverRef.current) return

    const target = event.target as Node
    const isClickOutside = !buttonRef.current.contains(target) && !popoverRef.current.contains(target)

    if (isClickOutside) {
      setOpen(false)
    }
  }

  // Attach/detach mousedown listener when popover is open
  if (typeof document !== 'undefined') {
    if (open) {
      document.addEventListener('mousedown', handleDocumentMouseDown)
    } else {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
    }
  }

  // Get button position for popover placement
  const getPopoverPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 }

    const rect = buttonRef.current.getBoundingClientRect()
    const popoverWidth = 240
    const popoverHeight = 100 // approximate
    const gap = 8 // space below button
    const marginX = 8 // viewport margin

    // Center below button
    let left = rect.left + rect.width / 2 - popoverWidth / 2

    // Cap to viewport with margins
    if (left < marginX) {
      left = marginX
    } else if (left + popoverWidth > window.innerWidth - marginX) {
      left = window.innerWidth - popoverWidth - marginX
    }

    const top = rect.bottom + gap

    return { top, left }
  }

  const position = getPopoverPosition()

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Info"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7EB] text-xs font-bold text-[#6B7280] hover:bg-[#D1D5DB]"
      >
        ?
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="pointer-events-auto fixed z-50 w-60 rounded-[10px] bg-white p-3 text-xs leading-relaxed text-[#374151]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
              fontSize: '12px',
            }}
          >
            {displayContent}
          </div>,
          document.body
        )}
    </>
  )
}
