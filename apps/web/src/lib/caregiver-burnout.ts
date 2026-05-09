/**
 * Caregiver burnout detection and wellness scoring.
 * Analyzes journal entries, chat patterns, and appointment load
 * to detect signs of caregiver burnout before it becomes crisis.
 */
import type { SymptomEntry } from './types'

export interface BurnoutAssessment {
  score: number // 0-100, higher = more burned out
  risk_level: 'low' | 'moderate' | 'high' | 'critical'
  signals: BurnoutSignal[]
  recommendations: string[]
  last_assessed: string
}

interface BurnoutSignal {
  category: 'sleep' | 'mood' | 'energy' | 'pain' | 'isolation' | 'overload'
  signal: string
  weight: number // 0-20 contribution to burnout score
}

/**
 * Assess caregiver burnout risk from symptom journal entries.
 */
export function assessBurnout(
  entries: SymptomEntry[],
  appointmentCount: number,
  daysSinceLastEntry: number | null,
): BurnoutAssessment {
  const signals: BurnoutSignal[] = []
  let score = 0

  if (entries.length === 0) {
    return {
      score: 0,
      risk_level: 'low',
      signals: [],
      recommendations: ['Start logging daily check-ins to help us track your wellbeing.'],
      last_assessed: new Date().toISOString(),
    }
  }

  // Analyze last 14 days of entries
  const recent = entries.slice(0, 14)

  // 1. Sleep quality trend (weight: 20)
  const sleepEntries = recent.filter(e => e.sleepQuality)
  if (sleepEntries.length >= 3) {
    const poorSleep = sleepEntries.filter(e => e.sleepQuality === 'poor' || e.sleepQuality === 'terrible')
    const poorRatio = poorSleep.length / sleepEntries.length
    if (poorRatio >= 0.6) {
      const weight = Math.round(poorRatio * 20)
      signals.push({ category: 'sleep', signal: `Poor sleep ${Math.round(poorRatio * 100)}% of recent nights`, weight })
      score += weight
    }
  }

  // 2. Sleep hours (weight: 15)
  const sleepHours = recent.filter(e => e.sleepHours !== null).map(e => parseFloat(e.sleepHours as string)).filter(n => !isNaN(n))
  if (sleepHours.length >= 3) {
    const avgSleep = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length
    if (avgSleep < 5) {
      signals.push({ category: 'sleep', signal: `Averaging only ${avgSleep.toFixed(1)} hours of sleep`, weight: 15 })
      score += 15
    } else if (avgSleep < 6) {
      signals.push({ category: 'sleep', signal: `Averaging ${avgSleep.toFixed(1)} hours of sleep (below recommended)`, weight: 8 })
      score += 8
    }
  }

  // 3. Mood trend (weight: 20)
  const moodEntries = recent.filter(e => e.mood)
  if (moodEntries.length >= 3) {
    const moodScores: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 }
    const avgMood = moodEntries.reduce((sum, e) => sum + (moodScores[e.mood!] || 3), 0) / moodEntries.length
    if (avgMood <= 2) {
      signals.push({ category: 'mood', signal: 'Consistently reporting bad/terrible mood', weight: 20 })
      score += 20
    } else if (avgMood <= 2.5) {
      signals.push({ category: 'mood', signal: 'Mood has been declining over recent days', weight: 12 })
      score += 12
    }

    // Check for mood deterioration (getting worse over time)
    if (moodEntries.length >= 5) {
      const firstHalf = moodEntries.slice(0, Math.floor(moodEntries.length / 2))
      const secondHalf = moodEntries.slice(Math.floor(moodEntries.length / 2))
      const firstAvg = firstHalf.reduce((s, e) => s + (moodScores[e.mood!] || 3), 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((s, e) => s + (moodScores[e.mood!] || 3), 0) / secondHalf.length
      if (secondAvg < firstAvg - 0.5) {
        signals.push({ category: 'mood', signal: 'Mood is trending downward', weight: 5 })
        score += 5
      }
    }
  }

  // 4. Energy levels (weight: 15)
  const energyEntries = recent.filter(e => e.energy)
  if (energyEntries.length >= 3) {
    const lowEnergy = energyEntries.filter(e => e.energy === 'low' || e.energy === 'very_low')
    const lowRatio = lowEnergy.length / energyEntries.length
    if (lowRatio >= 0.5) {
      const weight = Math.round(lowRatio * 15)
      signals.push({ category: 'energy', signal: `Low energy ${Math.round(lowRatio * 100)}% of recent days`, weight })
      score += weight
    }
  }

  // 5. Pain levels (weight: 10)
  const painEntries = recent.filter(e => e.painLevel !== null)
  if (painEntries.length >= 3) {
    const avgPain = painEntries.reduce((s, e) => s + (e.painLevel || 0), 0) / painEntries.length
    if (avgPain >= 6) {
      signals.push({ category: 'pain', signal: `Average pain level ${avgPain.toFixed(1)}/10`, weight: 10 })
      score += 10
    } else if (avgPain >= 4) {
      signals.push({ category: 'pain', signal: `Moderate pain levels (avg ${avgPain.toFixed(1)}/10)`, weight: 5 })
      score += 5
    }
  }

  // 6. Appointment overload (weight: 10)
  if (appointmentCount >= 5) {
    signals.push({ category: 'overload', signal: `${appointmentCount} appointments in the next 2 weeks`, weight: 10 })
    score += 10
  } else if (appointmentCount >= 3) {
    signals.push({ category: 'overload', signal: `${appointmentCount} appointments coming up`, weight: 5 })
    score += 5
  }

  // 7. Journaling gap (isolation signal) (weight: 10)
  if (daysSinceLastEntry !== null && daysSinceLastEntry > 7) {
    signals.push({
      category: 'isolation',
      signal: `No check-in for ${daysSinceLastEntry} days — may be withdrawing`,
      weight: Math.min(10, daysSinceLastEntry),
    })
    score += Math.min(10, daysSinceLastEntry)
  }

  // Cap at 100
  score = Math.min(100, score)

  // Determine risk level
  let riskLevel: BurnoutAssessment['risk_level'] = 'low'
  if (score >= 70) riskLevel = 'critical'
  else if (score >= 45) riskLevel = 'high'
  else if (score >= 25) riskLevel = 'moderate'

  // Generate recommendations
  const recommendations: string[] = []
  if (signals.some(s => s.category === 'sleep')) {
    recommendations.push('Your sleep has been rough. Even 20 minutes of rest during the day can help.')
  }
  if (signals.some(s => s.category === 'mood')) {
    recommendations.push('Your mood has been low. Consider talking to someone — CancerCare offers free counseling: 800-813-4673.')
  }
  if (signals.some(s => s.category === 'energy')) {
    recommendations.push('Low energy is normal during caregiving. Are you eating regularly? Even small meals help.')
  }
  if (signals.some(s => s.category === 'overload')) {
    recommendations.push('That\'s a lot of appointments. Can a family member or friend take one? You don\'t have to do everything alone.')
  }
  if (signals.some(s => s.category === 'isolation')) {
    recommendations.push('It\'s been a while since your last check-in. How are YOU doing? Caregivers matter too.')
  }
  if (riskLevel === 'critical') {
    recommendations.push('You\'re showing signs of severe burnout. Please reach out: 988 Suicide & Crisis Lifeline, or Cancer Support Community 888-793-9355.')
  }

  return {
    score,
    risk_level: riskLevel,
    signals,
    recommendations,
    last_assessed: new Date().toISOString(),
  }
}
