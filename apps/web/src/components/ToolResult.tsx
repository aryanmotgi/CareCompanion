'use client';

const TOOL_LABELS: Record<string, string> = {
  save_medication: 'Medication Saved',
  update_medication: 'Medication Updated',
  remove_medication: 'Medication Removed',
  save_appointment: 'Appointment Scheduled',
  save_doctor: 'Doctor Added',
  update_care_profile: 'Profile Updated',
  save_lab_result: 'Lab Result Saved',
  get_lab_trends: 'Lab Trends',
  save_insurance: 'Insurance Saved',
  save_memory: 'Remembered',
  generate_visit_prep: 'Visit Prep Ready',
  save_visit_notes: 'Visit Notes Saved',
  set_medication_reminder: 'Reminder Set',
  log_symptoms: 'Symptoms Logged',
  get_symptom_trends: 'Symptom Trends',
  generate_health_summary: 'Summary Ready',
  estimate_cost: 'Cost Estimate',
};

interface ToolResultProps {
  toolName: string;
  result: Record<string, unknown>;
}

export function ToolResult({ toolName, result }: ToolResultProps) {
  const label = TOOL_LABELS[toolName] || 'Action Completed';
  const success = result?.success !== false;
  const message = (result?.message as string) || (result?.error as string) || '';

  // Special rendering for lab trends
  if (toolName === 'get_lab_trends' && Array.isArray(result?.results) && result.results.length > 0) {
    const results = result.results as Array<{
      test_name: string;
      value: string;
      unit?: string;
      date_taken?: string;
      is_abnormal?: boolean;
    }>;
    return (
      <div className="my-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden max-w-sm">
        <div className="px-3 py-2 bg-blue-500/10 border-b border-[var(--border)] flex items-center gap-2">
          <svg className="w-4 h-4 text-[#A78BFA]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>
          <span className="text-sm font-medium text-[#A78BFA]">Lab Trends — {results[0].test_name}</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{r.date_taken || 'No date'}</span>
              <span className={`font-mono ${r.is_abnormal ? 'text-amber-400' : 'text-emerald-400'}`}>
                {r.value} {r.unit || ''}
                {r.is_abnormal && <span className="ml-1 text-xs text-amber-400">↑</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`my-2 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 max-w-sm ${
      success
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : 'border-red-500/20 bg-red-500/5'
    }`}>
      <div className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 ${success ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${success ? 'bg-emerald-400' : 'bg-red-400'}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${success ? 'text-emerald-400' : 'text-red-400'}`}>
          {success ? label : 'Action Failed'}
        </p>
        {message && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{message}</p>
        )}
      </div>
    </div>
  );
}
