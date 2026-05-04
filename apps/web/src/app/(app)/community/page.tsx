'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const CANCER_TYPES = [
  { value: '', label: 'All' },
  { value: 'breast cancer', label: 'Breast' },
  { value: 'colorectal cancer', label: 'Colorectal' },
  { value: 'lung cancer', label: 'Lung' },
  { value: 'prostate cancer', label: 'Prostate' },
  { value: 'ovarian cancer', label: 'Ovarian' },
  { value: 'pancreatic cancer', label: 'Pancreatic' },
  { value: 'lymphoma', label: 'Lymphoma' },
  { value: 'leukemia', label: 'Leukemia' },
  { value: 'other', label: 'Other' },
];

const PAGE_LIMIT = 20;

interface Post {
  id: string;
  cancerType: string;
  authorLabel: string;
  title: string;
  bodyPreview: string;
  upvotes: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: string;
  isOwn: boolean;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', cancerType: '', authorRole: 'caregiver' });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (replace = true) => {
    if (replace) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    const currentOffset = replace ? 0 : offset;

    try {
      const params = new URLSearchParams();
      if (filter) params.set('cancerType', filter);
      params.set('limit', String(PAGE_LIMIT));
      params.set('offset', String(currentOffset));
      const res = await fetch(`/api/community?${params.toString()}`);
      if (!res.ok) {
        setError('Failed to load posts. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.ok) {
        const newPosts: Post[] = json.data;
        if (replace) {
          setPosts(newPosts);
          setOffset(newPosts.length);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
          setOffset((prev) => prev + newPosts.length);
        }
        setHasMore(newPosts.length === PAGE_LIMIT);
        setError(null);
      } else {
        setError('Failed to load posts. Please try again.');
      }
    } catch {
      setError('Failed to load posts. Please try again.');
    } finally {
      if (replace) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [filter, offset]);

  useEffect(() => {
    setOffset(0);
    fetchPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleLoadMore() {
    await fetchPosts(false);
  }

  function validateForm(): boolean {
    let valid = true;
    if (form.title.trim().length < 5) {
      setTitleError('Title must be at least 5 characters.');
      valid = false;
    } else if (form.title.trim().length > 200) {
      setTitleError('Title must be 200 characters or fewer.');
      valid = false;
    } else {
      setTitleError(null);
    }
    if (form.body.trim().length < 10) {
      setBodyError('Details must be at least 10 characters.');
      valid = false;
    } else if (form.body.trim().length > 2000) {
      setBodyError('Details must be 2000 characters or fewer.');
      valid = false;
    } else {
      setBodyError(null);
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.cancerType) return;
    if (!validateForm()) return;

    const csrfToken = document.cookie.split('; ').find(r => r.startsWith('csrf-token='))?.split('=')[1] ?? '';

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? 'Failed to post. Please try again.');
        return;
      }
      setShowNewPost(false);
      setForm({ title: '', body: '', cancerType: '', authorRole: 'caregiver' });
      setTitleError(null);
      setBodyError(null);
      setSubmitError(null);
      setOffset(0);
      fetchPosts(true);
    } catch {
      setSubmitError('Failed to post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-white">Caregiver Community</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Anonymous support from people who get it.</p>
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className="text-white text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          + Post
        </button>
      </div>

      {/* New post modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div
            className="rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            style={{ background: '#0f0f17', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h2 className="font-semibold text-white mb-4">Share with the community</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Cancer type</label>
                <select
                  value={form.cancerType}
                  onChange={(e) => setForm({ ...form, cancerType: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  required
                >
                  <option value="" style={{ background: '#0f0f17' }}>Select cancer type…</option>
                  {CANCER_TYPES.slice(1).map((ct) => (
                    <option key={ct.value} value={ct.value} style={{ background: '#0f0f17' }}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>I am a…</label>
                <div className="flex gap-3">
                  {(['caregiver', 'patient'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, authorRole: role })}
                      className="flex-1 py-2 rounded-lg text-sm transition-all font-medium"
                      style={
                        form.authorRole === role
                          ? {
                              border: '2px solid #7c3aed',
                              background: 'rgba(124,58,237,0.15)',
                              color: '#c4b5fd',
                              boxShadow: '0 0 0 2px rgba(124,58,237,0.2)',
                            }
                          : {
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.06)',
                              color: 'rgba(255,255,255,0.5)',
                            }
                      }
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Title</label>
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    setTitleError(null);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-white/20"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: titleError ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  maxLength={200}
                  required
                />
                {titleError && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{titleError}</p>
                )}
              </div>
              <div>
                <label className="block mb-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Details (optional but helpful)</label>
                <textarea
                  placeholder="Share as much or as little as you like…"
                  value={form.body}
                  onChange={(e) => {
                    setForm({ ...form, body: e.target.value });
                    setBodyError(null);
                  }}
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none placeholder:text-white/20"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: bodyError ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  maxLength={2000}
                  required
                />
                <div className="flex items-center justify-between mt-0.5">
                  {bodyError
                    ? <p className="text-xs" style={{ color: '#f87171' }}>{bodyError}</p>
                    : <span />
                  }
                  <p className="text-xs text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{form.body.length}/2000</p>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Your identity is never revealed. Your post appears as &ldquo;{form.cancerType ? `${form.cancerType.charAt(0).toUpperCase() + form.cancerType.slice(1)} ${form.authorRole.charAt(0).toUpperCase() + form.authorRole.slice(1)}` : 'Anonymous'}&rdquo;.</p>
              {submitError && (
                <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  {submitError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPost(false);
                    setTitleError(null);
                    setBodyError(null);
                    setSubmitError(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-80"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  {submitting ? 'Posting…' : 'Post anonymously'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancer type filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 mt-5 mb-5 scrollbar-hide">
        {CANCER_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => setFilter(ct.value)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-all"
            style={
              filter === ct.value
                ? {
                    background: '#7c3aed',
                    border: '1px solid #7c3aed',
                    color: '#ffffff',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.5)',
                  }
            }
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* List-level error */}
      {error && !loading && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center mb-4">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#f1f5f9' }}>Connect with other caregivers</p>
          <p className="text-xs mt-1 mb-5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
            Caring for someone is easier together. Be the first to share something with the community.
          </p>
          <button
            onClick={() => setShowNewPost(true)}
            className="text-sm font-semibold px-6 py-3 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)', color: 'white' }}
          >
            Write a post
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block rounded-xl p-4 transition-all group"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                {post.isPinned && (
                  <span
                    className="text-xs font-medium mb-1 block px-2 py-0.5 rounded-full w-fit"
                    style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}
                  >
                    📌 Pinned
                  </span>
                )}
                <h3
                  className="font-semibold text-sm leading-snug mb-1 transition-colors group-hover:text-violet-300"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {post.title}
                </h3>
                {post.bodyPreview && (
                  <p className="text-sm line-clamp-2 mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{post.bodyPreview}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    {post.authorLabel}
                  </span>
                  <span>↑ {post.upvotes}</span>
                  <span>💬 {post.replyCount}</span>
                  <span className="ml-auto">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm px-6 py-2.5 rounded-xl font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
