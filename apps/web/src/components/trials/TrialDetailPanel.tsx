'use client'
import { useState, useEffect } from 'react'

type Contact = { name: string | null; phone: string | null; email: string | null }

type Location = {
  facility: string | null
  city: string | null
  state: string | null
  country: string | null
  status: string | null
  contacts?: Contact[]
}

type TrialDetail = {
  nct_id: string
  title: string
  official_title: string | null
  organization: string | null
  status: string | null
  phase: string | null
  study_type: string | null
  enrollment: number | null
  conditions: string | null
  eligibility_criteria: string | null
  min_age: string | null
  max_age: string | null
  interventions: Array<{ type: string; name: string }> | null
  primary_outcomes: string[] | null
  central_contacts: Contact[]
  locations: Location[]
  url: string
}

export type DetailContent = {
  trial:            TrialDetail
  contact:          Contact | null
  all_contacts:     Contact[]
  summary:          string
  visit_frequency:  string
  email: {
    to:      string | null
    subject: string
    body:    string
  }
  phone_script:     string
  clinical_summary: string | null
}

type Props = {
  nctId:        string
  isCloseMatch: boolean
  matchReasons:         string[]
  uncertainFactors:     string[]
  onSave:    (nctId: string) => void
  savedStatus: string | null   // null = not saved, otherwise the interestStatus
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function ContactBlock({ contact, trialUrl }: { contact: Contact | null; trialUrl?: string }) {
  if (!contact || (!contact.name && !contact.email && !contact.phone)) {
    return (
      <p className="text-sm text-gray-500 italic">
        Contact information not listed —{' '}
        {trialUrl
          ? <a href={trialUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">visit the trial page directly</a>
          : <span className="text-gray-500">visit the trial page directly</span>
        }.
      </p>
    )
  }
  return (
    <div className="space-y-0.5">
      {contact.name  && <p className="text-sm text-gray-800">{contact.name}</p>}
      {contact.email && (
        <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline block">
          {contact.email}
        </a>
      )}
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline block">
          {contact.phone}
        </a>
      )}
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

export function TrialDetailPanel({ nctId, isCloseMatch, matchReasons, uncertainFactors, onSave, savedStatus }: Props) {
  const [content, setContent]   = useState<DetailContent | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [emailExpanded, setEmailExpanded]   = useState(false)
  const [scriptExpanded, setScriptExpanded] = useState(false)
  const [eligExpanded, setEligExpanded]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/trials/${nctId}/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCloseMatch }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { setError(data.error); setLoading(false); return }
        setContent(data as DetailContent)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [nctId, isCloseMatch])

  if (loading) {
    return (
      <div className="border-t border-gray-100 pt-4 pb-2 px-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="animate-spin">⏳</span>
          Generating summary and contact details…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-red-600">Could not load trial details. <a href={`https://clinicaltrials.gov/study/${nctId}`} target="_blank" rel="noopener noreferrer" className="underline">View on ClinicalTrials.gov →</a></p>
      </div>
    )
  }

  if (!content) return null

  const { trial, contact, all_contacts, summary, visit_frequency, email, phone_script, clinical_summary } = content

  const recruitingLocations = trial.locations.filter(l => l.status === 'RECRUITING')
  const topLocations = (recruitingLocations.length > 0 ? recruitingLocations : trial.locations).slice(0, 3)

  return (
    <div className="border-t border-gray-100 pt-4 space-y-5">

      {/* 1. Plain language summary */}
      <Section title="What is this trial?">
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        {visit_frequency && (
          <p className="text-sm text-gray-600 italic">{visit_frequency}</p>
        )}
      </Section>

      {/* 2. Key details */}
      <Section title="Key details">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            ['Phase',        trial.phase ?? 'Not listed'],
            ['Status',       trial.status ?? 'Unknown'],
            ['Sponsor',      trial.organization ?? 'Not listed'],
            ['Enrollment',   trial.enrollment ? `~${trial.enrollment} participants` : 'Not listed'],
            ['Age range',    trial.min_age && trial.max_age ? `${trial.min_age} – ${trial.max_age}` : 'Not listed'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs text-gray-400">{k}</dt>
              <dd className="text-sm text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 3. Nearest locations */}
      <Section title="Nearest locations">
        {topLocations.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No location data available — <a href={trial.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">check ClinicalTrials.gov</a>.</p>
        ) : (
          <ul className="space-y-2">
            {topLocations.map((loc, i) => (
              <li key={i} className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-800 font-medium">{loc.facility ?? 'Unknown facility'}</p>
                  <p className="text-xs text-gray-500">{[loc.city, loc.state, loc.country].filter(Boolean).join(', ')}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${
                  loc.status === 'RECRUITING' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {loc.status === 'RECRUITING' ? 'Recruiting' : (loc.status ?? 'Status unknown')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Contact information */}
      <Section title="Contact information">
        {all_contacts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Contact information not listed — <a href={trial.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">visit the trial page directly</a>.
          </p>
        ) : (
          <div className="space-y-3">
            {all_contacts.map((c, i) => <ContactBlock key={i} contact={c} trialUrl={trial.url} />)}
          </div>
        )}
      </Section>

      {/* 5. Why you match */}
      {(matchReasons.length > 0 || uncertainFactors.length > 0) && (
        <Section title="Why you match">
          <ul className="space-y-1">
            {matchReasons.map((r, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>{r}
              </li>
            ))}
            {uncertainFactors.map((u, i) => (
              <li key={i} className="text-sm text-amber-700 flex gap-2">
                <span className="flex-shrink-0 mt-0.5">?</span>{u}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 6. Eligibility criteria (collapsed) */}
      {trial.eligibility_criteria && (
        <Section title="Eligibility criteria">
          <button
            onClick={() => setEligExpanded(e => !e)}
            className="text-xs text-blue-600 hover:underline"
          >
            {eligExpanded ? 'Hide full criteria ▲' : 'Show full criteria ▼'}
          </button>
          {eligExpanded && (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed mt-2 max-h-64 overflow-y-auto border border-gray-100 rounded p-3 bg-gray-50">
              {trial.eligibility_criteria}
            </pre>
          )}
        </Section>
      )}

      {/* 7. Pre-drafted email */}
      <Section title="Pre-drafted email">
        <div className="rounded-lg border border-gray-200 bg-gray-50">
          <button
            onClick={() => setEmailExpanded(e => !e)}
            className="w-full text-left px-3 py-2.5 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-gray-700">To: {email.to ?? <span className="italic text-gray-400">No email found — add manually</span>}</p>
              <p className="text-xs text-gray-500">Subject: {email.subject}</p>
            </div>
            <span className="text-xs text-gray-400 ml-2">{emailExpanded ? '▲' : '▼'}</span>
          </button>
          {emailExpanded && (
            <div className="px-3 pb-3 border-t border-gray-200">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-3">
                {email.body}
              </pre>
              <div className="flex gap-2 mt-3 flex-wrap">
                <CopyButton text={email.body} label="Copy email body" />
                {email.to && (
                  <a
                    href={`mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Open in email app →
                  </a>
                )}
                {!email.to && (
                  <p className="text-xs text-amber-700 italic self-center">
                    No coordinator email found — find contact on <a href={trial.url} target="_blank" rel="noopener noreferrer" className="underline">ClinicalTrials.gov</a>.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 8. Phone call script */}
      <Section title="Phone call script">
        <div className="rounded-lg border border-gray-200 bg-gray-50">
          <button
            onClick={() => setScriptExpanded(s => !s)}
            className="w-full text-left px-3 py-2.5 flex items-center justify-between"
          >
            <p className="text-xs font-medium text-gray-700">Read this when you call the trial site</p>
            <span className="text-xs text-gray-400 ml-2">{scriptExpanded ? '▲' : '▼'}</span>
          </button>
          {scriptExpanded && (
            <div className="px-3 pb-3 border-t border-gray-200">
              {contact?.phone && (
                <p className="text-xs text-gray-500 mt-2">
                  Call: <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                </p>
              )}
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-3">
                {phone_script}
              </pre>
              <div className="mt-3">
                <CopyButton text={phone_script} label="Copy script" />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 9. Share with oncologist — clinical summary */}
      {clinical_summary && (
        <Section title="Share with oncologist">
          <div className="rounded-lg border border-gray-200 bg-gray-50">
            <div className="px-3 py-2.5 flex items-start justify-between gap-2">
              <p className="text-xs text-gray-600 leading-relaxed">
                Clinical referral note — written for your oncologist, not the trial coordinator.
              </p>
            </div>
            <div className="px-3 pb-3 border-t border-gray-200">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-3">
                {clinical_summary}
              </pre>
              <div className="flex gap-2 mt-3 flex-wrap">
                <CopyButton text={clinical_summary} label="Copy for oncologist" />
                <a
                  href={`mailto:?subject=Clinical Trial for Review: ${trial.nct_id}&body=${encodeURIComponent(clinical_summary.replace(/[\r\n]+/g, ' '))}`}
                  className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                >
                  Email to oncologist →
                </a>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* 10. Save and track */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        {savedStatus === null ? (
          <button
            onClick={() => onSave(nctId)}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save &amp; track this trial
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-700 font-medium">✓ Saved — tracking status changes</span>
            <span className="text-xs text-gray-400 capitalize">({savedStatus})</span>
          </div>
        )}
        <a
          href={trial.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on ClinicalTrials.gov →
        </a>
      </div>
    </div>
  )
}
