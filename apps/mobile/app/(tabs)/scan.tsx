import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
export default function ScanScreen() {
  return (
    <View style={s.container}>
      <Text style={s.heading}>Scan Document</Text>
      <Text style={s.sub}>Photograph a prescription, lab report, or insurance card</Text>
      <TouchableOpacity style={s.btn}><Text style={s.btnText}>Open Camera</Text></TouchableOpacity>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
