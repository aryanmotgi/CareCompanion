// apps/mobile/app/(tabs)/chat.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Message = { id: string; role: 'user' | 'assistant'; content: string; isError?: boolean; failedInput?: string }

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

  if (isUser) {
    return (
      <Animated.View style={[styles.bubbleRow, styles.userRow, style]}>
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{message.content}</Text>
        </LinearGradient>
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
          <View
            style={[
              styles.bubble,
              styles.aiBubble,
              {
                backgroundColor: theme.bgCard,
                borderColor: theme.rose,
              },
            ]}
          >
            <Text style={[styles.aiText, { color: theme.text }]}>{message.content}</Text>
            <Text style={[styles.retryHint, { color: theme.rose }]}>Tap to retry</Text>
          </View>
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.bubbleRow, style]}>
      <View
        style={[
          styles.bubble,
          styles.aiBubble,
          {
            backgroundColor: theme.bgCard,
            borderColor: theme.bgCardBorder,
          },
        ]}
      >
        <Text style={[styles.aiText, { color: theme.text }]}>{message.content}</Text>
      </View>
    </Animated.View>
  )
}

function AnimatedDot({ value, color }: { value: ReturnType<typeof useSharedValue<number>>; color: string }) {
  const dotStyle = useAnimatedStyle(() => ({ opacity: value.value }))
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, dotStyle]} />
}

function TypingDots() {
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
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false,
    )
  }, [shimmerX, reduceMotion])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 60 }],
    opacity: 0.15,
  }))

  return (
    <View style={[styles.bubbleRow, styles.typingRow]}>
      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder, flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 12 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', theme.lavender, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {dots.map((dot, i) => (
          <AnimatedDot key={i} value={dot} color={theme.lavender} />
        ))}
      </View>
    </View>
  )
}

const TAB_BAR_HEIGHT = 60

const SUGGESTIONS = [
  { icon: 'fitness-outline' as const, title: 'Chemo side effects', subtitle: 'Side effects, timing, what to watch for', color: '#f472b6' },
  { icon: 'flask-outline' as const, title: 'Tumor markers', subtitle: 'CEA, CA-125, PSA trends explained', color: '#2dd4bf' },
  { icon: 'calendar-outline' as const, title: 'Appointment prep', subtitle: 'Questions to ask your oncologist', color: '#60a5fa' },
  { icon: 'book-outline' as const, title: 'Understanding results', subtitle: 'Plain-language explanations', color: '#c084fc' },
]

function SuggestionCard({
  icon,
  title,
  subtitle,
  color,
  onPress,
}: {
  icon: string
  title: string
  subtitle: string
  color: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} style={styles.suggestionCard}>
      <View
        style={[
          styles.suggestionCardInner,
          {
            backgroundColor: theme.bgCard,
            borderColor: theme.bgCardBorder,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 8 }} />
        <Text style={[styles.suggestionTitle, { color: theme.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.suggestionSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

function EmptyState({
  color,
  mutedColor,
  sparkleStyle,
  onSuggestionPress,
}: {
  color: string
  mutedColor: string
  sparkleStyle?: object
  onSuggestionPress: (title: string) => void
}) {
  return (
    <View style={styles.emptyState}>
      <Animated.View style={sparkleStyle}>
        <Text style={[styles.emptyIcon]}>✨</Text>
      </Animated.View>
      <Text style={[styles.emptyTitle, { color }]}>Start a conversation</Text>
      <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
        Ask about your medications, side effects, appointments, or anything else about your care.
      </Text>
      <View style={styles.suggestionsGrid}>
        {SUGGESTIONS.map((s) => (
          <SuggestionCard
            key={s.title}
            icon={s.icon}
            title={s.title}
            subtitle={s.subtitle}
            color={s.color}
            onPress={() => onSuggestionPress(s.title)}
          />
        ))}
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const { apiClient } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<FlatList>(null)
  const abortRef = useRef<AbortController | null>(null)
  const csrfTokenRef = useRef<string | null>(null)

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

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  function sendSuggestion(title: string) {
    setInput(title)
    // Use a microtask to ensure state is set before sending
    setTimeout(() => {
      sendWithText(title)
    }, 0)
  }

  async function sendWithText(text: string) {
    if (!text.trim() || loading) return
    const originalInput = text
    const msg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      if (!csrfTokenRef.current) {
        const { csrfToken } = await apiClient.csrfToken()
        csrfTokenRef.current = csrfToken
      }

      const result = await apiClient.chat.send(
        next.map(({ role, content }) => ({ role, content })),
        csrfTokenRef.current,
      )
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.content ?? 'Sorry, try again.',
      }
      setMessages((prev) => [...prev, reply])
      hapticAIMessage()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      csrfTokenRef.current = null
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          isError: true,
          failedInput: originalInput,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleRetry(failedText: string) {
    // Remove the error message before retrying
    setMessages((prev) => prev.filter((m) => !m.isError))
    sendWithText(failedText)
  }

  async function send() {
    if (!input.trim() || loading) return
    sendWithText(input)
  }

  return (
    <TabFadeWrapper>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <Animated.View style={headerAnim}>
          <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
            <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.headerTitle, { color: theme.text }]}>AI Companion</Text>
                <Text style={[styles.headerSub, { color: theme.textMuted }]}>Always here for you</Text>
              </View>
              {messages.length > 0 && (
                <Pressable
                  onPress={() => setMessages([])}
                  style={[styles.newChatBtn, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder }]}
                >
                  <Text style={[styles.newChatText, { color: theme.text }]}>New Chat</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          renderItem={({ item }) => <MessageBubble message={item} onRetry={handleRetry} />}
          ListEmptyComponent={!loading ? <EmptyState color={theme.text} mutedColor={theme.textMuted} sparkleStyle={emptyParallax} onSuggestionPress={sendSuggestion} /> : null}
          ListFooterComponent={loading ? <TypingDots /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 8,
              borderTopColor: theme.border,
              backgroundColor: theme.isDark ? 'rgba(12,14,26,0.95)' : 'rgba(255,255,255,0.95)',
            },
          ]}
        >
          <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.bgCard,
                borderColor: theme.bgCardBorder,
                color: theme.text,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your care..."
            placeholderTextColor={theme.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <View style={theme.shadowGlowViolet}>
            <Pressable onPress={send} disabled={loading}>
              <LinearGradient
                colors={['#6366F1', '#A78BFA']}
                style={styles.sendBtn}
              >
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
  list: { padding: 16, gap: 8, paddingBottom: TAB_BAR_HEIGHT + 16 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  bubbleRow: { maxWidth: '80%' },
  userRow: { alignSelf: 'flex-end' },
  typingRow: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 12, padding: 12 },
  userBubble: {
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 2,
  },
  aiBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomRightRadius: 12, borderBottomLeftRadius: 2,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  aiText: { fontSize: 15, lineHeight: 22 },
  retryHint: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  newChatBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  newChatText: { fontSize: 13, fontWeight: '600' },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  suggestionCard: {
    width: '47%',
  },
  suggestionCardInner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
  },
  suggestionIcon: { fontSize: 22, marginBottom: 8 },
  suggestionTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
  suggestionSubtitle: { fontSize: 11, lineHeight: 16 },
})
