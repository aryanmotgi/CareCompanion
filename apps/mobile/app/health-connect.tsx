import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { requestHealthKitPermissions } from '../src/services/healthkit'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH - 56

// ---------------------------------------------------------------------------
// Tutorial step data
// ---------------------------------------------------------------------------

interface TutorialStep {
  step: number
  title: string
  instruction: string
  mockup: 'profile' | 'records' | 'search'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    title: 'Open Health App',
    instruction: 'Open the Health app and tap your profile icon (top right)',
    mockup: 'profile',
  },
  {
    step: 2,
    title: 'Health Records',
    instruction: 'Tap Health Records, then Get Started',
    mockup: 'records',
  },
  {
    step: 3,
    title: 'Connect Provider',
    instruction: 'Search for your hospital and sign in with your patient portal',
    mockup: 'search',
  },
]

// ---------------------------------------------------------------------------
// Phone mockup components — styled to resemble iOS Health app
// ---------------------------------------------------------------------------

function PhoneMockupFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={mockStyles.phone}>
      <LinearGradient
        colors={['#1C1C1E', '#000000']}
        style={mockStyles.phoneBg}
      />
      {/* Status bar */}
      <View style={mockStyles.statusBar}>
        <Text style={mockStyles.statusTime}>9:41</Text>
        <View style={mockStyles.statusRight}>
          <Ionicons name="cellular" size={12} color="#fff" />
          <Ionicons name="wifi" size={12} color="#fff" />
          <Ionicons name="battery-full" size={12} color="#fff" />
        </View>
      </View>
      {children}
    </View>
  )
}

function ProfileMockup() {
  return (
    <PhoneMockupFrame>
      {/* Nav bar */}
      <View style={mockStyles.navBar}>
        <Text style={mockStyles.navTitle}>Summary</Text>
        <View style={mockStyles.profileIcon}>
          <Ionicons name="person-circle" size={28} color="#007AFF" />
        </View>
      </View>
      {/* Highlight ring around profile icon */}
      <View style={mockStyles.profileHighlight} />
      {/* Content cards */}
      <View style={mockStyles.cardList}>
        <View style={mockStyles.healthCard}>
          <View style={mockStyles.cardHeader}>
            <Ionicons name="heart" size={16} color="#FF375F" />
            <Text style={mockStyles.cardTitle}>Heart</Text>
          </View>
          <Text style={mockStyles.cardValue}>72 BPM</Text>
          <Text style={mockStyles.cardSubtext}>Resting heart rate</Text>
        </View>
        <View style={mockStyles.healthCard}>
          <View style={mockStyles.cardHeader}>
            <Ionicons name="walk" size={16} color="#30D158" />
            <Text style={mockStyles.cardTitle}>Activity</Text>
          </View>
          <Text style={mockStyles.cardValue}>8,432</Text>
          <Text style={mockStyles.cardSubtext}>Steps today</Text>
        </View>
      </View>
      {/* Arrow pointing to profile */}
      <View style={mockStyles.arrowWrap}>
        <Ionicons name="arrow-up" size={20} color="#6366F1" />
        <Text style={mockStyles.arrowLabel}>Tap here</Text>
      </View>
    </PhoneMockupFrame>
  )
}

function RecordsMockup() {
  return (
    <PhoneMockupFrame>
      <View style={mockStyles.navBar}>
        <Text style={mockStyles.navTitle}>Profile</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={mockStyles.cardList}>
        <View style={mockStyles.menuItem}>
          <Ionicons name="document-text" size={20} color="#FF9F0A" />
          <Text style={mockStyles.menuLabel}>Health Details</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
        <View style={mockStyles.menuItemHighlighted}>
          <Ionicons name="folder" size={20} color="#007AFF" />
          <Text style={mockStyles.menuLabelHighlighted}>Health Records</Text>
          <Ionicons name="chevron-forward" size={16} color="#007AFF" />
        </View>
        <View style={mockStyles.menuItem}>
          <Ionicons name="id-card" size={20} color="#30D158" />
          <Text style={mockStyles.menuLabel}>Health Checklist</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
        <View style={mockStyles.menuItem}>
          <Ionicons name="notifications" size={20} color="#FF375F" />
          <Text style={mockStyles.menuLabel}>Notifications</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
      {/* Get Started button */}
      <View style={mockStyles.getStartedWrap}>
        <View style={mockStyles.getStartedButton}>
          <Text style={mockStyles.getStartedText}>Get Started</Text>
        </View>
      </View>
    </PhoneMockupFrame>
  )
}

