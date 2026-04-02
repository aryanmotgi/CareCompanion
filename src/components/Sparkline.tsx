'use client'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({ values, width = 80, height = 24, color = '#22d3ee', className = '' }: SparklineProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
      {/* Dot on last value */}
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
        r="2"
        fill={color}
      />
    </svg>
  )
}
