import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTheme } from '../../theme'

type Status = 'low' | 'high' | 'normal'

type LabPoint = {
  date: string // YYYY-MM-DD
  value: number
  status: Status
}

type LabSeries = {
  key: string
  label: string
  color: string
  unit: string
  normalRange: [number, number]
  // Bar display bounds — the full span of the range strip.
  // Placeholder values, REPLACE with real clinical ranges before launch.
  displayRange: [number, number]
  points: LabPoint[]
}

// Demo data — replace with real lab fetches when the wiring lands.
// NOTE: displayRange + normalRange below are made-up demo ranges. Replace with
// real clinical ranges (e.g. from LOINC reference data or your provider feed)
// before this ships to real users.
const DEMO_LABS: LabSeries[] = [
  {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    color: '#FACC15',
    unit: 'g/dL',
    normalRange: [12, 17],
    displayRange: [6, 20],
    points: [{ date: '2026-05-09', value: 11.2, status: 'low' }],
  },
  {
    key: 'platelet',
    label: 'Platelet Count',
    color: '#FB923C',
    unit: 'K/uL',
    normalRange: [150, 400],
    displayRange: [50, 500],
    points: [{ date: '2026-05-09', value: 145, status: 'low' }],
  },
  {
    key: 'wbc',
    label: 'WBC (White Blood Cells)',
    color: '#22D3EE',
    unit: 'K/uL',
    normalRange: [4, 11],
    displayRange: [1, 15],
    points: [{ date: '2026-05-09', value: 3.2, status: 'low' }],
  },
  {
    key: 'creatinine',
    label: 'Creatinine',
    color: '#34D399',
    unit: 'mg/dL',
    normalRange: [0.6, 1.2],
    displayRange: [0, 2],
    points: [{ date: '2026-05-09', value: 0.9, status: 'normal' }],
  },
  {
    key: 'her2',
    label: 'HER2/neu',
    color: '#F472B6',
    unit: 'ng/mL',
    normalRange: [0, 15],
    displayRange: [0, 30],
    points: [{ date: '2026-05-06', value: 15.8, status: 'high' }],
  },
  {
    key: 'ca153',
    label: 'CA 15-3',
    color: '#A78BFA',
    unit: 'U/mL',
    normalRange: [0, 30],
    displayRange: [0, 50],
    points: [],
  },
]

