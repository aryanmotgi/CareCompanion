'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CareTeamMember, CareTeamInvite, CareTeamActivity } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';
import { useCsrfToken } from '@/components/CsrfProvider';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Can Edit',
  viewer: 'View Only',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-indigo-500/20 text-indigo-400',
  editor: 'bg-emerald-500/20 text-emerald-400',
  viewer: 'bg-slate-500/20 text-slate-400',
};

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RoleExplanation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors w-full"
      >
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        What can each role do?
      </button>
      {open && (
        <div className="mt-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 space-y-3 animate-card-in">
          <div>
            <p className="text-sm font-medium text-white mb-1">Viewer (View Only)</p>
            <ul className="text-xs text-[var(--text-secondary)] space-y-0.5 ml-3 list-disc">
              <li>View medications, appointments, and lab results</li>
              <li>View the AI health summary</li>
              <li>Cannot make any changes or edits</li>
              <li>Cannot view chat history</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Editor (Can Edit)</p>
            <ul className="text-xs text-[var(--text-secondary)] space-y-0.5 ml-3 list-disc">
              <li>Everything a Viewer can do</li>
              <li>Add and update medications, appointments, and notes</li>
              <li>Log journal entries and upload documents</li>
              <li>Invite other members to the care team</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Owner</p>
            <ul className="text-xs text-[var(--text-secondary)] space-y-0.5 ml-3 list-disc">
              <li>Full access to all features</li>
              <li>Manage team members and roles</li>
              <li>Remove members from the care team</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function CareTeamView({ acceptInviteId }: { acceptInviteId?: string | null }) {
  const { showToast } = useToast();
  const csrfToken = useCsrfToken();
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [invites, setInvites] = useState<CareTeamInvite[]>([]);
  const [activity, setActivity] = useState<CareTeamActivity[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const canManage = myRole === 'owner' || myRole === 'editor';

  const loadTeam = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/care-team');
    const data = await res.json();
    setMembers(data.members || []);
    setInvites(data.invites || []);
    setActivity(data.activity || []);
    setMyRole(data.role);
    setLoading(false);
  }, []);

  const acceptInvite = useCallback(async (inviteId: string) => {
    setAcceptingInvite(true);
    setMessage(null);
    try {
      const res = await fetch('/api/care-team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message || 'You have joined the care team!', type: 'success' });
        showToast('Invite accepted', 'success');
      } else {
        setMessage({ text: data.error || 'Failed to accept invitation', type: 'error' });
        showToast(data.error || 'Failed to accept invitation', 'error');
      }
    } catch {
      setMessage({ text: 'Something went wrong accepting the invitation', type: 'error' });
      showToast('Something went wrong accepting the invitation', 'error');
    }
    setAcceptingInvite(false);
    // Remove the ?accept= param from the URL without a reload
    window.history.replaceState({}, '', '/care-team');
    loadTeam();
  }, [showToast, loadTeam, csrfToken]);

  useEffect(() => {
    if (acceptInviteId) {
      acceptInvite(acceptInviteId);
    } else {
      loadTeam();
    }
  }, [acceptInviteId, acceptInvite, loadTeam]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setMessage(null);

    const res = await fetch('/api/care-team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });

    const data = await res.json();
    if (data.success) {
      setMessage({ text: data.message, type: 'success' });
      setInviteEmail('');
      showToast('Invite sent', 'success');
      loadTeam();
    } else {
      setMessage({ text: data.error, type: 'error' });
      showToast(data.error || 'Failed to send invite', 'error');
    }
    setSending(false);
  }

  async function removeMember(memberId: string) {
    try {
      const res = await fetch('/api/care-team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ member_id: memberId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Member removed', 'success');
        loadTeam();
      } else {
        showToast(data.error || 'Failed to remove member', 'error');
      }
    } catch {
      showToast('Something went wrong removing the member', 'error');
    }
  }

  if (acceptingInvite) {
    return (
      <div className="px-5 py-8 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">Accepting invitation...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-5 py-8 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Care Team</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Invite family members or caregivers to share access to this care profile.
      </p>

      {/* Team Members */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Members</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {(m.displayName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{m.displayName || 'Unknown'}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{m.email || ''}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                {ROLE_LABELS[m.role]}
              </span>
              {canManage && m.role !== 'owner' && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Pending Invites</h3>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-[var(--bg-card)] border border-amber-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{inv.invitedEmail}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Invited {inv.createdAt ? timeAgo(inv.createdAt.toISOString()) : ''} · Expires {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '—'}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[inv.role]}`}>
                  {ROLE_LABELS[inv.role]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Explanation */}
      <RoleExplanation />

      {/* Invite Form */}
      {canManage && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Invite Someone</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Viewers can see medications, appointments, and your health summary — but cannot make changes or view chat history.
          </p>
          <form onSubmit={sendInvite} className="space-y-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-600 transition-colors"
              required
            />
            <div className="flex gap-3">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                className="flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg-elevated)] py-3 px-4 text-white focus:outline-none focus:border-blue-600 transition-colors"
              >
                <option value="viewer">View Only — can see everything</option>
                <option value="editor">Editor — can add and update data</option>
              </select>
              <button
                type="submit"
                disabled={sending || !inviteEmail.trim()}
                className="rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sending ? 'Sending...' : 'Invite'}
              </button>
            </div>
          </form>
          {message && (
            <p className={`text-sm mt-2 ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Activity</h3>
          <div className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="text-white font-medium">{a.userName || 'Someone'}</span>{' '}
                  {a.action}
                </p>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto flex-shrink-0">
                  {a.createdAt ? timeAgo(a.createdAt.toISOString()) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
