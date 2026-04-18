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
  const [showNewPost, setShowNewPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', cancerType: '', authorRole: 'caregiver' });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/community${filter ? `?cancerType=${encodeURIComponent(filter)}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) setPosts(json.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.cancerType) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        setShowNewPost(false);
        setForm({ title: '', body: '', cancerType: '', authorRole: 'caregiver' });
        fetchPosts();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Caregiver Community</h1>
          <p className="text-sm text-gray-400 mt-0.5">Anonymous support from people who get it.</p>
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Post
        </button>
      </div>

      {/* New post modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="font-semibold text-gray-900 mb-4">Share with the community</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cancer type</label>
                <select
                  value={form.cancerType}
                  onChange={(e) => setForm({ ...form, cancerType: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select cancer type…</option>
                  {CANCER_TYPES.slice(1).map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">I am a…</label>
                <div className="flex gap-3">
                  {(['caregiver', 'patient'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, authorRole: role })}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${form.authorRole === role ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-500'}`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Title</label>
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Details (optional but helpful)</label>
                <textarea
                  placeholder="Share as much or as little as you like…"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{form.body.length}/2000</p>
              </div>
              <p className="text-xs text-gray-400">Your identity is never revealed. Your post appears as &ldquo;{form.cancerType ? `${form.cancerType.charAt(0).toUpperCase() + form.cancerType.slice(1)} ${form.authorRole.charAt(0).toUpperCase() + form.authorRole.slice(1)}` : 'Anonymous'}&rdquo;.</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
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
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === ct.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-medium text-gray-600">No posts yet</p>
          <p className="text-sm mt-1">Be the first to share something with the community.</p>
          <button
            onClick={() => setShowNewPost(true)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Write a post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all group"
            >
              {post.isPinned && (
                <span className="text-xs text-blue-600 font-medium mb-1 block">📌 Pinned</span>
              )}
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm leading-snug mb-1">
                {post.title}
              </h3>
              {post.bodyPreview && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{post.bodyPreview}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{post.authorLabel}</span>
                <span>↑ {post.upvotes}</span>
                <span>💬 {post.replyCount}</span>
                <span className="ml-auto">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
