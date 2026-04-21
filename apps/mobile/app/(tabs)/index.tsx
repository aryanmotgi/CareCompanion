import { useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { syncHealthKitData } from '../../src/services/healthkit'

export default function HomeScreen() {
  useEffect(() => {
    // Sync HealthKit on every app open — server deduplicates via healthkitFhirId
    syncHealthKitData().catch(console.error)
  }, [])

  return (
    <ScrollView style={s.container}>
      <Text style={s.heading}>Welcome back</Text>
      <View style={s.card}><Text style={s.cardTitle}>Upcoming Appointments</Text><Text style={s.placeholder}>Syncing from HealthKit...</Text></View>
      <View style={s.card}><Text style={s.cardTitle}>Medications</Text><Text style={s.placeholder}>Syncing from HealthKit...</Text></View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', marginTop: 48, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  placeholder: { color: '#999', fontSize: 14 },
})
