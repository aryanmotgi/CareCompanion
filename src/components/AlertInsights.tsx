'use client'

import { useState } from 'react'

interface AlertInsightsProps {
  details: React.ReactNode
  insights: { text: string; emoji?: string }[]
  chatPrompt?: string
}

export function AlertInsights({ details, insights, chatPrompt }: AlertInsightsProps) {
  const [tab, setTab] = useState<'details' | 'actions'>('details')

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
        <button
          onClick={() => setTab('details')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
            tab === 'details'
              ? 'bg-white/[0.08] text-[#f1f5f9]'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setTab('actions')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
            tab === 'actions'
              ? 'bg-white/[0.08] text-[#f1f5f9]'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          }`}
        >
          What You Can Do
        </button>
      </div>

      {/* Tab content */}
      {tab === 'details' && details}

      {tab === 'actions' && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 bg-white/[0.03] rounded-lg px-3 py-2.5"
            >
              {insight.emoji ? (
                <span className="text-sm flex-shrink-0" aria-hidden="true">{insight.emoji}</span>
              ) : (
                <div className="w-1 h-1 rounded-full bg-[#A78BFA] mt-1.5 flex-shrink-0" />
              )}
              <span className="text-xs text-[#e2e8f0] leading-relaxed">{insight.text}</span>
            </div>
          ))}
          {chatPrompt && (
            <a
              href={`/chat?prompt=${encodeURIComponent(chatPrompt)}`}
              className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold mt-2 shimmer-btn relative overflow-hidden"
            >
              Ask AI for More Details
            </a>
          )}
        </div>
      )}
    </div>
  )
}
