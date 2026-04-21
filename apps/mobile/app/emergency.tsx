import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../src/theme'
export default function EmergencyScreen() {
  const t = useTheme()
  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>Emergency Card</Text>
      <Text style={[s.sub, { color: t.textMuted }]}>Your emergency contacts and current medications</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15 },
})
