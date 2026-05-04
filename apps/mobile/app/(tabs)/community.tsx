// apps/mobile/app/(tabs)/community.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { TabFadeWrapper } from './_layout'

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
]

const AUTHOR_ROLES = [
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'patient', label: 'Patient' },
] as const

const PAGE_LIMIT = 20

type Post = {
  id: string
  cancerType: string
  authorLabel: string
  title: string
  bodyPreview: string
  upvotes: number
  replyCount: number
  isPinned: boolean
  createdAt: string
  isOwn: boolean
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

function PostSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2].map(i => (
        <ShimmerSkeleton key={i} height={80} style={{ borderRadius: 14 }} />
      ))}
    </View>
  )
}

export default function CommunityScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { csrfToken, apiClient } = useProfile()

  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(0)

  // New post modal state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    cancerType: '',
    authorRole: 'caregiver' as 'caregiver' | 'patient',
  })
  const [titleError, setTitleError] = useState<string | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = useCallback(async (replace: boolean, currentFilter: string) => {
    if (replace) {
      setLoading(true)
      setError(null)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await apiClient.community.list({
        cancerType: currentFilter || undefined,
        limit: PAGE_LIMIT,
        offset: replace ? 0 : offsetRef.current,
      })
      if (!res.ok) { setError('Failed to load posts.'); return }
      const newPosts = res.data ?? []
      if (replace) {
        setPosts(newPosts)
      } else {
        setPosts(prev => [...prev, ...newPosts])
      }
      offsetRef.current = (replace ? 0 : offsetRef.current) + newPosts.length
      setHasMore(newPosts.length === PAGE_LIMIT)
      setError(null)
    } catch {
      setError('Failed to load posts. Check your connection.')
    } finally {
      if (replace) setLoading(false)
      else setLoadingMore(false)
    }
  }, [apiClient])

  useEffect(() => {
    fetchPosts(true, filter)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(val: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFilter(val)
  }

  function validateForm(): boolean {
    let ok = true
    if (form.title.trim().length < 5) { setTitleError('Title must be at least 5 characters.'); ok = false }
    else if (form.title.trim().length > 200) { setTitleError('Title must be 200 characters or fewer.'); ok = false }
    else setTitleError(null)

    if (form.body.trim().length < 10) { setBodyError('Details must be at least 10 characters.'); ok = false }
    else if (form.body.trim().length > 2000) { setBodyError('Details must be 2000 characters or fewer.'); ok = false }
    else setBodyError(null)
    return ok
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.body.trim() || !form.cancerType || !csrfToken) return
    if (!validateForm()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await apiClient.community.create({
        title: form.title.trim(),
        body: form.body.trim(),
        cancerType: form.cancerType,
        authorRole: form.authorRole,
      }, csrfToken)
      if (!res.ok) { setSubmitError('Failed to post. Please try again.'); return }
      setShowModal(false)
      setForm({ title: '', body: '', cancerType: '', authorRole: 'caregiver' })
      setTitleError(null); setBodyError(null); setSubmitError(null)
      void fetchPosts(true, filter)
    } catch {
      setSubmitError('Failed to post. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    setTitleError(null); setBodyError(null); setSubmitError(null)
  }

  const anonymousPreview = form.cancerType
    ? `${form.cancerType.charAt(0).toUpperCase() + form.cancerType.slice(1)} ${form.authorRole.charAt(0).toUpperCase() + form.authorRole.slice(1)}`
    : 'Anonymous'

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Community</Text>
              <Text style={[styles.headerSub, { color: theme.textMuted }]}>
                Anonymous support from people who get it
              </Text>
            </View>
            <Pressable
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowModal(true) }}
              style={[styles.postBtn, { backgroundColor: theme.accent }]}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.postBtnText}>Post</Text>
            </Pressable>
          </View>

          {/* Cancer type filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={{ marginTop: 12 }}
          >
            {CANCER_TYPES.map(ct => (
              <Pressable
                key={ct.value}
                onPress={() => handleFilterChange(ct.value)}
                style={[
                  styles.filterPill,
                  filter === ct.value
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: theme.bgElevated, borderColor: theme.border },
                ]}
              >
                <Text style={[
                  styles.filterPillText,
                  { color: filter === ct.value ? '#fff' : theme.textMuted },
                ]}>
                  {ct.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Error */}
          {error && !loading ? (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Text style={[styles.errorText, { color: '#F87171' }]}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <PostSkeleton />
          ) : posts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(99,102,241,0.10)', borderColor: 'rgba(99,102,241,0.20)' }]}>
                <Ionicons name="people-outline" size={28} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Connect with other caregivers</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Caring for someone is easier together. Be the first to share something with the community.
              </Text>
              <Pressable
                onPress={() => setShowModal(true)}
                style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.emptyBtnText}>Write a post</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {posts.map(post => (
                <Pressable
                  key={post.id}
                  onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/community/${post.id}`) }}
                  style={[styles.postCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
                >
                  {post.isPinned && (
                    <View style={[styles.pinnedBadge, { backgroundColor: 'rgba(124,58,237,0.3)' }]}>
                      <Text style={[styles.pinnedText, { color: theme.violet }]}>📌 Pinned</Text>
                    </View>
                  )}
                  <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={2}>
                    {post.title}
                  </Text>
                  {post.bodyPreview ? (
                    <Text style={[styles.postPreview, { color: theme.textSub }]} numberOfLines={2}>
                      {post.bodyPreview}
                    </Text>
                  ) : null}
                  <View style={styles.postMeta}>
                    <View style={[styles.authorBadge, { backgroundColor: theme.bgElevated }]}>
                      <Text style={[styles.authorText, { color: theme.textSub }]}>{post.authorLabel}</Text>
                    </View>
                    <Text style={[styles.metaItem, { color: theme.textMuted }]}>↑ {post.upvotes}</Text>
                    <Text style={[styles.metaItem, { color: theme.textMuted }]}>💬 {post.replyCount}</Text>
                    <Text style={[styles.metaTime, { color: theme.textMuted }]}>
                      {formatRelativeTime(post.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              ))}

              {hasMore && (
                <Pressable
                  onPress={() => void fetchPosts(false, filter)}
                  disabled={loadingMore}
                  style={[styles.loadMoreBtn, { backgroundColor: theme.bgElevated, borderColor: theme.border, opacity: loadingMore ? 0.5 : 1 }]}
                >
                  {loadingMore
                    ? <ActivityIndicator size="small" color={theme.accent} />
                    : <Text style={[styles.loadMoreText, { color: theme.textSub }]}>Load more</Text>
                  }
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        {/* New post modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeModal}
        >
          <KeyboardAvoidingView
            style={[styles.modalRoot, { backgroundColor: theme.bg }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={closeModal} style={styles.modalCancel}>
                <Text style={[styles.modalCancelText, { color: theme.textMuted }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Share with the community</Text>
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={submitting || !form.title.trim() || !form.body.trim() || !form.cancerType}
                style={[
                  styles.modalSubmit,
                  { backgroundColor: theme.accent },
                  (submitting || !form.title.trim() || !form.body.trim() || !form.cancerType) && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.modalSubmitText}>{submitting ? 'Posting…' : 'Post'}</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Cancer type */}
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>CANCER TYPE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ marginBottom: 16 }}
              >
                {CANCER_TYPES.slice(1).map(ct => (
                  <Pressable
                    key={ct.value}
                    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setForm(f => ({ ...f, cancerType: ct.value })) }}
                    style={[
                      styles.filterPill,
                      form.cancerType === ct.value
                        ? { backgroundColor: theme.accent, borderColor: theme.accent }
                        : { backgroundColor: theme.bgElevated, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.filterPillText, { color: form.cancerType === ct.value ? '#fff' : theme.textMuted }]}>
                      {ct.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Author role */}
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>I AM A…</Text>
              <View style={styles.roleRow}>
                {AUTHOR_ROLES.map(r => (
                  <Pressable
                    key={r.value}
                    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setForm(f => ({ ...f, authorRole: r.value })) }}
                    style={[
                      styles.roleBtn,
                      form.authorRole === r.value
                        ? { borderColor: theme.accent, borderWidth: 2, backgroundColor: 'rgba(99,102,241,0.15)' }
                        : { borderColor: theme.border, borderWidth: 1, backgroundColor: theme.bgElevated },
                    ]}
                  >
                    <Text style={[
                      styles.roleBtnText,
                      { color: form.authorRole === r.value ? theme.accentHover : theme.textMuted },
                    ]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Title */}
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>TITLE</Text>
              <TextInput
                value={form.title}
                onChangeText={t => { setForm(f => ({ ...f, title: t })); setTitleError(null) }}
                placeholder="What's on your mind?"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textInput,
                  { color: theme.text, borderColor: titleError ? theme.rose : theme.border, backgroundColor: theme.bgElevated },
                ]}
                maxLength={200}
                returnKeyType="next"
              />
              {titleError ? <Text style={[styles.fieldError, { color: theme.rose }]}>{titleError}</Text> : null}

              {/* Body */}
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>DETAILS</Text>
              <TextInput
                value={form.body}
                onChangeText={t => { setForm(f => ({ ...f, body: t })); setBodyError(null) }}
                placeholder="Share as much or as little as you like…"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textArea,
                  { color: theme.text, borderColor: bodyError ? theme.rose : theme.border, backgroundColor: theme.bgElevated },
                ]}
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
              />
              <View style={styles.bodyFooter}>
                {bodyError ? <Text style={[styles.fieldError, { color: theme.rose }]}>{bodyError}</Text> : <View />}
                <Text style={[styles.charCount, { color: theme.textMuted }]}>{form.body.length}/2000</Text>
              </View>

              {/* Anonymous notice */}
              <Text style={[styles.anonNotice, { color: theme.textMuted }]}>
                Your identity is never revealed. Your post appears as "{anonymousPreview}".
              </Text>

              {submitError ? (
                <View style={[styles.submitError, { backgroundColor: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.3)' }]}>
                  <Text style={[styles.submitErrorText, { color: '#F87171' }]}>{submitError}</Text>
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, marginTop: 4 },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterRow: { paddingHorizontal: 0, gap: 6, paddingBottom: 4 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  errorBanner: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText: { fontSize: 13 },
  postCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  pinnedBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  pinnedText: { fontSize: 11, fontWeight: '600' },
  postTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 5 },
  postPreview: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  authorBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  authorText: { fontSize: 11, fontWeight: '500' },
  metaItem: { fontSize: 12 },
  metaTime: { fontSize: 11, marginLeft: 'auto' },
  loadMoreBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  loadMoreText: { fontSize: 13, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Modal
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { paddingVertical: 4, paddingRight: 8 },
  modalCancelText: { fontSize: 15 },
  modalTitle: { fontSize: 15, fontWeight: '600' },
  modalSubmit: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalContent: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 4 },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 4, minHeight: 110 },
  fieldError: { fontSize: 12, marginBottom: 4 },
  bodyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  charCount: { fontSize: 11 },
  anonNotice: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  submitError: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 12 },
  submitErrorText: { fontSize: 13 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  roleBtnText: { fontSize: 13, fontWeight: '600' },
})
