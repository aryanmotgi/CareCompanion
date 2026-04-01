'use client'

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-blob-1"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.04) 0%, transparent 70%)',
          top: '-10%',
          right: '-10%',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-blob-2"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.04) 0%, transparent 70%)',
          bottom: '-5%',
          left: '-10%',
          filter: 'blur(80px)',
        }}
      />
    </div>
  )
}
