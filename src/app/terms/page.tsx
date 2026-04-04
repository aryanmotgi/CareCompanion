import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — CareCompanion AI',
  description: 'Terms of service for using CareCompanion AI.',
};

export default function TermsOfService() {
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
        <h1 className="text-3xl font-bold mb-10">TERMS OF SERVICE — CareCompanion AI</h1>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">1. ACCEPTANCE OF TERMS</h2>
            <p>
              By using CareCompanion AI (&quot;CareCompanion&quot;, &quot;the app&quot;), you agree to these Terms of Service.
              If you do not agree, do not use the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">2. WHAT CARECOMPANION IS</h2>
            <p className="mb-3">
              CareCompanion is an AI-powered health organizer for cancer patients and their family caregivers. It helps
              you organize medical information, track medications, manage appointments, and communicate with an AI
              assistant about your loved one&apos;s health situation.
            </p>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-[var(--border)]">
              <p className="text-[var(--text)] font-medium">
                CareCompanion is a health information organizer, not a medical provider. Nothing in this app
                constitutes medical advice, diagnosis, or treatment.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">3. NOT MEDICAL ADVICE</h2>
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 mb-3">
              <p className="text-amber-300 font-medium">
                IMPORTANT: CareCompanion is not a substitute for professional medical advice, diagnosis, or treatment.
                Always seek the advice of your physician or qualified health provider with any questions about a medical
                condition. Never disregard professional medical advice because of something you read in this app.
              </p>
            </div>
            <p>
              For medical emergencies, call 911 immediately.<br />
              For mental health crises, call or text 988.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">4. YOUR ACCOUNT</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be 18 or older to create an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You are responsible for all activity under your account</li>
              <li>You must provide accurate information</li>
              <li>One person may manage multiple patient profiles (e.g. a caregiver managing a parent and spouse)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">5. HEALTH DATA</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You own all health data you enter into CareCompanion</li>
              <li>You grant CareCompanion a limited license to store and process your data solely to provide the service</li>
              <li>You are responsible for the accuracy of data you enter</li>
              <li>When you connect a health system, you authorize CareCompanion to import your records on your behalf</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">6. CARE TEAM</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You control who has access to each patient profile</li>
              <li>You are responsible for only inviting people you trust</li>
              <li>Invitations expire after 7 days</li>
              <li>You can remove care team members at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">7. ACCEPTABLE USE</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use CareCompanion for any unlawful purpose</li>
              <li>Enter false or misleading health information intentionally to deceive others</li>
              <li>Attempt to access another user&apos;s data</li>
              <li>Reverse engineer or tamper with the app</li>
              <li>Use the app to store data for someone without their knowledge or consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">8. AI LIMITATIONS</h2>
            <p className="mb-3">Our AI assistant:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Never diagnoses medical conditions</li>
              <li>Never recommends starting, stopping, or changing medications</li>
              <li>Never guarantees the safety of drug combinations</li>
              <li>Always defers to healthcare providers for medical decisions</li>
              <li>May make mistakes — always verify important medical information with your care team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">9. SERVICE AVAILABILITY</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted service. We are not liable for any
              harm caused by service downtime or data loss. We recommend exporting your data regularly from
              the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">10. TERMINATION</h2>
            <p>
              You may delete your account at any time from Settings. We may suspend accounts that violate these terms.
              Upon account deletion, all your data is permanently deleted within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">11. LIMITATION OF LIABILITY</h2>
            <p>
              CareCompanion is provided &quot;as is.&quot; To the maximum extent permitted by law, CareCompanion AI is not
              liable for any indirect, incidental, or consequential damages arising from your use of the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">12. CHANGES TO TERMS</h2>
            <p>
              We will notify users by email and in-app notification of material changes at least 14 days before they
              take effect. Continued use after that date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">13. GOVERNING LAW</h2>
            <p>These terms are governed by the laws of the State of California.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">14. CONTACT</h2>
            <p>
              For questions about these terms:<br />
              Email: <a href="mailto:privacy@carecompanionai.org" className="text-[#A78BFA] hover:underline">privacy@carecompanionai.org</a><br />
              Website: carecompanionai.org
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy Policy</Link>
          <span>&copy; {new Date().getFullYear()} CareCompanion AI</span>
        </div>
      </div>
    </div>
  );
}
