import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — CareCompanion',
  description: 'How CareCompanion handles your health data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">Last updated: April 3, 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Overview</h2>
            <p>
              CareCompanion is a health management platform built for cancer patients and their family caregivers.
              We take the privacy and security of your health information extremely seriously. This policy explains
              what data we collect, how we use it, and how we protect it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Information We Collect</h2>
            <p className="mb-3">When you use CareCompanion, we may collect and store:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-[var(--text)]">Account information:</strong> Email address and authentication credentials (managed by Supabase Auth).</li>
              <li><strong className="text-[var(--text)]">Health information you provide:</strong> Patient profiles, medications, conditions, allergies, appointments, doctors, symptom journal entries, and notes you enter manually or through our AI chat.</li>
              <li><strong className="text-[var(--text)]">Health records from connected services:</strong> When you connect a health portal (e.g., Epic MyChart, Cerner, Medicare Blue Button), we access your records via SMART on FHIR APIs with your explicit consent. This may include medications, lab results, conditions, allergies, appointments, insurance claims, and coverage information.</li>
              <li><strong className="text-[var(--text)]">Documents you upload:</strong> Photos of prescription labels, lab reports, insurance cards, and other medical documents you scan using our document extraction feature.</li>
              <li><strong className="text-[var(--text)]">Conversation data:</strong> Messages you send to the AI assistant, along with AI-generated summaries used to provide personalized care support.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide personalized cancer care management, including treatment tracking, medication reminders, appointment preparation, and lab result interpretation.</li>
              <li>To power our AI assistant with context about your care situation so it can give relevant, specific answers rather than generic responses.</li>
              <li>To sync health data from connected portals and keep your records up to date.</li>
              <li>To generate alerts for medication refills, abnormal lab results, upcoming appointments, and insurance claim denials.</li>
              <li>To enable care team collaboration so authorized family members can help manage care.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">How We Protect Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-[var(--text)]">Encryption:</strong> All data is encrypted in transit (TLS 1.2+) and at rest (AES-256).</li>
              <li><strong className="text-[var(--text)]">Access control:</strong> Row-level security (RLS) ensures you can only access your own data. Care team members have role-based permissions (owner, editor, viewer).</li>
              <li><strong className="text-[var(--text)]">OAuth tokens:</strong> Access tokens for connected health services are stored securely and are never exposed to the frontend. Tokens are automatically refreshed and old tokens are overwritten.</li>
              <li><strong className="text-[var(--text)]">No third-party analytics:</strong> We do not use third-party analytics or tracking services that have access to your health data.</li>
              <li><strong className="text-[var(--text)]">Infrastructure:</strong> Our backend runs on Supabase (PostgreSQL with RLS) and Vercel, both of which maintain SOC 2 compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Connected Health Services (SMART on FHIR)</h2>
            <p className="mb-3">
              When you connect a health portal, we use the SMART on FHIR standard (the same protocol your hospital uses for patient access apps).
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You authenticate directly with your health provider. We never see your portal username or password.</li>
              <li>We request read-only access to your health records. We cannot modify your records at the source.</li>
              <li>You can disconnect any service at any time, which revokes our access and removes stored tokens.</li>
              <li>Data synced from health portals is stored in your CareCompanion account and subject to the same protections as manually entered data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">AI Processing</h2>
            <p className="mb-3">
              Our AI assistant is powered by Anthropic&apos;s Claude. When you interact with the AI:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your messages and relevant health context are sent to Anthropic&apos;s API for processing.</li>
              <li>Anthropic does not use your data to train their models (per their commercial API terms).</li>
              <li>The AI never diagnoses conditions, recommends starting or stopping medications, or replaces professional medical advice.</li>
              <li>AI-generated responses are for informational purposes and should always be verified with your healthcare team.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">What We Never Do</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We <strong className="text-[var(--text)]">never sell</strong> your health data to anyone.</li>
              <li>We <strong className="text-[var(--text)]">never share</strong> your data with advertisers, data brokers, or marketing companies.</li>
              <li>We <strong className="text-[var(--text)]">never use</strong> your health data for purposes other than providing you with CareCompanion&apos;s services.</li>
              <li>We <strong className="text-[var(--text)]">never retain</strong> data after account deletion (see below).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Data Retention and Deletion</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your data is retained as long as your account is active.</li>
              <li>You can export all your data at any time.</li>
              <li>You can delete your account and all associated data at any time. Deletion is permanent and irreversible.</li>
              <li>When you disconnect a health service, stored tokens are immediately deleted. Synced data remains in your account unless you delete it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Care Team Sharing</h2>
            <p>
              If you invite family members or caregivers to your care team, they will have access to the patient profile
              based on their assigned role (viewer or editor). You control who has access and can revoke it at any time.
              Care team members see the same data you see for the shared profile, but cannot access your account settings,
              other profiles, or billing information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Children&apos;s Privacy</h2>
            <p>
              CareCompanion can be used to manage care for patients of any age, including children, when set up by a
              parent or legal guardian. We do not knowingly collect information directly from children under 13 without
              parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. If we make material changes, we will notify you through
              the app or by email. Your continued use of CareCompanion after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">Contact</h2>
            <p>
              If you have questions about this privacy policy or how your data is handled, contact us at{' '}
              <a href="mailto:privacy@carecompanionai.org" className="text-[#A78BFA] hover:underline">privacy@carecompanionai.org</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms of Service</Link>
          <span>&copy; {new Date().getFullYear()} CareCompanion</span>
        </div>
      </div>
    </div>
  );
}
