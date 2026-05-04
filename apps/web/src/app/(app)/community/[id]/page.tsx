'use client';

import { useState, useEffect, use } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

const REPLY_MIN = 5;
const REPLY_MAX = 1000;

interface Reply {
  id: string;
  authorLabel: string;
  body: string;
  upvotes: number;
  createdAt: string;
}

interface Post {
  id: string;
  authorLabel: string;
  cancerType: string;
  title: string;
  body: string;
  upvotes: number;
  replyCount: number;
  createdAt: string;
  hasUpvoted: boolean;
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [upvoting, setUpvoting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/community/${id}`);
        if (!res.ok) {
          setLoadError('Failed to load this post.');
          return;
        }
        const json = await res.json();
        if (!json.ok) {
          setLoadError('Failed to load this post.');
          return;
        }
        setPost(json.data.post);
        setReplies(json.data.replies);
      } catch {
        setLoadError('Failed to load this post.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleUpvote() {
    if (!post || upvoting) return;
    const prevPost = post;
    // Optimistic update
    setPost((p) => p ? ({
      ...p,
      hasUpvoted: !p.hasUpvoted,
      upvotes: p.upvotes + (p.hasUpvoted ? -1 : 1),
    }) : p);
    setUpvoting(true);
    const csrfToken = document.cookie.split('; ').find(r => r.startsWith('csrf-token='))?.split('=')[1] ?? '';
    try {
      const res = await fetch(`/api/community/${id}/upvote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ targetType: 'post' }),
      });
      if (!res.ok) throw new Error('Upvote failed');
      const json = await res.json();
      if (!json.ok) throw new Error('Upvote failed');
      // Reconcile with server response
      setPost((p) => p ? ({
        ...p,
        hasUpvoted: json.data.action === 'added',
        upvotes: p.upvotes,
      }) : p);
    } catch {
      // Revert on failure
      setPost(prevPost);
    } finally {
      setUpvoting(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || submitting) return;

    if (trimmed.length < REPLY_MIN) {
      setReplyError(`Reply must be at least ${REPLY_MIN} characters.`);
      return;
    }
    if (trimmed.length > REPLY_MAX) {
      setReplyError(`Reply must be ${REPLY_MAX} characters or fewer.`);
      return;
    }

    const csrfToken = document.cookie.split('; ').find(r => r.startsWith('csrf-token='))?.split('=')[1] ?? '';
    setSubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/community/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ body: replyText }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setReplyError((json as { error?: string }).error ?? 'Failed to post reply. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.ok) {
        setReplies((prev) => [json.data, ...prev]);
        setReplyText('');
        setReplyError(null);
        setPost((p) => p ? { ...p, replyCount: p.replyCount + 1 } : p);
      } else {
        setReplyError(json.error ?? 'Failed to post reply. Please try again.');
      }
    } catch {
      setReplyError('Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-4 rounded w-1/3 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-6 rounded w-3/4 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    );
  }

  if (loadError || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-xl px-4 py-4 mb-5 text-sm bg-[rgba(252,165,165,0.06)] border border-[rgba(252,165,165,0.2)] text-[#FCA5A5]">
          {loadError ?? 'This post could not be found.'}
        </div>
        <Link
          href="/community"
          className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Go back to community
        </Link>
      </div>
    );
  }

  const replyTrimmedLen = replyText.trim().length;
  const replyTooShort = replyTrimmedLen < REPLY_MIN;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/community"
        className="text-sm flex items-center gap-1 mb-5 transition-colors hover:opacity-80"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        ← Back to community
      </Link>

      {/* Post */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            {post.authorLabel}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>
        <h1 className="text-lg font-bold text-white mb-3">{post.title}</h1>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.7)' }}>{post.body}</p>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleUpvote}
            disabled={upvoting}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${
              post.hasUpvoted
                ? 'border-2 border-[#6366F1] bg-[rgba(99,102,241,0.12)] text-[#A78BFA]'
                : 'border border-white/[0.12] bg-white/[0.06] text-white/50 hover:text-white/70'
            }`}
          >
            ↑ {post.upvotes} {post.upvotes === 1 ? 'upvote' : 'upvotes'}
          </button>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            💬 {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>

      {/* Reply box */}
      <form onSubmit={handleReply} className="mb-6">
        <textarea
          value={replyText}
          onChange={(e) => {
            setReplyText(e.target.value);
            setReplyError(null);
          }}
          placeholder="Share your experience or support…"
          rows={3}
          className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/50 resize-none placeholder:text-white/20 bg-white/[0.06] text-white/90 ${replyError ? 'border border-[#FCA5A5]/60' : 'border border-white/[0.12]'}`}
          maxLength={REPLY_MAX}
        />
        <div className="flex items-start justify-between mt-1.5 gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Your reply is anonymous</p>
            {replyError && (
              <p className="text-xs text-[#FCA5A5]">{replyError}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {replyText.length}/{REPLY_MAX}
            </p>
            <button
              type="submit"
              disabled={replyTooShort || submitting}
              className="text-white text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50 bg-[#6366F1] hover:bg-[#818CF8] transition-colors"
            >
              {submitting ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      </form>

      {/* Replies */}
      {replies.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          No replies yet. Be the first to respond.
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="rounded-xl p-4"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                >
                  {reply.authorLabel}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                </span>
                <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>↑ {reply.upvotes}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.7)' }}>{reply.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
