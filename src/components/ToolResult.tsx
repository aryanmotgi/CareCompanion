'use client';

const TOOL_ICONS: Record<string, string> = {
  save_medication: '💊',
  update_medication: '💊',
  remove_medication: '🗑️',
  save_appointment: '📅',
  save_doctor: '👨‍⚕️',
  update_care_profile: '📋',
  save_lab_result: '🔬',
  get_lab_trends: '📊',
  save_insurance: '🏥',
  save_memory: '🧠',
  generate_visit_prep: '📋',
  save_visit_notes: '📝',
  set_medication_reminder: '⏰',
  log_symptoms: '📓',
  get_symptom_trends: '📈',
  generate_health_summary: '📄',
  estimate_cost: '💲',
};

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
  const icon = TOOL_ICONS[toolName] || '⚡';
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
          <span>📊</span>
          <span className="text-sm font-medium text-[#A78BFA]">Lab Trends — {results[0].test_name}</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{r.date_taken || 'No date'}</span>
              <span className={`font-mono ${r.is_abnormal ? 'text-amber-400' : 'text-emerald-400'}`}>
                {r.value} {r.unit || ''}
                {r.is_abnormal && ' ⚠️'}
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
      <span className="text-lg mt-0.5">{success ? icon : '❌'}</span>
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
