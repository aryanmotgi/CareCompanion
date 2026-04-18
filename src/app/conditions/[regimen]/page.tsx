import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTreatmentBySlug, getAllSlugs } from '@/lib/treatments';

interface Props {
  params: Promise<{ regimen: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ regimen: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regimen } = await params;
  const t = getTreatmentBySlug(regimen);
  if (!t) return {};

  const title = `${t.name} Chemotherapy: Side Effects, Critical Days & What to Expect`;
  const description = `Plain-language guide to ${t.name} (${t.fullName}) for caregivers. Day-by-day side effects, when to call the care team, and what to watch for during each ${t.cycleLength}-day cycle.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

const severityLabel: Record<string, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe — call if worsens',
};

const severityBg: Record<string, string> = {
  mild: 'bg-yellow-50 border-yellow-200',
  moderate: 'bg-orange-50 border-orange-200',
  severe: 'bg-red-50 border-red-200',
};

const severityBadge: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
};

const dayColors = ['bg-blue-50', 'bg-purple-50', 'bg-green-50', 'bg-orange-50'];

export default async function RegimenPage({ params }: Props) {
  const { regimen } = await params;
  const t = getTreatmentBySlug(regimen);
  if (!t) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <Link href="/conditions" className="hover:text-gray-600">All Treatments</Link>
        <span>/</span>
        <span className="text-gray-700">{t.name}</span>
      </nav>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          {t.cancerTypes.map((c) => (
            <span key={c} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
              {c}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{t.name}</h1>
        <p className="text-base text-gray-400 mb-4">{t.fullName}</p>
        <p className="text-gray-600 text-base leading-relaxed">{t.description}</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Cycle length', value: `${t.cycleLength} days` },
            { label: 'Typical course', value: `${t.typicalCycles} cycles` },
            { label: 'Side effects tracked', value: String(t.commonSideEffects.length) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-gray-100 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Side Effects */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Common Side Effects</h2>
        <div className="space-y-3">
          {t.commonSideEffects.map((se) => (
            <div
              key={se.name}
              className={`border rounded-xl p-4 ${severityBg[se.severity]}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{se.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{se.timing}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${severityBadge[se.severity]}`}>
                  {severityLabel[se.severity]}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Tip:</span> {se.tip}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Critical Days Timeline */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Critical Days in the Cycle</h2>
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100" />
          <div className="space-y-6 pl-12">
            {t.criticalDays.map((cd, i) => (
              <div key={cd.day} className="relative">
                <div className={`absolute -left-7 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 ${dayColors[i % dayColors.length]}`}>
                  {cd.day}
                </div>
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="font-semibold text-gray-900 text-sm mb-2">Day {cd.day} — {cd.label}</p>
                  {cd.watchFor.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Watch for</p>
                      <ul className="text-sm text-gray-600 space-y-0.5">
                        {cd.watchFor.map((w) => (
                          <li key={w} className="flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5">•</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 mt-2">
                    <p className="text-xs font-medium text-red-700">When to call:</p>
                    <p className="text-xs text-red-600 mt-0.5">{cd.whenToCall}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {t.faqs.map((faq) => (
            <div key={faq.question} className="border border-gray-100 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">{faq.question}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Have a question about {t.name} that&apos;s not answered here?
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          CareCompanion&apos;s AI assistant can answer questions about symptoms, what medications to expect, and when to contact the care team — any time, no signup needed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat/guest"
            className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Ask CareCompanion AI — free
          </Link>
          <Link
            href="/login"
            className="inline-block border border-gray-200 bg-white text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign up for full access
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Full access includes medication tracking, appointment reminders, and AI-powered visit prep sheets.
        </p>
      </div>

      {/* Related treatments */}
      <div className="mt-8 text-center">
        <Link href="/conditions" className="text-sm text-blue-600 hover:underline">
          ← Browse all treatment guides
        </Link>
      </div>
    </div>
  );
}
