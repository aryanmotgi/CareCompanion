// apps/mobile/app/(tabs)/chat.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { hapticAIMessage } from '../../src/utils/haptics'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { TabFadeWrapper } from './_layout'
import { useProfile } from '../../src/context/ProfileContext'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  isError?: boolean
  failedInput?: string
}

interface Conversation {
  id: string
  title: string | null
  tags: string[]
  lastMessagePreview: string | null
  updatedAt: string
  messageCount: number
}

const TAG_COLORS: Record<string, string> = {
  'Labs': '#2dd4bf',
  'Medications': '#818cf8',
  'Side Effects': '#f472b6',
  'Appointments': '#60a5fa',
  'Emotional Support': '#c084fc',
  'Insurance': '#fbbf24',
}

const SUGGESTIONS = [
  { icon: 'fitness-outline' as const, title: 'Chemo side effects', subtitle: 'What to watch for, timing, relief', color: '#f472b6' },
  { icon: 'flask-outline' as const, title: 'Tumor markers', subtitle: 'CEA, CA-125, PSA explained', color: '#2dd4bf' },
  { icon: 'calendar-outline' as const, title: 'Appointment prep', subtitle: 'Questions for your oncologist', color: '#60a5fa' },
  { icon: 'book-outline' as const, title: 'Understanding results', subtitle: 'Plain-language explanations', color: '#c084fc' },
]

function formatMessageTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return isToday ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onRetry }: { message: Message; onRetry?: (text: string) => void }) {
  const theme = useTheme()
  const scale = useSharedValue(0.7)
  const ty = useSharedValue(8)
  const opacity = useSharedValue(0)
  const isUser = message.role === 'user'

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 })
    ty.value = withSpring(0, { damping: 12, stiffness: 180 })
    opacity.value = withSpring(1, { damping: 12, stiffness: 180 })
  }, [scale, ty, opacity])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }))

  const timestamp = formatMessageTime(message.createdAt)

  if (isUser) {
    return (
      <Animated.View style={[styles.bubbleRow, styles.userRow, style]}>
        <LinearGradient colors={['#6366F1', '#818CF8']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>{message.content}</Text>
        </LinearGradient>
        {timestamp ? <Text style={[styles.timestamp, styles.timestampRight, { color: theme.textMuted }]}>{timestamp}</Text> : null}
      </Animated.View>
    )
  }

  if (message.isError && message.failedInput && onRetry) {
    return (
      <Animated.View style={[styles.bubbleRow, style]}>
        <Pressable
          onPress={() => onRetry(message.failedInput!)}
          accessibilityRole="button"
          accessibilityLabel="Message failed. Tap to retry."
        >
          <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.bgCard, borderColor: theme.rose }]}>
            <Text style={[styles.aiText, { color: theme.text }]}>{message.content}</Text>
            <Text style={[styles.retryHint, { color: theme.rose }]}>Tap to retry</Text>
          </View>
        </Pressable>
        {timestamp ? <Text style={[styles.timestamp, { color: theme.textMuted }]}>{timestamp}</Text> : null}
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.bubbleRow, style]}>
      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder }]}>
        <Text style={[styles.aiText, { color: theme.text }]}>{message.content}</Text>
      </View>
      {timestamp ? <Text style={[styles.timestamp, { color: theme.textMuted }]}>{timestamp}</Text> : null}
    </Animated.View>
  )
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function AnimatedDot({ value, color }: { value: ReturnType<typeof useSharedValue<number>>; color: string }) {
  const dotStyle = useAnimatedStyle(() => ({ opacity: value.value }))
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, dotStyle]} />
}