const RECENT_RESULTS: Array<{
  date: string
  name: string
  value: string
  unit: string
  status: Status
}> = [
  { date: 'May 9', name: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', status: 'low' },
  { date: 'May 9', name: 'Hemoglobin', value: '11.2', unit: 'g/dL', status: 'low' },
  { date: 'May 9', name: 'Platelet Count', value: '145', unit: 'K/uL', status: 'low' },
  { date: 'May 9', name: 'Creatinine', value: '0.9', unit: 'mg/dL', status: 'normal' },
  { date: 'May 6', name: 'HER2/neu', value: '15.8', unit: 'ng/mL', status: 'high' },
]

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HealthDataPanel() {
  const theme = useTheme()
  const [selectedKey, setSelectedKey] = useState<string>('hemoglobin')

  const topCards = DEMO_LABS.slice(0, 3)
  const selected = DEMO_LABS.find((l) => l.key === selectedKey) ?? DEMO_LABS[0]!

  return (
    <View style={{ gap: 14 }}>
      <DemoTagRow label="Lab data shown is demo content. Real labs will appear once synced." />

      {/* Top stat cards */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {topCards.map((lab) => {
          const latest = lab.points[lab.points.length - 1]
          return (
            <View
              key={lab.key}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            >
              <Text
                style={{ color: theme.textMuted, fontSize: 10, fontWeight: '600' }}
                numberOfLines={1}
              >
                {lab.label}
              </Text>
              <Text
                style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}
              >
                {latest ? latest.value : '—'}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 10, marginTop: 1 }}>{lab.unit}</Text>
              {latest && latest.status !== 'normal' && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor:
                      latest.status === 'low' ? 'rgba(250,204,21,0.15)' : 'rgba(239,68,68,0.15)',
                  }}
                >
                  <Text
                    style={{
                      color: latest.status === 'low' ? '#FACC15' : '#EF4444',
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    {latest.status.toUpperCase()}
                  </Text>
                </View>
              )}
              {latest && (
                <RangeBar
                  value={latest.value}
                  displayMin={lab.displayRange[0]}
                  displayMax={lab.displayRange[1]}
                  normalLow={lab.normalRange[0]}
                  normalHigh={lab.normalRange[1]}
                />
              )}
            </View>
          )
        })}
      </View>

      {/* Lab toggle pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 12 }}
      >
        {DEMO_LABS.map((lab) => {
          const isActive = selectedKey === lab.key
          return (
            <Pressable
              key={lab.key}
              onPress={() => setSelectedKey(lab.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isActive ? 'rgba(99,102,241,0.5)' : theme.border,
                backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: lab.color,
                }}
              />
              <Text
                style={{
                  color: isActive ? '#A78BFA' : theme.textMuted,
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                }}
              >
                {lab.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Trend chart */}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <TrendChart series={selected} mutedColor={theme.textMuted} textColor={theme.text} />
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 11,
            textAlign: 'right',
            marginTop: 8,
          }}
        >
          Normal: {selected.normalRange[0]}–{selected.normalRange[1]} {selected.unit}
        </Text>
      </View>

      {/* Recent results */}
      <View>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: 8,
          }}
        >
          RECENT RESULTS
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          {RECENT_RESULTS.map((r, idx) => (
            <View
              key={`${r.date}-${r.name}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 12,
                gap: 10,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: theme.border,
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Text
                style={{ color: theme.textMuted, fontSize: 11, width: 44 }}
                numberOfLines={1}
              >
                {r.date}
              </Text>
              <Text
                style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '500' }}
                numberOfLines={1}
              >
                {r.name}
              </Text>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                {r.value}
                <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '500' }}>
                  {' '}
                  {r.unit}
                </Text>
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor:
                    r.status === 'normal'
                      ? 'rgba(110,231,183,0.15)'
                      : r.status === 'low'
                        ? 'rgba(250,204,21,0.15)'
                        : 'rgba(239,68,68,0.15)',
                }}
              >
                <Text
                  style={{
                    color:
                      r.status === 'normal'
                        ? '#6EE7B7'
                        : r.status === 'low'
                          ? '#FACC15'
                          : '#EF4444',
                    fontSize: 9,
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  }}
                >
                  {r.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

// Horizontal yellow/green/red strip with a white tick at the current value.
// Built with flex segments + an absolutely-positioned tick — no SVG needed.
function RangeBar({
  value,
  displayMin,
  displayMax,
  normalLow,
  normalHigh,
}: {
  value: number
  displayMin: number
  displayMax: number
  normalLow: number
  normalHigh: number
}) {
  const [barWidth, setBarWidth] = useState(0)
  const total = displayMax - displayMin
  const lowFrac = Math.max(0, (normalLow - displayMin) / total)
  const normalFrac = Math.max(0, (normalHigh - normalLow) / total)
  const highFrac = Math.max(0, (displayMax - normalHigh) / total)
  const clamped = Math.max(displayMin, Math.min(displayMax, value))
  const valueFrac = (clamped - displayMin) / total
  const tickLeftPx = barWidth * valueFrac

  return (
    <View style={{ marginTop: 8 }}>
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={{ flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' }}
      >
        {lowFrac > 0 && <View style={{ flex: lowFrac, backgroundColor: '#FACC15' }} />}
        {normalFrac > 0 && <View style={{ flex: normalFrac, backgroundColor: '#6EE7B7' }} />}
        {highFrac > 0 && <View style={{ flex: highFrac, backgroundColor: '#EF4444' }} />}
      </View>
      {barWidth > 0 && (
        <>
          <View
            style={{
              position: 'absolute',
              left: tickLeftPx - 1,
              top: -3,
              width: 2,
              height: 11,
              backgroundColor: '#fff',
              borderRadius: 1,
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(barWidth - 22, tickLeftPx - 11)),
              top: 10,
              width: 22,
              textAlign: 'center',
              color: '#fff',
              fontSize: 9,
              fontWeight: '700',
            }}
          >
            {value}
          </Text>
        </>
      )}
      {/* Spacer so the label below the bar doesn't overlap. */}
      <View style={{ height: 12 }} />
    </View>
  )
}

function DemoTagRow({ label }: { label: string }) {
  const theme = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(167,139,250,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)',
      }}
    >
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: 'rgba(167,139,250,0.25)',
        }}
      >
        <Text style={{ color: '#A78BFA', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
          DEMO
        </Text>
      </View>
      <Text style={{ color: theme.textMuted, fontSize: 11, flex: 1, lineHeight: 15 }}>
        {label}
      </Text>
    </View>
  )
}

// Minimal trend chart built with plain RN Views — no SVG dep. Renders the
// y-axis grid, a polyline of dots + connecting segments, and an empty-state
// label when fewer than 2 data points exist.
function TrendChart({
  series,
  mutedColor,
  textColor,
}: {
  series: LabSeries
  mutedColor: string
  textColor: string
}) {
  const HEIGHT = 180
  const WIDTH = 280
  const PAD_LEFT = 28
  const PAD_BOTTOM = 24
  const plotHeight = HEIGHT - PAD_BOTTOM
  const plotWidth = WIDTH - PAD_LEFT

  const points = series.points

  // Y-axis bounds — clamp around either the data range or the normal range.
  const allValues = points.map((p) => p.value)
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : series.normalRange[0]
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : series.normalRange[1]
  const yMin = Math.max(0, Math.min(dataMin, series.normalRange[0]) - 1)
  const yMax = Math.max(dataMax, series.normalRange[1]) + 1
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + (yMax - yMin) * t)

  function yToPixel(v: number) {
    return plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight
  }

  function xToPixel(idx: number) {
    if (points.length <= 1) return plotWidth / 2
    return (idx / (points.length - 1)) * (plotWidth - 12) + 6
  }

  return (
    <View style={{ width: WIDTH, height: HEIGHT, alignSelf: 'center' }}>
      {/* Y-axis labels + grid lines */}
      {yTicks.map((t, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: yToPixel(t),
            width: WIDTH,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: mutedColor,
              fontSize: 10,
              width: PAD_LEFT - 4,
              textAlign: 'right',
              marginRight: 4,
            }}
          >
            {Math.round(t)}
          </Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          />
        </View>
      ))}

      {/* Plot area */}
      <View
        style={{
          position: 'absolute',
          left: PAD_LEFT,
          top: 0,
          width: plotWidth,
          height: plotHeight,
        }}
      >
        {points.length < 2 && (
          <Text
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: mutedColor,
              fontSize: 12,
            }}
          >
            {points.length === 0
              ? 'No results yet'
              : 'Only 1 result on record — trend requires at least 2 data points'}
          </Text>
        )}

        {/* Dots + connecting segments */}
        {points.map((p, idx) => {
          const cx = xToPixel(idx)
          const cy = yToPixel(p.value)
          return (
            <View
              key={`${p.date}-${idx}`}
              style={{
                position: 'absolute',
                left: cx - 4,
                top: cy - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: series.color,
                shadowColor: series.color,
                shadowOpacity: 0.6,
                shadowRadius: 4,
              }}
            />
          )
        })}
      </View>

      {/* X-axis labels */}
      <View
        style={{
          position: 'absolute',
          left: PAD_LEFT,
          right: 0,
          bottom: 0,
          height: PAD_BOTTOM,
          justifyContent: 'flex-end',
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          {points.map((p, idx) => (
            <Text
              key={p.date + idx}
              style={{
                position: 'absolute',
                left: xToPixel(idx) - 20,
                width: 40,
                textAlign: 'center',
                color: textColor === '#000' ? '#777' : '#A78BFA',
                fontSize: 11,
              }}
            >
              {shortDate(p.date)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}
