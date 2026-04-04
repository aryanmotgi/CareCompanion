import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — CareCompanion',
  description: 'Terms of service for using CareCompanion.',
};

export default function TermsOfService() {
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

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">Last updated: April 3, 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CareCompanion (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, do not use the Service. CareCompanion is operated by CareCompanion
              (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">2. Description of Service</h2>
            <p>
              CareCompanion is a health management platform designed for cancer patients and their family caregivers.
              The Service includes:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Health record organization and tracking (medications, appointments, lab results, insurance).</li>
              <li>AI-powered assistance for understanding health information, preparing for medical appointments, and managing treatment side effects.</li>
              <li>Integration with health portals via SMART on FHIR for automated data syncing.</li>
              <li>Document scanning and data extraction from medical records.</li>
              <li>Treatment journal for tracking symptoms and side effects.</li>
              <li>Care team collaboration features for family caregivers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">3. Not Medical Advice</h2>
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 mb-3">
              <p className="text-amber-300 font-medium text-sm">
                CareCompanion is NOT a medical device, does NOT provide medical advice, and is NOT a substitute
                for professional medical care.
              </p>
            </div>
            <ul className="list-disc pl-5 space-y-2">
              <li>The AI assistant provides informational support only. It does not diagnose conditions, prescribe treatments, or replace the judgment of qualified healthcare professionals.</li>
              <li>Lab result interpretations, medication information, and treatment-related content are for educational purposes and should always be discussed with your oncology team.</li>
              <li>Always consult your doctor, oncologist, or pharmacist before making any decisions about medications, treatments, or care plans.</li>
              <li>In case of a medical emergency, call 911 or your local emergency number immediately.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">4. Accounts and Registration</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide a valid email address to create an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must be at least 18 years old to create an account. Parents or legal guardians may create profiles to manage care for minors.</li>
              <li>You may create profiles for people you are authorized to care for. You represent that you have the legal authority or consent to manage their health information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">5. Connected Health Services</h2>
            <p className="mb-3">
              When you connect external health services (Epic MyChart, Cerner, Medicare Blue Button, etc.):
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You authorize CareCompanion to access your health records through those services using the SMART on FHIR protocol.</li>
              <li>We request read-only access. We do not modify records at the source.</li>
              <li>You may disconnect any service at any time through the Connect page.</li>
              <li>Your use of connected health services is also subject to the terms and conditions of those services.</li>
              <li>We are not responsible for the accuracy, completeness, or availability of data provided by third-party health services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Access health records of individuals without their consent or legal authorization.</li>
              <li>Attempt to access other users&apos; accounts or data.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use the Service to store or transmit malicious code.</li>
              <li>Use automated tools (bots, scrapers) to access the Service beyond normal use.</li>
              <li>Rely on AI-generated content as a substitute for professional medical advice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">7. Data Accuracy</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are responsible for verifying the accuracy of data you enter or that is synced from connected services.</li>
              <li>Our document scanning and AI extraction features use optical character recognition and language models that may make errors. Always verify extracted data against the original document.</li>
              <li>We do not guarantee the accuracy, completeness, or timeliness of health data synced from third-party services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">8. Care Team Features</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>By inviting someone to your care team, you grant them access to view or edit the associated patient profile based on the role you assign.</li>
              <li>You are responsible for managing care team membership and permissions.</li>
              <li>Care team members must also agree to these Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">9. Intellectual Property</h2>
            <p>
              The Service, including its design, code, AI models integration, and content (excluding your personal data),
              is owned by CareCompanion and protected by applicable intellectual property laws. You retain ownership of
              all health data and content you provide to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">10. Service Availability</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We strive to keep the Service available at all times but do not guarantee uninterrupted access.</li>
              <li>We may perform maintenance, updates, or improvements that temporarily affect availability.</li>
              <li>Third-party services (health portals, AI providers) may experience outages beyond our control.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, CareCompanion shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to damages arising from:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Reliance on information provided by the Service or its AI features.</li>
              <li>Medical decisions made based on data displayed in the Service.</li>
              <li>Errors in data synced from third-party health services.</li>
              <li>Unauthorized access to your account due to compromised credentials.</li>
              <li>Service interruptions or data loss.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">12. Termination</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You may delete your account at any time. Account deletion permanently removes all associated data.</li>
              <li>We may suspend or terminate accounts that violate these terms or engage in abusive behavior.</li>
              <li>Upon termination, your right to use the Service ends immediately.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">13. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. If we make material changes, we will notify you through
              the app or by email. Your continued use of the Service after changes constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">14. Governing Law</h2>
            <p>
              These terms are governed by the laws of the State of California, United States, without regard to
              conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">15. Contact</h2>
            <p>
              If you have questions about these terms, contact us at{' '}
              <a href="mailto:legal@carecompanionai.org" className="text-[#A78BFA] hover:underline">legal@carecompanionai.org</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy Policy</Link>
          <span>&copy; {new Date().getFullYear()} CareCompanion</span>
        </div>
      </div>
    </div>
  );
}
