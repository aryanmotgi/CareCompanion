import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['300','400','500','600','700','800'] });

export const metadata: Metadata = {
  title: 'CareCompanion — AI-Powered Cancer Care',
  description: 'One intelligent companion for your entire cancer journey.',
  robots: { index: false, follow: false },
};

export default function OnePager() {
  return (
    <main className={jakarta.className} style={{ background: '#080A14', color: '#e2e8f0', minHeight: '100vh' }}>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 32px' }}>

        {/* ── HEADER ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #6366F1, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#fff' }}>CareCompanion</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, lineHeight: 1.7, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
            Your Intelligent Cancer Care Companion<br />
            Built for Patients &amp; Caregivers<br />
            carecompanionai.org
          </div>
        </header>

        {/* ── HERO ── */}
        <section style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', color: '#fff', marginBottom: 16 }}>
            Cancer patients aren&apos;t losing their health.<br />
            They&apos;re losing their{' '}
            <span style={{ color: '#A78BFA' }}>context.</span>
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(226,232,240,0.6)', maxWidth: 680 }}>
            Missed refills. Out-of-the-loop caregivers. Lab numbers with no explanation. Appointments with forgotten questions.
            Every problem below is real, exhausting, and avoidable. They all trace back to one root cause.
          </p>
        </section>

        {/* ── THE PROBLEMS ── */}
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 16 }}>The Problems</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            {[
              {
                n: '01', title: 'Scattered Records',
                body: 'Patients juggle 5+ apps for chemo logs, meds, labs, notes, and appointments. Nothing talks to each other.',
                cite: 'Cancer patient surveys',
              },
              {
                n: '02', title: 'Missed Refills',
                body: '30% of cancer patients experience a medication gap during active treatment. Caregivers rarely know what\'s running low.',
                cite: 'NCBI, 2023',
              },
              {
                n: '03', title: 'Caregiver Isolation',
                body: 'Family caregivers spend 4+ hours per week tracking down treatment updates. Most hear about changes days late.',
                cite: 'Caregiver Action Network',
              },
              {
                n: '04', title: 'Lab Result Anxiety',
                body: 'Patients wait 72+ hours for context on abnormal values. A flagged number with no explanation causes unnecessary panic.',
                cite: 'JAMA Oncology',
              },
              {
                n: '05', title: 'Lost Visit Prep',
                body: '60% of cancer patients forget their most important questions before an oncology visit. Critical decisions get deferred another cycle.',
                cite: 'ASCO Patient Survey',
              },
            ].map((item) => (
              <div key={item.n} style={{ padding: '20px 16px', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.06em', marginBottom: 6 }}>{item.n}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>{item.title}</div>
                <div style={{ fontSize: 11, lineHeight: 1.65, color: 'rgba(226,232,240,0.5)', marginBottom: 12 }}>{item.body}</div>
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.07)', paddingTop: 8, fontSize: 9, color: 'rgba(167,139,250,0.4)', letterSpacing: '0.04em' }}>{item.cite}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ROOT CAUSE CALLOUT ── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '20px 24px', background: 'rgba(99,102,241,0.06)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(167,139,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#A78BFA" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                All of this has one root cause:{' '}
                <span style={{ color: '#A78BFA' }}>fragmentation.</span>
              </p>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(226,232,240,0.55)' }}>
                Medical records live in one portal. Medications in another app. Caregiver updates in a group chat. Lab values on paper.
                Nothing is connected. Every visit, every refill, every caregiver conversation starts from scratch.
              </p>
            </div>
          </div>
        </section>

        {/* ── INTRODUCING ── */}
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 14 }}>Introducing CareCompanion</p>
          <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em', color: '#fff', maxWidth: 680, marginBottom: 0 }}>
            Imagine having one intelligent companion that knows your entire cancer journey —{' '}
            <span style={{ color: '#A78BFA' }}>always current, always context-aware.</span>
          </h2>
        </section>

        {/* ── FLOW DIAGRAM ── */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.5)', marginBottom: 16 }}>How It Works</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Source of Truth</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Hospital Records · Medications<br />Lab Results · Appointments</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px', color: 'rgba(167,139,250,0.5)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Connects &amp; Understands</div>
                <svg width="32" height="12" viewBox="0 0 32 12" fill="none"><path d="M0 6h28M22 1l6 5-6 5" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 20px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)', marginBottom: 2 }}>Your Companion</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#A78BFA' }}>CareCompanion</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px', color: 'rgba(167,139,250,0.5)' }}>
                <svg width="32" height="12" viewBox="0 0 32 12" fill="none"><path d="M0 6h28M22 1l6 5-6 5" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Delivers Context</div>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Everyone On The Team</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Patient · Family Caregiver<br />Oncologist · Nurse Navigator</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── EXPLANATION PARAGRAPH ── */}
        <section style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(226,232,240,0.55)' }}>
            Today that context lives across fragmented portals, sticky notes, and group chats. CareCompanion captures it with{' '}
            <strong style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 600 }}>treatment tracking</strong>{' '}
            (every chemo cycle, every tumor marker, always current),{' '}
            <strong style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 600 }}>AI that knows your chart</strong>{' '}
            (answers grounded in your specific meds and labs, not generic health information),{' '}
            <strong style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 600 }}>real-time caregiver sync</strong>{' '}
            (family and care team see the same dashboard), and{' '}
            <strong style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 600 }}>proactive alerts</strong>{' '}
            (refills due, abnormal labs flagged, appointment prep — surfaced before they become problems).
          </p>
        </section>

        {/* ── THE PRODUCT ── */}
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 16 }}>The Product</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            {[
              {
                n: '01', title: 'Treatment Tracker',
                body: 'Chemo cycles, tumor markers, and blood counts — surfaced automatically and always current. Never lose track of where you are in treatment.',
                label: 'Surfaces',
                tags: ['Dashboard', 'Timeline', 'Alerts'],
              },
              {
                n: '02', title: 'Oncology AI',
                body: 'Ask anything about chemo side effects, tumor markers, or lab results. Get clear, plain-language answers grounded in your actual records — not generic health info.',
                label: 'Available on',
                tags: ['Web', 'iOS', 'Android'],
              },
              {
                n: '03', title: 'Care Team Hub',
                body: 'One shared dashboard for your whole care team. Family caregivers, nurses, and oncologists stay aligned without endless phone calls.',
                label: 'Supports',
                tags: ['Individual', 'Family', 'Clinical'],
              },
            ].map((item) => (
              <div key={item.n} style={{ padding: '24px 20px', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.06em', marginBottom: 8 }}>{item.n}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12, lineHeight: 1.3 }}>{item.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(226,232,240,0.5)', marginBottom: 20 }}>{item.body}</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {item.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10, color: 'rgba(226,232,240,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 7px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BAR ── */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '18px 24px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'linear-gradient(135deg, #6366F1, #A78BFA)', color: '#fff', padding: '7px 14px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                Free to Use
              </span>
              <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.6)' }}>
                Every cancer patient deserves this.{' '}
                <strong style={{ color: 'rgba(226,232,240,0.85)', fontWeight: 600 }}>No credit card. No setup fee.</strong>
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', whiteSpace: 'nowrap' }}>
              carecompanionai.org →
            </span>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>
            CareCompanion · AI-Powered Cancer Care
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            Know someone going through cancer?{' '}
            <span style={{ color: '#A78BFA', textDecoration: 'underline', textDecorationColor: 'rgba(167,139,250,0.3)' }}>Send this page.</span>
          </span>
        </footer>

      </div>
    </main>
  );
}
