'use client'

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Indigo orb — top right */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-blob-1"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%)',
          top: 'max(env(safe-area-inset-top, 0px), 60px)',
          right: '-10%',
          filter: 'blur(80px)',
        }}
      />
      {/* Lavender orb — bottom left */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-blob-2"
        style={{
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.06) 0%, transparent 70%)',
          bottom: '-5%',
          left: '-10%',
          filter: 'blur(80px)',
        }}
      />
      {/* Soft blue orb — center */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-blob-3"
        style={{
          background: 'radial-gradient(circle, rgba(129, 140, 248, 0.04) 0%, transparent 70%)',
          top: '35%',
          left: '15%',
          filter: 'blur(100px)',
        }}
      />
      {/* Faint violet orb — bottom right */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full animate-blob-4"
        style={{
          background: 'radial-gradient(circle, rgba(196, 181, 253, 0.03) 0%, transparent 70%)',
          bottom: '15%',
          right: '5%',
          filter: 'blur(90px)',
        }}
      />
    </div>
  )
}
