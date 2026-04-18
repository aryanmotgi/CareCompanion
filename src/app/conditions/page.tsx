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
  mild: 'bg-yellow-50 text-yellow-700',
  moderate: 'bg-orange-50 text-orange-700',
  severe: 'bg-red-50 text-red-700',
};

export default function ConditionsIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Chemotherapy Treatment Guides
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl">
          Plain-language guides for caregivers and patients — what to expect each day of your cycle, which symptoms to watch for, and when to call the care team.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              className="group border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {t.name}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{t.fullName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[maxSeverity]}`}>
                  {maxSeverity} effects
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {t.cancerTypes.slice(0, 2).map((c) => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {c}
                  </span>
                ))}
                {t.cancerTypes.length > 2 && (
                  <span className="text-xs text-gray-400">+{t.cancerTypes.length - 2} more</span>
                )}
              </div>

              <p className="text-sm text-gray-500 line-clamp-2">{t.description}</p>

              <div className="mt-3 flex gap-4 text-xs text-gray-400">
                <span>{t.cycleLength}-day cycle</span>
                <span>{t.typicalCycles} typical cycles</span>
                <span>{t.commonSideEffects.length} tracked side effects</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl bg-blue-50 border border-blue-100 p-6 text-center">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Have questions about a specific side effect?</h2>
        <p className="text-sm text-blue-700 mb-4">
          CareCompanion&apos;s AI can answer questions about symptoms, medications, and what to expect — any time of day.
        </p>
        <Link
          href="/chat/guest"
          className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Ask the AI — no signup needed
        </Link>
      </div>
    </div>
  );
}
