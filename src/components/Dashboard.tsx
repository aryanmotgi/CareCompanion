'use client';

import type { Notification, Insurance, Claim, LabResult, Appointment, Medication, PriorAuth, FsaHsa } from '@/lib/types';

interface DashboardProps {
  notifications: Notification[];
  insurance: Insurance[];
  claims: Claim[];
  labResults: LabResult[];
  appointments: Appointment[];
  medications: Medication[];
  connectedApps: Array<{ source: string; last_synced: string | null }>;
  priorAuths: PriorAuth[];
  fsaHsa: FsaHsa[];
}

function Card({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="font-display font-semibold text-slate-900">{title}</h2>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Dashboard({
  notifications,
  insurance,
  claims,
  labResults,
  appointments,
  medications,
  connectedApps,
  priorAuths,
  fsaHsa,
}: DashboardProps) {
  const urgentNotifications = notifications.filter((n) => n.type === 'claim_denied' || n.type === 'lab_result');
  const upcomingRefills = medications.filter((m) => m.refill_date && new Date(m.refill_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const deniedClaims = claims.filter((c) => c.status === 'denied');
  const abnormalLabs = labResults.filter((l) => l.is_abnormal);
  const expiringAuths = priorAuths.filter((a) => a.expiry_date && new Date(a.expiry_date) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  // Calculate OOP spending
  const totalOop = insurance.length > 0 ? insurance[0] : null;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {urgentNotifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <h3 className="font-display font-semibold text-amber-900">Attention Needed</h3>
          </div>
          <div className="space-y-2">
            {urgentNotifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'claim_denied' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-sm font-medium text-amber-900">{n.title}</p>
                  {n.message && <p className="text-xs text-amber-700">{n.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{medications.length}</p>
          <p className="text-sm text-slate-500">Medications</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
          <p className="text-sm text-slate-500">Appointments</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{connectedApps.length}</p>
          <p className="text-sm text-slate-500">Connected Apps</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <p className={`text-2xl font-bold ${notifications.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {notifications.length}
          </p>
          <p className="text-sm text-slate-500">Alerts</p>
        </div>
      </div>

      {/* OOP Tracker */}
      {totalOop && totalOop.oop_limit && (
        <Card title="Out-of-Pocket Tracker">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">{totalOop.provider}</p>
              <p className="text-sm font-medium text-slate-900">
                ${totalOop.oop_used.toLocaleString()} / ${totalOop.oop_limit.toLocaleString()}
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  totalOop.oop_used / totalOop.oop_limit > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min((totalOop.oop_used / totalOop.oop_limit) * 100, 100)}%` }}
              />
            </div>
            {totalOop.deductible_limit && (
              <p className="text-xs text-slate-400 mt-2">
                Deductible: ${totalOop.deductible_used.toLocaleString()} / ${totalOop.deductible_limit.toLocaleString()}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Refills */}
        <Card
          title="Upcoming Refills"
          badge={
            upcomingRefills.length > 0 ? (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                {upcomingRefills.length} due soon
              </span>
            ) : undefined
          }
        >
          {upcomingRefills.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming refills</p>
          ) : (
            <div className="space-y-3">
              {upcomingRefills.map((med) => (
                <div key={med.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{med.name}</p>
                    <p className="text-xs text-slate-500">{med.dose}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-600">
                    {med.refill_date ? new Date(med.refill_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Lab Results */}
        <Card
          title="Recent Labs"
          badge={
            abnormalLabs.length > 0 ? (
              <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                {abnormalLabs.length} abnormal
              </span>
            ) : undefined
          }
        >
          {labResults.length === 0 ? (
            <p className="text-sm text-slate-400">No lab results synced yet</p>
          ) : (
            <div className="space-y-3">
              {labResults.slice(0, 5).map((lab) => (
                <div key={lab.id} className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${lab.is_abnormal ? 'text-red-700' : 'text-slate-800'}`}>
                      {lab.test_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {lab.value} {lab.unit} {lab.reference_range ? `(ref: ${lab.reference_range})` : ''}
                    </p>
                  </div>
                  {lab.is_abnormal && (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Abnormal</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Claims */}
        <Card title="Claims">
          {claims.length === 0 ? (
            <p className="text-sm text-slate-400">No claims synced yet</p>
          ) : (
            <div className="space-y-3">
              {deniedClaims.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-medium text-red-700">{deniedClaims.length} denied claim{deniedClaims.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              {claims.slice(0, 5).map((claim) => (
                <div key={claim.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{claim.provider_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">
                      {claim.service_date ? new Date(claim.service_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    claim.status === 'paid' ? 'text-green-700 bg-green-50' :
                    claim.status === 'denied' ? 'text-red-700 bg-red-50' :
                    'text-amber-700 bg-amber-50'
                  }`}>
                    {claim.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Prior Auths */}
        <Card
          title="Prior Authorizations"
          badge={
            expiringAuths.length > 0 ? (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                {expiringAuths.length} expiring soon
              </span>
            ) : undefined
          }
        >
          {priorAuths.length === 0 ? (
            <p className="text-sm text-slate-400">No prior authorizations</p>
          ) : (
            <div className="space-y-3">
              {priorAuths.map((auth) => (
                <div key={auth.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{auth.service}</p>
                    <p className="text-xs text-slate-500">
                      {auth.sessions_approved ? `${auth.sessions_used}/${auth.sessions_approved} sessions` : auth.status}
                    </p>
                  </div>
                  {auth.expiry_date && (
                    <span className="text-xs text-slate-500">
                      Expires {new Date(auth.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* FSA/HSA */}
      {fsaHsa.length > 0 && (
        <Card title="FSA / HSA Accounts">
          <div className="space-y-4">
            {fsaHsa.map((account) => (
              <div key={account.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800">
                    {account.provider} ({account.account_type.toUpperCase()})
                  </p>
                  <p className="text-sm font-bold text-slate-900">${account.balance.toLocaleString()}</p>
                </div>
                {account.contribution_limit && (
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${Math.min((account.balance / account.contribution_limit) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Connected Apps Status */}
      <Card title="Connected Apps">
        {connectedApps.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-3">No apps connected yet</p>
            <a href="/settings" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Connect your first app
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {connectedApps.map((app) => (
              <div key={app.source} className="flex items-center justify-between py-2">
                <p className="text-sm font-medium text-slate-800 capitalize">{app.source.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-400">
                  {app.last_synced
                    ? `Synced ${new Date(app.last_synced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : 'Never synced'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
