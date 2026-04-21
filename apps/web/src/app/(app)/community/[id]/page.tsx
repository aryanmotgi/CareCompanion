'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

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
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upvoting, setUpvoting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/community/${id}`);
        const json = await res.json();
        if (!json.ok) { router.push('/community'); return; }
        setPost(json.data.post);
        setReplies(json.data.replies);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  async function handleUpvote() {
    if (!post || upvoting) return;
    setUpvoting(true);
    try {
      const res = await fetch(`/api/community/${id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'post' }),
      });
      const json = await res.json();
      if (json.ok) {
        setPost((p) => p ? ({
          ...p,
          hasUpvoted: json.data.action === 'added',
          upvotes: p.upvotes + (json.data.action === 'added' ? 1 : -1),
        }) : p);
      }
    } finally {
      setUpvoting(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/community/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText }),
      });
      const json = await res.json();
      if (json.ok) {
        setReplies((prev) => [json.data, ...prev]);
        setReplyText('');
        setPost((p) => p ? { ...p, replyCount: p.replyCount + 1 } : p);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
        <div className="h-6 bg-gray-100 rounded w-3/4 animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/community" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-5">
        ← Back to community
      </Link>

      {/* Post */}
      <div className="border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
            {post.authorLabel}
          </span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-3">{post.title}</h1>
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleUpvote}
            disabled={upvoting}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              post.hasUpvoted
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            ↑ {post.upvotes} {post.upvotes === 1 ? 'upvote' : 'upvotes'}
          </button>
          <span className="text-sm text-gray-400">💬 {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}</span>
        </div>
      </div>

      {/* Reply box */}
      <form onSubmit={handleReply} className="mb-6">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Share your experience or support…"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          maxLength={1000}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">Your reply is anonymous</p>
          <button
            type="submit"
            disabled={!replyText.trim() || submitting}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Posting…' : 'Reply'}
          </button>
        </div>
      </form>

      {/* Replies */}
      {replies.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No replies yet. Be the first to respond.
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <div key={reply.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {reply.authorLabel}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                </span>
                <span className="ml-auto text-xs text-gray-400">↑ {reply.upvotes}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
