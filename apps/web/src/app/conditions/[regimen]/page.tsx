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
  mild: 'bg-yellow-500/10 border-yellow-500/20',
  moderate: 'bg-orange-500/10 border-orange-500/20',
  severe: 'bg-red-500/10 border-red-500/20',
};

const severityBadge: Record<string, string> = {
  mild: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  moderate: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  severe: 'bg-red-500/15 text-red-300 border-red-500/20',
};

const dayAccents = [
  'bg-[#6366F1]/15 text-[#A78BFA]',
  'bg-violet-500/15 text-violet-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-orange-500/15 text-orange-300',
];

export default async function RegimenPage({ params }: Props) {
  const { regimen } = await params;
  const t = getTreatmentBySlug(regimen);
  if (!t) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-white/30 mb-6 flex items-center gap-2">
        <Link href="/conditions" className="hover:text-white/60 transition-colors">All Treatments</Link>
        <span>/</span>
        <span className="text-white/70">{t.name}</span>
      </nav>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          {t.cancerTypes.map((c) => (
            <span key={c} className="text-xs bg-[#6366F1]/10 text-[#A78BFA] border border-[#6366F1]/20 px-2.5 py-1 rounded-full">
              {c}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">{t.name}</h1>
        <p className="text-base text-white/40 mb-4">{t.fullName}</p>
        <p className="text-white/60 text-base leading-relaxed">{t.description}</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Cycle length', value: `${t.cycleLength} days` },
            { label: 'Typical course', value: `${t.typicalCycles} cycles` },
            { label: 'Side effects tracked', value: String(t.commonSideEffects.length) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-white/[0.06] rounded-xl p-3 text-center bg-white/[0.02]">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Side Effects */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Common Side Effects</h2>
        <div className="space-y-3">
          {t.commonSideEffects.map((se) => (
            <div
              key={se.name}
              className={`border rounded-xl p-4 ${severityBg[se.severity]}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-white text-sm">{se.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">{se.timing}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border ${severityBadge[se.severity]}`}>
                  {severityLabel[se.severity]}
                </span>
              </div>
              <p className="text-sm text-white/60">
                <span className="font-medium text-white/80">Tip:</span> {se.tip}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Critical Days Timeline */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Critical Days in the Cycle</h2>
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.06]" />
          <div className="space-y-6 pl-12">
            {t.criticalDays.map((cd, i) => (
              <div key={cd.day} className="relative">
                <div className={`absolute -left-7 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${dayAccents[i % dayAccents.length]}`}>
                  {cd.day}
                </div>
                <div className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02]">
                  <p className="font-semibold text-white text-sm mb-2">Day {cd.day} &#x2014; {cd.label}</p>
                  {cd.watchFor.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-white/30 uppercase tracking-wide mb-1">Watch for</p>
                      <ul className="text-sm text-white/60 space-y-0.5">
                        {cd.watchFor.map((w) => (
                          <li key={w} className="flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5">&#x2022;</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-red-500/[0.08] border border-red-500/20 rounded-lg p-2.5 mt-2">
                    <p className="text-xs font-medium text-red-300">When to call:</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{cd.whenToCall}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {t.faqs.map((faq) => (
            <div key={faq.question} className="border border-white/[0.06] rounded-xl p-5 bg-white/[0.02]">
              <h3 className="font-semibold text-white text-sm mb-2">{faq.question}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-2xl bg-gradient-to-br from-[#6366F1]/[0.08] to-[#A78BFA]/[0.06] border border-[#6366F1]/20 p-6">
        <h2 className="text-base font-semibold text-white mb-2">
          Have a question about {t.name} that&apos;s not answered here?
        </h2>
        <p className="text-sm text-white/50 mb-4">
          CareCompanion&apos;s AI assistant can answer questions about symptoms, what medications to expect, and when to contact the care team — any time, no signup needed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat/guest"
            className="inline-block bg-[#6366F1] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4f52d9] transition-colors"
          >
            Ask CareCompanion AI &#x2014; free
          </Link>
          <Link
            href="/login"
            className="inline-block border border-white/[0.1] bg-white/[0.04] text-white/70 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Sign up for full access
          </Link>
        </div>
        <p className="text-xs text-white/30 mt-3">
          Full access includes medication tracking, appointment reminders, and AI-powered visit prep sheets.
        </p>
      </div>

      {/* Related treatments */}
      <div className="mt-8 text-center">
        <Link href="/conditions" className="text-sm text-[#A78BFA] hover:text-[#c4b5fd] transition-colors">
          &#x2190; Browse all treatment guides
        </Link>
      </div>
    </div>
  );
}
