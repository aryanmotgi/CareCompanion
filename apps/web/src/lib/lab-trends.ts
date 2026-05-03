/**
 * Lab result trend analysis for cancer patients.
 * Detects dangerous blood count trends during chemo cycles.
 * Predicts nadir timing and flags red flag combinations.
 */
import type { LabResult } from './types'

interface TrendAnalysis {
  test_name: string
  unit: string | null
  trend: 'improving' | 'stable' | 'declining' | 'rapid_decline' | 'insufficient_data'
  current_value: number | null
  previous_value: number | null
  change_percent: number | null
  values: Array<{ value: number; date: string }>
  alerts: TrendAlert[]
  prediction_7d: number | null
}

interface TrendAlert {
  severity: 'critical' | 'warning' | 'info'
  message: string
  action: string
}

// Oncology-critical lab thresholds
const CRITICAL_THRESHOLDS: Record<string, { low?: number; high?: number; unit: string; context: string }> = {
  'ANC': { low: 1500, unit: 'cells/mcL', context: 'Neutropenia risk — infection susceptibility increases' },
  'WBC': { low: 4000, unit: 'cells/mcL', context: 'Low white blood cell count — immune function compromised' },
  'Hemoglobin': { low: 10, unit: 'g/dL', context: 'Anemia — may need transfusion or EPO' },
  'Platelets': { low: 100000, unit: '/mcL', context: 'Thrombocytopenia — bleeding risk increases' },
  'Creatinine': { high: 1.3, unit: 'mg/dL', context: 'Kidney function declining — check nephrotoxic drugs' },
  'ALT': { high: 56, unit: 'U/L', context: 'Liver stress — review hepatotoxic medications' },
  'AST': { high: 40, unit: 'U/L', context: 'Liver enzyme elevated — monitor hepatic function' },
  'Bilirubin': { high: 1.2, unit: 'mg/dL', context: 'Elevated bilirubin — possible liver or bile duct issue' },
  'GFR': { low: 60, unit: 'mL/min', context: 'Kidney filtration impaired — may need dose adjustments' },
}

// Red flag combinations that escalate urgency
const RED_FLAG_COMBOS: Array<{ tests: string[]; condition: (vals: Record<string, number>) => boolean; message: string }> = [
  {
    tests: ['ANC', 'WBC'],
    condition: (vals) => (vals['ANC'] || Infinity) < 500 && (vals['WBC'] || Infinity) < 2000,
    message: 'CRITICAL: Severe neutropenia with very low WBC. High infection risk. Contact oncologist immediately.',
  },
  {
    tests: ['Hemoglobin', 'Platelets'],
    condition: (vals) => (vals['Hemoglobin'] || Infinity) < 8 && (vals['Platelets'] || Infinity) < 50000,
    message: 'CRITICAL: Severe anemia + thrombocytopenia. Possible pancytopenia. Urgent hematology consult.',
  },
  {
    tests: ['Creatinine', 'GFR'],
    condition: (vals) => (vals['Creatinine'] || 0) > 2.0 && (vals['GFR'] || Infinity) < 30,
    message: 'WARNING: Acute kidney injury pattern. Hold nephrotoxic chemotherapy. Contact oncologist.',
  },
  {
    tests: ['ALT', 'Bilirubin'],
    condition: (vals) => (vals['ALT'] || 0) > 200 && (vals['Bilirubin'] || 0) > 3.0,
    message: 'WARNING: Significant liver dysfunction. May need to hold hepatotoxic medications.',
  },
]

/**
 * Parse a lab value string to a number, handling common formats.
 */
