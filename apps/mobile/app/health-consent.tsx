import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const CONSENT_KEY = 'cc-health-consent-accepted'

interface DataItem {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  color: string
}

const DATA_WE_READ: DataItem[] = [
  {
    icon: 'medkit-outline',
    title: 'Medications',
    description: 'Current prescriptions and dosage information',
    color: '#6366F1',
  },
  {
    icon: 'flask-outline',
    title: 'Lab Results',
    description: 'Blood work, imaging, and diagnostic tests',
    color: '#8B5CF6',
  },
  {
    icon: 'bandage-outline',
    title: 'Conditions',
    description: 'Diagnosed conditions and medical history',
    color: '#A78BFA',
  },
  {
    icon: 'cut-outline',
    title: 'Procedures',
    description: 'Surgeries, treatments, and clinical procedures',
    color: '#C4B5FD',
  },
]

const WHAT_WE_DO = [
  'Sync health records to your care profile for a complete picture',
  'Help our AI give you more personalized, accurate advice',
  'Show medication interactions and lab trend insights',
]

const WHAT_WE_DONT = [
  'Sell your data to anyone, ever',
  'Share with third parties or advertisers',
  'Use your health data for advertising or marketing',
  'Store data outside your encrypted profile',
]

export default function HealthConsentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [agreed, setAgreed] = useState(false)
  const checkScale = useSharedValue(0)

  useEffect(() => {
    checkScale.value = withSpring(agreed ? 1 : 0, {
      damping: 12,
      stiffness: 200,
    })
  }, [agreed, checkScale])

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }))

  async function handleContinue() {
    if (!agreed) return
    await SecureStore.setItemAsync(CONSENT_KEY, new Date().toISOString())
    router.replace('/health-connect')
  }

  function handleLearnMore() {
    Linking.openURL('https://carecompanionai.org/privacy')
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
          <Text style={styles.headerLabel}>HIPAA Consent</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shield icon */}
        <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.iconWrap}>
          <LinearGradient
            colors={['rgba(99,102,241,0.2)', 'rgba(167,139,250,0.1)']}
            style={styles.iconGradient}
          >
            <Ionicons name="shield-checkmark" size={40} color="#A78BFA" />
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeIn.duration(400).delay(200)}>
          <Text style={styles.title}>Health Data Access</Text>
          <Text style={styles.subtitle}>
            We need your permission to read health records from Apple HealthKit.
            Here is exactly what we access and why.
          </Text>
        </Animated.View>

        {/* What we read */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionTitle}>What we read</Text>
          <View style={styles.card}>
            {DATA_WE_READ.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.dataRow,
                  index < DATA_WE_READ.length - 1 && styles.dataRowBorder,
                ]}
              >
                <View style={[styles.dataIcon, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.dataText}>
                  <Text style={styles.dataTitle}>{item.title}</Text>
                  <Text style={styles.dataDesc}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* What we do with it */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={styles.sectionTitle}>What we do with it</Text>
          <View style={styles.card}>
            {WHAT_WE_DO.map((text, i) => (
              <View key={i} style={[styles.bulletRow, i < WHAT_WE_DO.length - 1 && styles.bulletRowBorder]}>
                <Ionicons name="checkmark-circle" size={20} color="#6366F1" style={{ marginTop: 1 }} />
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* What we don't do */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Text style={styles.sectionTitle}>What we never do</Text>
          <View style={styles.card}>
            {WHAT_WE_DONT.map((text, i) => (
              <View key={i} style={[styles.bulletRow, i < WHAT_WE_DONT.length - 1 && styles.bulletRowBorder]}>
                <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginTop: 1 }} />
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* HIPAA notice */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)}>
          <View style={styles.hipaaCard}>
            <View style={styles.hipaaHeader}>
              <Ionicons name="lock-closed" size={16} color="#A78BFA" />
              <Text style={styles.hipaaTitle}>HIPAA Compliance</Text>
            </View>
            <Text style={styles.hipaaText}>
              CareCompanion is designed to comply with the Health Insurance Portability
              and Accountability Act (HIPAA). Your health data is encrypted at rest and
              in transit, and is never shared without your explicit consent. You can
              revoke access at any time in Settings.
            </Text>
          </View>
        </Animated.View>

        {/* Checkbox */}
        <Animated.View entering={FadeInDown.duration(400).delay(700)}>
          <Pressable onPress={() => setAgreed(!agreed)} style={styles.checkRow}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              <Animated.View style={checkStyle}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </Animated.View>
            </View>
            <Text style={styles.checkLabel}>
              I understand and agree to the health data access described above
            </Text>
          </Pressable>
        </Animated.View>

        {/* Learn more */}
        <Animated.View entering={FadeInDown.duration(400).delay(750)}>
          <Pressable onPress={handleLearnMore} style={styles.learnMore}>
            <Ionicons name="open-outline" size={14} color="rgba(167,139,250,0.7)" />
            <Text style={styles.learnMoreText}>Learn more about our privacy practices</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Bottom button */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!agreed}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && agreed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <LinearGradient
            colors={agreed
              ? ['#6366F1', '#818CF8']
              : ['rgba(99,102,241,0.2)', 'rgba(129,140,248,0.2)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <Text style={[styles.continueText, !agreed && { opacity: 0.4 }]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={agreed ? '#fff' : 'rgba(255,255,255,0.4)'}
            />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  )
}

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
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  dataRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dataIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataText: { flex: 1 },
  dataTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  dataDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    lineHeight: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bulletRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  bulletText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  hipaaCard: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
    padding: 16,
    marginBottom: 28,
  },
  hipaaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hipaaTitle: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
  },
  hipaaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  learnMoreText: {
    color: 'rgba(167,139,250,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 12,
    backgroundColor: 'rgba(12,14,26,0.95)',
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
})
