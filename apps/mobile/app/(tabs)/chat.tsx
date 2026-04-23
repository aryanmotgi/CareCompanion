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
import * as SecureStore from 'expo-secure-store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { hapticAIMessage } from '../../src/utils/haptics'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { TabFadeWrapper } from './_layout'
import { createApiClient } from '@carecompanion/api'

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})

type Message = { id: string; role: 'user' | 'assistant'; content: string }

function MessageBubble({ message }: { message: Message }) {
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

function EmptyState({ color, mutedColor, sparkleStyle }: { color: string; mutedColor: string; sparkleStyle?: object }) {
  return (
    <View style={styles.emptyState}>
      <Animated.View style={sparkleStyle}>
        <Text style={[styles.emptyIcon]}>✨</Text>
      </Animated.View>
      <Text style={[styles.emptyTitle, { color }]}>Start a conversation</Text>
      <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
        Ask about your medications, side effects, appointments, or anything else about your care.
      </Text>
    </View>
  )
}

export default function ChatScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
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

  async function send() {
    if (!input.trim() || loading) return
    const msg: Message = { id: Date.now().toString(), role: 'user', content: input }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      // Fetch CSRF token if we don't have one
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
      // If CSRF failed, clear token so next send re-fetches
      csrfTokenRef.current = null
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>AI Companion</Text>
            <Text style={[styles.headerSub, { color: theme.textMuted }]}>Always here for you</Text>
          </View>
        </Animated.View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          renderItem={({ item }) => <MessageBubble message={item} />}
          ListEmptyComponent={!loading ? <EmptyState color={theme.text} mutedColor={theme.textMuted} sparkleStyle={emptyParallax} /> : null}
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
})
