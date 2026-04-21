import { View, Text, ScrollView, StyleSheet } from 'react-native'
export default function CareScreen() {
  return (
    <ScrollView style={s.container}>
      <Text style={s.heading}>Medications & Labs</Text>
      <View style={s.card}><Text style={s.title}>Medications</Text><Text style={s.sub}>Synced from HealthKit</Text></View>
      <View style={s.card}><Text style={s.title}>Lab Results</Text><Text style={s.sub}>Synced from HealthKit clinical records</Text></View>
    </ScrollView>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', marginTop: 48, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#999', fontSize: 14 },
})