function SearchMockup() {
  return (
    <PhoneMockupFrame>
      <View style={mockStyles.navBar}>
        <Text style={mockStyles.navTitle}>Health Records</Text>
        <View style={{ width: 28 }} />
      </View>
      {/* Search bar */}
      <View style={mockStyles.searchBar}>
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
        <Text style={mockStyles.searchPlaceholder}>Search for a provider...</Text>
      </View>
      {/* Results */}
      <View style={mockStyles.cardList}>
        <View style={mockStyles.providerItem}>
          <View style={mockStyles.providerIcon}>
            <Ionicons name="business" size={18} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mockStyles.providerName}>Mayo Clinic</Text>
            <Text style={mockStyles.providerLoc}>Rochester, MN</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
        <View style={mockStyles.providerItem}>
          <View style={mockStyles.providerIcon}>
            <Ionicons name="business" size={18} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mockStyles.providerName}>Cleveland Clinic</Text>
            <Text style={mockStyles.providerLoc}>Cleveland, OH</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
        <View style={mockStyles.providerItem}>
          <View style={mockStyles.providerIcon}>
            <Ionicons name="business" size={18} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={mockStyles.providerName}>Johns Hopkins</Text>
            <Text style={mockStyles.providerLoc}>Baltimore, MD</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
      <View style={mockStyles.arrowWrapBottom}>
        <Text style={mockStyles.arrowLabel}>Sign in with your portal</Text>
        <Ionicons name="arrow-down" size={20} color="#6366F1" />
      </View>
    </PhoneMockupFrame>
  )
}

