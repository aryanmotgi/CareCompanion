// apps/mobile/app/community/[id].tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'

const REPLY_MIN = 5
const REPLY_MAX = 1000

type Post = {
  id: string
  authorLabel: string
  cancerType: string
  title: string
  body: string
  upvotes: number
  replyCount: number
  createdAt: string
  hasUpvoted: boolean
}

type Reply = {
  id: string
  authorLabel: string
  body: string
  upvotes: number
  createdAt: string
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function DetailSkeleton() {
  return (
    <View style={{ gap: 12, padding: 20 }}>
      <ShimmerSkeleton height={16} width="40%" />
      <ShimmerSkeleton height={24} width="80%" />
      <ShimmerSkeleton height={80} />
    </View>
  )
}

export default function PostDetailScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { csrfToken, apiClient } = useProfile()

  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [upvoting, setUpvoting] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    apiClient.community.get(id as string)
      .then(res => {
        if (!res.ok) { setLoadError('Failed to load this post.'); return }
        setPost(res.data.post)
        setReplies(res.data.replies)
      })
      .catch(() => setLoadError('Failed to load this post.'))
      .finally(() => setLoading(false))
  }, [id, apiClient])

  async function handleUpvote() {
    if (!post || upvoting || !csrfToken) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const prev = post
    setPost(p => p ? ({
      ...p,
      hasUpvoted: !p.hasUpvoted,
      upvotes: p.upvotes + (p.hasUpvoted ? -1 : 1),
    }) : p)
    setUpvoting(true)
    try {
      const res = await apiClient.community.upvote(post.id, csrfToken)
      if (!res.ok) throw new Error('failed')
      setPost(p => p ? ({ ...p, hasUpvoted: res.data.action === 'added' }) : p)
    } catch {
      setPost(prev)
    } finally {
      setUpvoting(false)
    }
  }

  async function handleReply() {
    const trimmed = replyText.trim()
    if (!trimmed || submitting || !csrfToken || !post) return
    if (trimmed.length < REPLY_MIN) { setReplyError(`Reply must be at least ${REPLY_MIN} characters.`); return }
    if (trimmed.length > REPLY_MAX) { setReplyError(`Reply must be ${REPLY_MAX} characters or fewer.`); return }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSubmitting(true)
    setReplyError(null)
    try {
      const res = await apiClient.community.reply(post.id, trimmed, csrfToken)
      if (!res.ok) { setReplyError('Failed to post reply. Please try again.'); return }
      setReplies(prev => [res.data, ...prev])
      setReplyText('')
      setPost(p => p ? { ...p, replyCount: p.replyCount + 1 } : p)
    } catch {
      setReplyError('Failed to post reply. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back() }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={theme.accent} />
          <Text style={[styles.backText, { color: theme.accent }]}>Community</Text>
        </Pressable>
      </View>

      {loading ? (
        <DetailSkeleton />
      ) : loadError || !post ? (
        <View style={styles.errorContainer}>
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
            <Text style={[styles.errorText, { color: '#F87171' }]}>{loadError ?? 'Post not found.'}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: theme.textMuted }]}>← Back to community</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Post card */}
          <View style={[styles.postCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <View style={styles.postMeta}>
              <View style={[styles.authorBadge, { backgroundColor: theme.bgElevated }]}>
                <Text style={[styles.authorText, { color: theme.textSub }]}>{post.authorLabel}</Text>
              </View>
              <Text style={[styles.timeText, { color: theme.textMuted }]}>
                {formatRelativeTime(post.createdAt)}
              </Text>
            </View>

            <Text style={[styles.postTitle, { color: theme.text }]}>{post.title}</Text>
            <Text style={[styles.postBody, { color: theme.textSub }]}>{post.body}</Text>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => void handleUpvote()}
                disabled={upvoting}
                style={[
                  styles.upvoteBtn,
                  post.hasUpvoted
                    ? { borderColor: theme.accent, borderWidth: 2, backgroundColor: 'rgba(99,102,241,0.15)' }
                    : { borderColor: theme.border, borderWidth: 1, backgroundColor: theme.bgElevated },
                ]}
              >
                <Text style={[styles.upvoteText, { color: post.hasUpvoted ? theme.accentHover : theme.textMuted }]}>
                  ↑ {post.upvotes} {post.upvotes === 1 ? 'upvote' : 'upvotes'}
                </Text>
              </Pressable>
              <Text style={[styles.replyCount, { color: theme.textMuted }]}>
                💬 {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
              </Text>
            </View>
          </View>

          {/* Reply input */}
          <View style={[styles.replyInputWrap, { borderColor: replyError ? theme.rose : theme.border, backgroundColor: theme.bgElevated }]}>
            <TextInput
              value={replyText}
              onChangeText={t => { setReplyText(t); setReplyError(null) }}
              placeholder="Share your experience or support…"
              placeholderTextColor={theme.textMuted}
              style={[styles.replyInput, { color: theme.text }]}
              multiline
              maxLength={REPLY_MAX}
              textAlignVertical="top"
            />
            <View style={styles.replyFooter}>
              <View>
                <Text style={[styles.replyAnon, { color: theme.textMuted }]}>Your reply is anonymous</Text>
                {replyError ? <Text style={[styles.replyErrText, { color: theme.rose }]}>{replyError}</Text> : null}
              </View>
              <View style={styles.replyActions}>
                <Text style={[styles.charCount, { color: theme.textMuted }]}>{replyText.length}/{REPLY_MAX}</Text>
                <Pressable
                  onPress={() => void handleReply()}
                  disabled={replyText.trim().length < REPLY_MIN || submitting}
                  style={[
                    styles.replyBtn,
                    { backgroundColor: theme.accent },
                    (replyText.trim().length < REPLY_MIN || submitting) && { opacity: 0.4 },
                  ]}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.replyBtnText}>Reply</Text>
                  }
                </Pressable>
              </View>
            </View>
          </View>

          {/* Replies */}
          {replies.length === 0 ? (
            <View style={styles.noReplies}>
              <Text style={[styles.noRepliesText, { color: theme.textMuted }]}>
                No replies yet. Be the first to respond.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {replies.map(reply => (
                <View
                  key={reply.id}
                  style={[styles.replyCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
                >
                  <View style={styles.replyMeta}>
                    <View style={[styles.authorBadge, { backgroundColor: theme.bgElevated }]}>
                      <Text style={[styles.authorText, { color: theme.textSub }]}>{reply.authorLabel}</Text>
                    </View>
                    <Text style={[styles.timeText, { color: theme.textMuted }]}>
                      {formatRelativeTime(reply.createdAt)}
                    </Text>
                    <Text style={[styles.replyUpvotes, { color: theme.textMuted }]}>↑ {reply.upvotes}</Text>
                  </View>
                  <Text style={[styles.replyBody, { color: theme.textSub }]}>{reply.body}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 15, fontWeight: '500' },
  scrollContent: { padding: 16, gap: 12 },
  postCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  authorBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  authorText: { fontSize: 11, fontWeight: '500' },
  timeText: { fontSize: 11 },
  postTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 10 },
  postBody: { fontSize: 14, lineHeight: 21 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  upvoteText: { fontSize: 13, fontWeight: '500' },
  replyCount: { fontSize: 13 },
  replyInputWrap: { borderRadius: 14, borderWidth: 1, padding: 12 },
  replyInput: { fontSize: 14, lineHeight: 20, minHeight: 70, marginBottom: 8 },
  replyFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  replyAnon: { fontSize: 11 },
  replyErrText: { fontSize: 11, marginTop: 2 },
  replyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  charCount: { fontSize: 11 },
  replyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 56, alignItems: 'center' },
  replyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noReplies: { alignItems: 'center', paddingVertical: 28 },
  noRepliesText: { fontSize: 13 },
  replyCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  replyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  replyUpvotes: { marginLeft: 'auto', fontSize: 11 },
  replyBody: { fontSize: 13, lineHeight: 19 },
  errorContainer: { padding: 16 },
  errorBanner: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13 },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontSize: 14 },
})