function TypingDots({ centered }: { centered?: boolean }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const dot0 = useSharedValue(0.3)
  const dot1 = useSharedValue(0.3)
  const dot2 = useSharedValue(0.3)
  const dots = [dot0, dot1, dot2]
  const shimmerX = useSharedValue(-1)

  useEffect(() => {
    function animateDots() {
      dots.forEach((dot, i) => {
        const delay = i * 200
        setTimeout(() => {
          dot.value = withSpring(1, { damping: 8, stiffness: 200 })
          setTimeout(() => { dot.value = withSpring(0.3, { damping: 8, stiffness: 200 }) }, 400)
        }, delay)
      })
    }
    animateDots()
    const interval = setInterval(animateDots, 1200)
    return () => clearInterval(interval)
  }, [dot0, dot1, dot2])

  useEffect(() => {
    if (reduceMotion) return
    shimmerX.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false)
  }, [shimmerX, reduceMotion])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 60 }],
    opacity: 0.15,
  }))

  const content = (
    <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder, flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 12 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]} pointerEvents="none">
        <LinearGradient colors={['transparent', theme.lavender, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {dots.map((dot, i) => <AnimatedDot key={i} value={dot} color={theme.lavender} />)}
    </View>
  )

  if (centered) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {content}
      </View>
    )
  }

  return (
    <View style={[styles.bubbleRow, styles.typingRow]}>
      {content}
    </View>
  )
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({ icon, title, subtitle, color, onPress }: { icon: string; title: string; subtitle: string; color: string; onPress: () => void }) {
  const theme = useTheme()
  const rotation = useSharedValue(0)
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 8000 }), -1, false)
  }, [rotation])
  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 1.5 }],
  }))

  return (
    <Pressable onPress={onPress} style={styles.suggestionCard} accessibilityRole="button" accessibilityLabel={title}>
      <View style={{ borderRadius: 14, overflow: 'hidden' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, rotateStyle]}>
          <LinearGradient colors={[color, theme.lavender, theme.cyan, color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[styles.suggestionCardInner, { backgroundColor: theme.isDark ? '#0C0E1A' : '#FAFAFA', margin: 1.5, borderRadius: 12.5 }]}>
          <Ionicons name={icon as any} size={22} color={color} style={{ marginBottom: 8 }} />
          <Text style={[styles.suggestionTitle, { color: theme.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.suggestionSubtitle, { color: theme.textMuted }]} numberOfLines={2}>{subtitle}</Text>
        </View>
      </View>
    </Pressable>
  )
}

// ─── Conversation row ─────────────────────────────────────────────────────────

function ConversationRow({ convo, onPress, onDelete }: { convo: Conversation; onPress: () => void; onDelete: () => void }) {
  const theme = useTheme()

  const dateLabel = (() => {
    const d = new Date(convo.updatedAt)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  const isRecent = dateLabel === 'Today' || dateLabel === 'Yesterday'

  const handleLongPress = () => {
    Alert.alert(
      convo.title ?? 'Conversation',
      'Delete this conversation and all its messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    )
  }

  const accessLabel = `${convo.title ?? 'New conversation'}, ${dateLabel}, ${convo.messageCount} messages${convo.tags.length ? ', topics: ' + convo.tags.join(', ') : ''}`

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.convoRow,
        isRecent && { borderLeftWidth: 2, borderLeftColor: theme.accent, paddingLeft: 14 },
        { backgroundColor: pressed ? theme.bgCard : 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessLabel}
      accessibilityHint="Double tap to open. Hold to delete."
    >
      <View style={[styles.convoIcon, { backgroundColor: isRecent ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.10)' }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={isRecent ? theme.accent : theme.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.convoTitle, { color: theme.text }]} numberOfLines={1}>
          {convo.title ?? 'New conversation'}
        </Text>
        {convo.lastMessagePreview ? (
          <Text style={[styles.convoPreview, { color: theme.textMuted }]} numberOfLines={1}>
            {convo.lastMessagePreview}
          </Text>
        ) : null}
        <View style={styles.convoMeta}>
          <Text style={[styles.convoDate, { color: isRecent ? theme.accent : theme.textMuted, fontWeight: isRecent ? '600' : '400' }]}>{dateLabel}</Text>
          {convo.messageCount > 0 && (
            <Text style={[styles.convoCount, { color: theme.textMuted }]}> · {convo.messageCount} msg{convo.messageCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {convo.tags.length > 0 && (
          <View style={styles.tagRow}>
            {convo.tags.slice(0, 2).map(tag => (
              <View key={tag} style={[styles.tagChip, { backgroundColor: `${TAG_COLORS[tag] ?? theme.accent}22`, borderColor: `${TAG_COLORS[tag] ?? theme.accent}55` }]}>
                <Text style={[styles.tagText, { color: TAG_COLORS[tag] ?? theme.accent }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </Pressable>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = 60

export default function ChatScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const { apiClient } = useProfile()

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convosLoading, setConvosLoading] = useState(true)
  const [convosError, setConvosError] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)
  const csrfTokenRef = useRef<string | null>(null)
  const activeIdRef = useRef<string | null>(null)

  const headerOpacity = useSharedValue(reduceMotion ? 1 : 0)
  const headerY = useSharedValue(reduceMotion ? 0 : 12)
  useEffect(() => {
    if (reduceMotion) return
    headerOpacity.value = withSpring(1, { damping: 16, stiffness: 120 })
    headerY.value = withSpring(0, { damping: 16, stiffness: 120 })
  }, [headerOpacity, headerY, reduceMotion])
  const headerAnim = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }))
  const { parallaxStyle: emptyParallax } = useGyroParallax(0.5)

  const loadConversations = useCallback(async () => {
    setConvosLoading(true)
    setConvosError(false)
    try {
      const res = await apiClient.conversations.list()
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : [])
      setConversations(list)
    } catch {
      setConvosError(true)
      setConversations([])
    } finally {
      setConvosLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  async function openConversation(id: string) {
    setMessages([])
    setChatLoading(true)
    setActiveConversationId(id)
    activeIdRef.current = id
    try {
      const res = await apiClient.conversations.get(id)
      const data = (res as any)?.data ?? res
      const msgs: Message[] = (data.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      }))
      setMessages(msgs)
    } catch {
      // leave empty — user can still type
    } finally {
      setChatLoading(false)
    }
  }

  function startNewChat() {
    setMessages([])
    setChatLoading(false)
    setActiveConversationId('new')
    activeIdRef.current = null
  }

  function backToList() {
    setActiveConversationId(null)
    activeIdRef.current = null
    setMessages([])
    void loadConversations()
  }

  async function deleteConversation(id: string) {
    try {
      await apiClient.conversations.delete(id)
      setConversations(prev => prev.filter(c => c.id !== id))
    } catch {
      Alert.alert('Error', 'Could not delete conversation. Please try again.')
    }
  }

  function sendSuggestion(title: string) {
    setInput(title)
    setTimeout(() => sendWithText(title), 0)
  }

  async function sendWithText(text: string) {
    if (!text.trim() || sending) return
    const originalInput = text
    const msg: Message = { id: Date.now().toString(), role: 'user', content: text, createdAt: new Date().toISOString() }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    setSending(true)

    try {
      if (!csrfTokenRef.current) {
        const { csrfToken } = await apiClient.csrfToken()
        csrfTokenRef.current = csrfToken
      }

      const currentConvoId = activeIdRef.current ?? undefined
      const result = await apiClient.chat.send(
        next.map(({ role, content }) => ({ role, content })),
        csrfTokenRef.current,
        currentConvoId,
      )

      if (result.conversationId && !activeIdRef.current) {
        activeIdRef.current = result.conversationId
        setActiveConversationId(result.conversationId)
      }

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content ?? 'Sorry, try again.',
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, reply])
      hapticAIMessage()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const errMsg = err instanceof Error ? err.message : String(err)
      csrfTokenRef.current = null
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${errMsg}`, isError: true, failedInput: originalInput },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleRetry(failedText: string) {
    setMessages(prev => prev.filter(m => !m.isError))
    sendWithText(failedText)
  }

  // ─── Conversations list ──────────────────────────────────────────────────
  if (activeConversationId === null) {
    return (
      <TabFadeWrapper>
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
          <Animated.View style={headerAnim}>
            <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
              <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headerTitle, { color: theme.text }]}>AI Companion</Text>
                  <Text style={[styles.headerSub, { color: theme.textMuted }]}>Your care conversations</Text>
                </View>
                <Pressable
                  onPress={startNewChat}
                  style={[styles.newChatBtn, { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.35)' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Start new chat"
                >
                  <Ionicons name="add" size={16} color={theme.accent} />
                  <Text style={[styles.newChatText, { color: theme.accent }]}>New Chat</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {convosLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <TypingDots centered />
            </View>
          ) : convosError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="cloud-offline-outline" size={40} color={theme.rose} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Couldn't load conversations</Text>
              <Text style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', marginBottom: 20 }}>Check your connection and try again.</Text>
              <Pressable
                onPress={loadConversations}
                style={{ backgroundColor: theme.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading conversations"
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
              </Pressable>
            </View>
          ) : conversations.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.25)' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.accent} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 8 }}>No conversations yet</Text>
              <Text style={{ fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                Ask about your medications, side effects, appointments, or anything about your care journey.
              </Text>
              <Pressable
                onPress={startNewChat}
                style={{ backgroundColor: theme.accent, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 }}
                accessibilityRole="button"
                accessibilityLabel="Start your first conversation"
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start chatting</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={c => c.id}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
              renderItem={({ item }) => (
                <ConversationRow
                  convo={item}
                  onPress={() => openConversation(item.id)}
                  onDelete={() => deleteConversation(item.id)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 72 }} />}
            />
          )}
        </View>
      </TabFadeWrapper>
    )
  }

  // ─── Individual chat view ────────────────────────────────────────────────
  const activeTitle = activeConversationId !== 'new'
    ? (conversations.find(c => c.id === activeConversationId)?.title ?? null)
    : null

  return (
    <TabFadeWrapper>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={headerAnim}>
          <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
            <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={styles.headerRow}>
              <Pressable
                onPress={backToList}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Back to conversations"
              >
                <Ionicons name="chevron-back" size={22} color={theme.accent} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                  {activeTitle ?? 'AI Companion'}
                </Text>
                <Text style={[styles.headerSub, { color: theme.textMuted }]}>Always here for you</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {chatLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TypingDots centered />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
            renderItem={({ item }) => <MessageBubble message={item} onRetry={handleRetry} />}
            ListEmptyComponent={
              !sending ? (
                <View style={styles.emptyState}>
                  <Animated.View style={emptyParallax}>
                    <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.25)', alignSelf: 'center' }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.accent} />
                    </View>
                  </Animated.View>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>What's on your mind?</Text>
                  <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                    Ask about your medications, side effects, appointments, or anything about your care.
                  </Text>
                  <View style={styles.suggestionsGrid}>
                    {SUGGESTIONS.map(s => (
                      <SuggestionCard key={s.title} icon={s.icon} title={s.title} subtitle={s.subtitle} color={s.color} onPress={() => sendSuggestion(s.title)} />
                    ))}
                  </View>
                </View>
              ) : null
            }
            ListFooterComponent={sending ? <TypingDots /> : null}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={[styles.inputBar, {
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8,
          borderTopColor: theme.border,
          backgroundColor: theme.isDark ? 'rgba(12,14,26,0.95)' : 'rgba(255,255,255,0.95)',
        }]}>
          <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder, color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your care..."
            placeholderTextColor={theme.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendWithText(input)}
            accessibilityLabel="Message input"
          />
          <View style={theme.shadowGlowViolet}>
            <Pressable
              onPress={() => sendWithText(input)}
              disabled={sending}
              style={{ opacity: sending ? 0.5 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.sendBtn}>
                <Text style={styles.sendIcon}>↑</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, overflow: 'hidden' },
  headerTitle: { fontSize: 20, fontWeight: '700', zIndex: 1 },
  headerSub: { fontSize: 13, zIndex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  backBtn: { padding: 11 }, // 44px touch target
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  newChatText: { fontSize: 13, fontWeight: '600' },
  // Conversations list
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingLeft: 16,
    paddingVertical: 12,
    gap: 12,
    minHeight: 64,
  },
  convoIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  convoTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  convoPreview: { fontSize: 13, marginBottom: 3 },
  convoMeta: { flexDirection: 'row', alignItems: 'center' },
  convoDate: { fontSize: 12 },
  convoCount: { fontSize: 12 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  tagChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '700' },
  // Empty state
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  // Chat
  list: { padding: 16, gap: 12, paddingBottom: TAB_BAR_HEIGHT + 16 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  bubbleRow: { maxWidth: '80%' },
  userRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  typingRow: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, padding: 12 },
  userBubble: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  aiBubble: { borderWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 4 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  aiText: { fontSize: 15, lineHeight: 22 },
  retryHint: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  timestamp: { fontSize: 11, marginTop: 3, alignSelf: 'flex-start' },
  timestampRight: { alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1, overflow: 'hidden' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 24, paddingHorizontal: 4 },
  suggestionCard: { width: '47%' },
  suggestionCardInner: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 110 },
  suggestionTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
  suggestionSubtitle: { fontSize: 11, lineHeight: 16 },
})
