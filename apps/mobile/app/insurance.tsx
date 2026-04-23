import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../src/theme'
export default function InsuranceScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.container, { backgroundColor: t.bg, paddingTop: insets.top + 16 }]}>
      <Text style={[s.title, { color: t.text }]}>Insurance & Claims</Text>
      <Text style={[s.sub, { color: t.textMuted }]}>Your coverage and active claims</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15 },
})
