import { Metadata } from 'next';
import Link from 'next/link';
import { treatments } from '@/lib/treatments';

export const metadata: Metadata = {
  title: 'Cancer Chemotherapy Treatment Guides | CareCompanion',
  description: 'Plain-language guides for common chemotherapy regimens — side effects, critical days, and what to watch for. Written for caregivers.',
  openGraph: {
    title: 'Cancer Chemotherapy Treatment Guides | CareCompanion',
    description: 'Plain-language guides for common chemotherapy regimens — side effects, critical days, and what to watch for.',
    type: 'website',
  },
};

const severityColors: Record<string, string> = {
  mild: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  moderate: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
  severe: 'bg-red-500/10 border-red-500/20 text-red-300',
};

export default function ConditionsIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-3">
          Chemotherapy Treatment Guides
        </h1>
        <p className="text-base text-white/50 max-w-2xl">
          Plain-language guides for caregivers and patients — what to expect each day of your cycle, which symptoms to watch for, and when to call the care team.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {treatments.map((t) => {
          const maxSeverity = t.commonSideEffects.some(s => s.severity === 'severe')
            ? 'severe'
            : t.commonSideEffects.some(s => s.severity === 'moderate')
            ? 'moderate'
            : 'mild';

          return (
            <Link
              key={t.slug}
              href={`/conditions/${t.slug}`}
              className="group border border-white/[0.06] rounded-xl p-5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#6366F1]/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-base font-semibold text-white group-hover:text-[#A78BFA] transition-colors">
                    {t.name}
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">{t.fullName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${severityColors[maxSeverity]}`}>
                  {maxSeverity} effects
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {t.cancerTypes.slice(0, 2).map((c) => (
                  <span key={c} className="text-xs bg-[#6366F1]/10 text-[#A78BFA] border border-[#6366F1]/20 px-2 py-0.5 rounded-full">
                    {c}
                  </span>
                ))}
                {t.cancerTypes.length > 2 && (
                  <span className="text-xs text-white/30">+{t.cancerTypes.length - 2} more</span>
                )}
              </div>

              <p className="text-sm text-white/50 line-clamp-2">{t.description}</p>

              <div className="mt-3 flex gap-4 text-xs text-white/30">
                <span>{t.cycleLength}-day cycle</span>
                <span>{t.typicalCycles} typical cycles</span>
                <span>{t.commonSideEffects.length} tracked side effects</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#6366F1]/[0.08] to-[#A78BFA]/[0.06] border border-[#6366F1]/20 p-6 text-center">
        <h2 className="text-base font-semibold text-white mb-2">Have questions about a specific side effect?</h2>
        <p className="text-sm text-white/50 mb-4">
          CareCompanion&apos;s AI can answer questions about symptoms, medications, and what to expect — any time of day.
        </p>
        <Link
          href="/chat/guest"
          className="inline-block bg-[#6366F1] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4f52d9] transition-colors"
        >
          Ask the AI — no signup needed
        </Link>
      </div>
    </div>
  );
}