const MOCKUP_MAP = {
  profile: ProfileMockup,
  records: RecordsMockup,
  search: SearchMockup,
} as const

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HealthConnectScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const successScale = useSharedValue(0)

  const isLastStep = activeIndex === TUTORIAL_STEPS.length - 1

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / CARD_WIDTH)
    setActiveIndex(Math.max(0, Math.min(index, TUTORIAL_STEPS.length - 1)))
  }, [])

  function goToStep(index: number) {
    flatListRef.current?.scrollToIndex({ index, animated: true })
  }

  function handleNext() {
    if (activeIndex < TUTORIAL_STEPS.length - 1) {
      goToStep(activeIndex + 1)
    }
  }

  async function handleConnect() {
    setRequesting(true)
    try {
      const granted = await requestHealthKitPermissions()
      if (granted) {
        setPermissionGranted(true)
        successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
        // Navigate back after success animation
        setTimeout(() => {
          router.back()
        }, 2000)
      } else {
        // Permission denied — still let them go back
        setRequesting(false)
      }
    } catch {
      setRequesting(false)
    }
  }

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }))

  // Success overlay
  if (permissionGranted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.successContainer}>
          <Animated.View style={[styles.successCircle, successStyle]}>
            <LinearGradient
              colors={['#6366F1', '#A78BFA']}
              style={styles.successGradient}
            >
              <Ionicons name="checkmark" size={60} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.Text
            entering={FadeIn.duration(400).delay(300)}
            style={styles.successTitle}
          >
            Connected!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.duration(400).delay(500)}
            style={styles.successSubtitle}
          >
            Your health records will sync automatically
          </Animated.Text>
        </View>
      </View>
    )
  }

  const renderStep = ({ item }: { item: TutorialStep }) => {
    const MockupComponent = MOCKUP_MAP[item.mockup]
    return (
      <View style={styles.stepCard}>
        {/* Step badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step {item.step}</Text>
        </View>

        {/* Phone mockup */}
        <View style={styles.mockupContainer}>
          <MockupComponent />
        </View>

        {/* Instruction */}
        <Text style={styles.stepInstruction}>{item.instruction}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.closeButton}>
          <BlurView intensity={20} tint="dark" style={styles.closeBlur}>
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          </BlurView>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>Connect Health</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Title section */}
      <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.titleSection}>
        <View style={styles.titleIconWrap}>
          <LinearGradient
            colors={['rgba(99,102,241,0.2)', 'rgba(167,139,250,0.1)']}
            style={styles.titleIconBg}
          >
            <Ionicons name="heart-circle" size={32} color="#A78BFA" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>Connect Your Health Records</Text>
        <Text style={styles.subtitle}>
          Follow these steps to link your health records from Apple Health
        </Text>
      </Animated.View>

      {/* Swipeable tutorial */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={TUTORIAL_STEPS}
          renderItem={renderStep}
          keyExtractor={(item) => String(item.step)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 16}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: 28,
            gap: 16,
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_data, index) => ({
            length: CARD_WIDTH + 16,
            offset: (CARD_WIDTH + 16) * index,
            index,
          })}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {TUTORIAL_STEPS.map((_, i) => (
            <Pressable key={i} onPress={() => goToStep(i)}>
              <View
                style={[
                  styles.dot,
                  i === activeIndex && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {isLastStep ? (
          <Pressable
            onPress={handleConnect}
            disabled={requesting}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && !requesting && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Ionicons name="heart" size={20} color="#fff" />
              <Text style={styles.connectText}>
                {requesting ? 'Requesting Access...' : 'Connect Health'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.connectButton,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={['rgba(99,102,241,0.4)', 'rgba(129,140,248,0.4)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Text style={styles.connectText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        <Pressable onPress={() => router.back()} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Phone mockup styles
// ---------------------------------------------------------------------------

const mockStyles = StyleSheet.create({
  phone: {
    width: CARD_WIDTH * 0.65,
    height: CARD_WIDTH * 0.95,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  phoneBg: {
    ...StyleSheet.absoluteFillObject,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statusTime: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusRight: {
    flexDirection: 'row',
    gap: 4,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  profileIcon: {
    position: 'relative',
  },
  profileHighlight: {
    position: 'absolute',
    top: 38,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#6366F1',
    zIndex: 10,
  },
  cardList: {
    paddingHorizontal: 10,
    gap: 6,
    marginTop: 4,
  },
  healthCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  cardValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardSubtext: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
  },
  arrowWrap: {
    position: 'absolute',
    top: 30,
    right: 48,
    alignItems: 'center',
    zIndex: 20,
  },
  arrowWrapBottom: {
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  arrowLabel: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  menuLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  menuItemHighlighted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.3)',
  },
  menuLabelHighlighted: {
    color: '#007AFF',
    fontSize: 13,
    flex: 1,
    fontWeight: '600',
  },
  getStartedWrap: {
    paddingHorizontal: 10,
    marginTop: 10,
  },
  getStartedButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 6,
  },
  searchPlaceholder: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  providerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  providerLoc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 1,
  },
})

// ---------------------------------------------------------------------------
// Screen styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0E1A' },
  glowOrb1: {
    position: 'absolute',
    top: '15%',
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  glowOrb2: {
    position: 'absolute',
    bottom: '25%',
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: { width: 36, height: 36 },
  closeBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { alignItems: 'center' },
  headerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  titleIconWrap: {
    marginBottom: 12,
  },
  titleIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  stepCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    alignItems: 'center',
  },
  stepBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  stepBadgeText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mockupContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepInstruction: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#6366F1',
    width: 24,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  connectButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  connectGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  connectText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 28,
  },
  successGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
  },
})
