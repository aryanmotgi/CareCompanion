'use client'

import { Children, isValidElement } from 'react'

interface AnimatedListProps {
  children: React.ReactNode
  className?: string
  staggerMs?: number
}

export function AnimatedList({ children, className = '', staggerMs = 60 }: AnimatedListProps) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child
        return (
          <div
            className="animate-slide-up"
            style={{ animationDelay: `${i * staggerMs}ms`, animationFillMode: 'both' }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
