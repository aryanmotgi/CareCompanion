import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../src/theme'
import { useProfile } from '../src/context/ProfileContext'

type ConditionRow = { id: string; code: string | null; display: string; clinicalStatus: string | null; onsetDateTime: string | null }
type AllergyRow = { id: string; code: string | null; display: string; reaction: string | null; criticality: string | null }
type ProcedureRow = { id: string; code: string | null; display: string; performedDateTime: string | null }
type ImmunizationRow = { id: string; code: string | null; display: string; occurrenceDateTime: string | null }

type RecordsResponse = {
  conditions: ConditionRow[]
  allergies: AllergyRow[]
  procedures: ProcedureRow[]
  immunizations: ImmunizationRow[]
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function HealthRecordsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { apiClient } = useProfile()

  const [data, setData] = useState<RecordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient.healthkit
      .records()
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load records')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiClient])

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: '800' }}>
          Health Records
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
        {loading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        )}

        {error && !loading && (
          <Text style={{ color: theme.rose, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        {!loading && !error && data && (
          <>
            <Section
              theme={theme}
              icon="medkit-outline"
              label={`CONDITIONS (${data.conditions.length})`}
              emptyText="No conditions on file."
            >
              {data.conditions.map((c) => (
                <RecordRow
                  key={c.id}
                  theme={theme}
                  title={c.display}
                  subtitle={[c.clinicalStatus, formatDate(c.onsetDateTime)].filter(Boolean).join(' · ')}
                  code={c.code}
                />
              ))}
            </Section>

            <Section
              theme={theme}
              icon="warning-outline"
              label={`ALLERGIES (${data.allergies.length})`}
              emptyText="No allergies on file."
            >
              {data.allergies.map((a) => (
                <RecordRow
                  key={a.id}
                  theme={theme}
                  title={a.display}
                  subtitle={[a.criticality, a.reaction].filter(Boolean).join(' · ')}
                  code={a.code}
                />
              ))}
            </Section>

            <Section
              theme={theme}
              icon="cut-outline"
              label={`PROCEDURES (${data.procedures.length})`}
              emptyText="No procedures on file."
            >
              {data.procedures.map((p) => (
                <RecordRow
                  key={p.id}
                  theme={theme}
                  title={p.display}
                  subtitle={formatDate(p.performedDateTime)}
                  code={p.code}
                />
              ))}
            </Section>

            <Section
              theme={theme}
              icon="shield-checkmark-outline"
              label={`IMMUNIZATIONS (${data.immunizations.length})`}
              emptyText="No immunizations on file."
            >
              {data.immunizations.map((i) => (
                <RecordRow
                  key={i.id}
                  theme={theme}
                  title={i.display}
                  subtitle={formatDate(i.occurrenceDateTime)}
                  code={i.code}
                />
              ))}
            </Section>

            <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              Synced from Apple Health
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Section({
  theme,
  icon,
  label,
  emptyText,
  children,
}: {
  theme: ReturnType<typeof useTheme>
  icon: keyof typeof Ionicons.glyphMap
  label: string
  emptyText: string
  children: React.ReactNode
}) {
  const childArray = React.Children.toArray(children)
  const isEmpty = childArray.length === 0
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
      {isEmpty ? (
        <Text style={{ color: theme.textMuted, fontSize: 13, fontStyle: 'italic', paddingHorizontal: 4 }}>
          {emptyText}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>{children}</View>
      )}
    </View>
  )
}

function RecordRow({
  theme,
  title,
  subtitle,
  code,
}: {
  theme: ReturnType<typeof useTheme>
  title: string
  subtitle: string
  code: string | null
}) {
  return (
    <View
      style={{
        padding: 12,
        backgroundColor: theme.bgCard,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        gap: 4,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: theme.textSub, fontSize: 13 }}>{subtitle}</Text>
      ) : null}
      {code ? (
        <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: 'monospace' }}>{code}</Text>
      ) : null}
    </View>
  )
}
