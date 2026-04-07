'use client'

import { useState } from 'react'
import { LabTrends } from './LabTrends'
import { CaregiverWellness } from './CaregiverWellness'
import { RefillStatusCard } from './RefillStatus'

const TABS = [
  { key: 'trends', label: 'Lab Trends', icon: '📊' },
  { key: 'refills', label: 'Refills', icon: '💊' },
  { key: 'wellness', label: 'Wellness', icon: '💜' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function DashboardInsights() {
  const [activeTab, setActiveTab] = useState<TabKey>('trends')

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Insights
        </h3>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#6366F1]/20 to-[#A78BFA]/20 text-[#A78BFA] shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'trends' && <LabTrends />}
        {activeTab === 'refills' && <RefillStatusCard />}
        {activeTab === 'wellness' && <CaregiverWellness />}
      </div>
    </div>
  )
}
