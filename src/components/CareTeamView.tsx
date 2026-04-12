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
        headers: { 'Content-Type': 'application/json' },
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
  }, [showToast, loadTeam]);

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
                {(m.display_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{m.display_name || 'Unknown'}</p>
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
                <span className="text-base">✉️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{inv.invited_email}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Invited {timeAgo(inv.created_at)} · Expires {new Date(inv.expires_at).toLocaleDateString()}
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

      {/* Invite Form */}
      {canManage && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Invite Someone</h3>
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
                  <span className="text-white font-medium">{a.user_name || 'Someone'}</span>{' '}
                  {a.action}
                </p>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto flex-shrink-0">
                  {timeAgo(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