function parseLabValue(value: string | null): number | null {
  if (!value) return null
  // Remove non-numeric chars except decimal, minus, plus, and exponent notation (e.g. 1.5e-3)
  const cleaned = value.replace(/[^0-9.eE\-\+]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Analyze trends for a specific lab test.
 */
export function analyzeTrend(results: LabResult[]): TrendAnalysis | null {
  if (results.length === 0) return null

  const testName = results[0].testName
  const values = results
    .map(r => ({ value: parseLabValue(r.value), date: r.dateTaken || (r.createdAt ? r.createdAt.toISOString() : null) }))
    .filter((v): v is { value: number; date: string } => v.value !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (values.length === 0) return null

  const current = values[values.length - 1]
  const previous = values.length > 1 ? values[values.length - 2] : null
  const alerts: TrendAlert[] = []

  // Calculate trend
  let trend: TrendAnalysis['trend'] = 'insufficient_data'
  let changePercent: number | null = null

  if (values.length >= 2 && previous) {
    changePercent = ((current.value - previous.value) / Math.abs(previous.value || 1)) * 100

    if (Math.abs(changePercent) < 5) {
      trend = 'stable'
    } else if (changePercent > 0) {
      trend = 'improving' // For most labs, going up is improving (WBC, platelets, hemoglobin)
    } else if (changePercent < -20) {
      trend = 'rapid_decline'
    } else {
      trend = 'declining'
    }

    // For tests where HIGHER is worse, flip the interpretation
    const higherIsWorse = ['Creatinine', 'ALT', 'AST', 'Bilirubin', 'CEA', 'CA-125', 'CA-19-9', 'PSA', 'AFP', 'LDH']
    if (higherIsWorse.some(t => testName.toLowerCase().includes(t.toLowerCase()))) {
      // Use changePercent directly so rapid increases of bad markers become rapid_decline
      if (changePercent !== null && changePercent > 20) {
        trend = 'rapid_decline' // rapid rise of bad marker
      } else if (changePercent !== null && changePercent > 5) {
        trend = 'declining' // moderate rise of bad marker
      } else if (changePercent !== null && changePercent < -5) {
        trend = 'improving' // drop of bad marker is good
      }
      // stable stays stable (Math.abs(changePercent) < 5 already handled above)
    }
  }

  // Check against critical thresholds
  const threshold = Object.entries(CRITICAL_THRESHOLDS).find(
    ([name]) => testName.toLowerCase().includes(name.toLowerCase())
  )

  if (threshold) {
    const [, config] = threshold
    if (config.low && current.value < config.low) {
      alerts.push({
        severity: current.value < config.low * 0.5 ? 'critical' : 'warning',
        message: `${testName} is ${current.value < config.low * 0.5 ? 'critically' : ''} below threshold (${current.value} vs ${config.low} ${config.unit}). ${config.context}`,
        action: current.value < config.low * 0.5 ? 'Contact oncologist immediately' : 'Discuss at next appointment',
      })
    }
    if (config.high && current.value > config.high) {
      alerts.push({
        severity: current.value > config.high * 2 ? 'critical' : 'warning',
        message: `${testName} is above threshold (${current.value} vs ${config.high} ${config.unit}). ${config.context}`,
        action: current.value > config.high * 2 ? 'Contact oncologist immediately' : 'Monitor closely',
      })
    }
  }

  // Rapid decline alert
  if (trend === 'rapid_decline') {
    alerts.push({
      severity: 'warning',
      message: `${testName} dropped ${Math.abs(changePercent || 0).toFixed(0)}% since last result. This may indicate treatment toxicity or disease progression.`,
      action: 'Report this trend to your oncology team',
    })
  }

  // 7-day prediction using simple linear regression on last 3-5 points
  let prediction7d: number | null = null
  if (values.length >= 3) {
    const recentValues = values.slice(-5)
    const n = recentValues.length
    const firstDate = new Date(recentValues[0].date).getTime()
    const xs = recentValues.map(v => (new Date(v.date).getTime() - firstDate) / (1000 * 60 * 60 * 24))
    const ys = recentValues.map(v => v.value)

    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0)
    const sumX2 = xs.reduce((sum, x) => sum + x * x, 0)

    const denom = n * sumX2 - sumX * sumX
    if (denom !== 0) {
      const slope = (n * sumXY - sumX * sumY) / denom
      const intercept = (sumY - slope * sumX) / n
      const lastDay = xs[xs.length - 1]
      prediction7d = Math.round((slope * (lastDay + 7) + intercept) * 10) / 10
      // Don't predict negative values for things that can't be negative
      if (prediction7d < 0) prediction7d = 0
    }
  }

  return {
    test_name: testName,
    unit: results[results.length - 1].unit ?? null,
    trend,
    current_value: current.value,
    previous_value: previous?.value ?? null,
    change_percent: changePercent !== null ? Math.round(changePercent * 10) / 10 : null,
    values,
    alerts,
    prediction_7d: prediction7d,
  }
}

/**
 * Analyze all lab results for a patient and detect red flag combinations.
 */
export function analyzeAllTrends(labResults: LabResult[]): {
  trends: TrendAnalysis[]
  red_flags: string[]
  overall_status: 'critical' | 'concerning' | 'monitor' | 'good'
} {
  // Group by test name
  const grouped = new Map<string, LabResult[]>()
  for (const lab of labResults) {
    const key = lab.testName.toLowerCase()
    const existing = grouped.get(key) || []
    existing.push(lab)
    grouped.set(key, existing)
  }

  const trends: TrendAnalysis[] = []
  for (const results of Array.from(grouped.values())) {
    const trend = analyzeTrend(results)
    if (trend) trends.push(trend)
  }

  // Check red flag combinations
  const redFlags: string[] = []
  const latestValues: Record<string, number> = {}
  for (const trend of trends) {
    if (trend.current_value !== null) {
      latestValues[trend.test_name] = trend.current_value
    }
  }

  for (const combo of RED_FLAG_COMBOS) {
    const hasAllTests = combo.tests.every(t =>
      Object.keys(latestValues).some(k => k.toLowerCase().includes(t.toLowerCase()))
    )
    if (hasAllTests) {
      // Remap keys to match combo test names
      const mappedVals: Record<string, number> = {}
      for (const t of combo.tests) {
        const match = Object.entries(latestValues).find(([k]) => k.toLowerCase().includes(t.toLowerCase()))
        if (match) mappedVals[t] = match[1]
      }
      if (combo.condition(mappedVals)) {
        redFlags.push(combo.message)
      }
    }
  }

  // Determine overall status
  const hasCritical = trends.some(t => t.alerts.some(a => a.severity === 'critical')) || redFlags.length > 0
  const hasWarning = trends.some(t => t.alerts.some(a => a.severity === 'warning'))
  const hasDecline = trends.some(t => t.trend === 'declining' || t.trend === 'rapid_decline')

  let overallStatus: 'critical' | 'concerning' | 'monitor' | 'good' = 'good'
  if (hasCritical) overallStatus = 'critical'
  else if (hasWarning || redFlags.length > 0) overallStatus = 'concerning'
  else if (hasDecline) overallStatus = 'monitor'

  return { trends, red_flags: redFlags, overall_status: overallStatus }
}
