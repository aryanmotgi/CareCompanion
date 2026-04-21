import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { signInWithGoogle, signInWithCredentials } from '../src/services/auth'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'register'>('signin')

  async function handleGoogle() {
    setLoading(true)
    try { await signInWithGoogle(); router.replace('/(tabs)') }
    catch (e) { Alert.alert('Error', String(e)) }
    finally { setLoading(false) }
  }

  async function handleCredentials() {
    if (!email || !password) { Alert.alert('Required', 'Enter email and password'); return }
    setLoading(true)
    try { await signInWithCredentials(email, password, mode); router.replace('/(tabs)') }
    catch (e) { Alert.alert('Error', String(e)) }
    finally { setLoading(false) }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>CareCompanion</Text>
      <Text style={s.sub}>Cancer care, simplified</Text>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleCredentials} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(m => m === 'signin' ? 'register' : 'signin')}>
        <Text style={s.link}>{mode === 'signin' ? 'No account? Register' : 'Have account? Sign In'}</Text>
      </TouchableOpacity>
      <Text style={s.or}>or</Text>
      <TouchableOpacity style={[s.btn, s.google]} onPress={handleGoogle} disabled={loading}>
        <Text style={s.btnText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  google: { backgroundColor: '#ea4335' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#2563eb', marginBottom: 16 },
  or: { textAlign: 'center', color: '#999', marginVertical: 8 },
})
