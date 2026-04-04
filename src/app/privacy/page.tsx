import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — CareCompanion AI',
  description: 'How CareCompanion AI handles your health data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <p className="text-sm text-[var(--text-muted)] mb-2">Last Updated: April 3, 2026</p>
        <h1 className="text-3xl font-bold mb-10">PRIVACY POLICY — CareCompanion AI</h1>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">1. WHO WE ARE</h2>
            <p>
              CareCompanion AI (&quot;CareCompanion&quot;, &quot;we&quot;, &quot;us&quot;) is an AI-powered health organizer built for cancer patients
              and their family caregivers. We help families manage medications, appointments, lab results, and medical
              records in one place. Our website is carecompanionai.org.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">2. WHAT DATA WE COLLECT</h2>

            <h3 className="text-sm font-semibold text-[var(--text)] mt-4 mb-2">Data you provide directly:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Patient profile information (name, age, conditions, allergies)</li>
              <li>Medications, dosages, and refill dates</li>
              <li>Doctor and care team information</li>
              <li>Appointment details and notes</li>
              <li>Lab results and health records</li>
              <li>Insurance information</li>
              <li>Symptom journal entries</li>
              <li>Documents and medical files you upload</li>
              <li>Chat messages with our AI assistant</li>
            </ul>

            <h3 className="text-sm font-semibold text-[var(--text)] mt-4 mb-2">Data we collect automatically:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account email and authentication data</li>
              <li>App usage and feature interactions</li>
              <li>Device type and browser (for app performance only)</li>
            </ul>

            <h3 className="text-sm font-semibold text-[var(--text)] mt-4 mb-2">Data imported via health system connections:</h3>
            <p>
              When you connect your hospital account (e.g. Epic MyChart), we import only the data you explicitly
              authorize including medications, conditions, allergies, lab results, appointments, and insurance
              claims. This only happens with your direct consent through the hospital&apos;s official OAuth login flow.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">3. HOW WE USE YOUR DATA</h2>
            <p className="mb-3">We use your data solely to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Power the CareCompanion AI assistant and its responses</li>
              <li>Display your health information across the app</li>
              <li>Send medication reminders and appointment alerts you have enabled</li>
              <li>Generate health summaries and visit prep sheets</li>
              <li>Improve app performance and fix bugs</li>
            </ul>
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-[var(--border)]">
              <p className="text-[var(--text)] font-medium">We never use your health data for advertising.</p>
              <p className="text-[var(--text)] font-medium">We never sell your data to any third party, ever.</p>
              <p className="text-[var(--text)] font-medium">We never share your data with anyone without your explicit consent except as required by law.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">4. HOW WE STORE AND PROTECT YOUR DATA</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>All data is stored in Supabase (PostgreSQL), a SOC 2 Type II certified cloud database</li>
              <li>Row-level security ensures no user can access another user&apos;s data</li>
              <li>All data is encrypted in transit (HTTPS/TLS) and at rest</li>
              <li>API keys and credentials are never stored in code</li>
              <li>Care team access is permission-controlled — you decide who sees what</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">5. HEALTH SYSTEM INTEGRATIONS (FHIR/OAuth)</h2>
            <p className="mb-3">When you connect a health system like Epic MyChart:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are redirected to your hospital&apos;s official login page</li>
              <li>You log in and explicitly grant CareCompanion read-only access to your records</li>
              <li>We store only an encrypted access token in our database</li>
              <li>We never see or store your hospital login password</li>
              <li>You can disconnect any health system at any time from the Connect page, which immediately deletes your access token</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">6. CARE TEAM SHARING</h2>
            <p className="mb-3">When you invite family members to your care team:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You control their permission level (viewer, editor, or owner)</li>
              <li>They only see data for the patient profile you invited them to</li>
              <li>You can remove them at any time</li>
              <li>All care team activity is logged in the activity feed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">7. DATA RETENTION</h2>
            <p>
              We keep your data for as long as your account is active. If you delete your account, all associated
              data is permanently deleted within 30 days including patient profiles, medications, appointments, messages,
              memories, and uploaded documents. You can also export all your data before deletion from the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">8. YOUR RIGHTS</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access all your data (export from Settings)</li>
              <li>Correct any inaccurate data</li>
              <li>Delete your account and all associated data</li>
              <li>Disconnect any health system integration at any time</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">9. CHILDREN&apos;S PRIVACY</h2>
            <p>
              CareCompanion is not directed at children under 13. We do not knowingly collect data from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">10. CHANGES TO THIS POLICY</h2>
            <p>
              We will notify users by email and in-app notification of any material changes to this policy at least
              14 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">11. CONTACT US</h2>
            <p>
              For any privacy questions, data requests, or concerns:<br />
              Email: <a href="mailto:privacy@carecompanionai.org" className="text-[#A78BFA] hover:underline">privacy@carecompanionai.org</a><br />
              Website: carecompanionai.org
            </p>
          </section>

          <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)]">
              CareCompanion AI follows HIPAA-aligned security practices. We are not currently a HIPAA-covered entity.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms of Service</Link>
          <span>&copy; {new Date().getFullYear()} CareCompanion AI</span>
        </div>
      </div>
    </div>
  );
}
