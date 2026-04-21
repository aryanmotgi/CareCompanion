import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    const msg: Message = { role: 'user', content: input }
    const next = [...messages, msg]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `next-auth.session-token=${token}` } : {}) },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json() as { content?: string }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? 'Sorry, try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList data={messages} keyExtractor={(_, i) => String(i)} contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === 'user' ? s.user : s.ai]}>
            <Text style={item.role === 'user' ? s.userText : s.aiText}>{item.content}</Text>
          </View>
        )} />
      <View style={s.row}>
        <TextInput style={s.input} value={input} onChangeText={setInput} placeholder="Ask about your care..." multiline />
        <TouchableOpacity style={s.send} onPress={send} disabled={loading}><Text style={s.sendText}>Send</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16, paddingBottom: 8 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: '80%' },
  user: { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  ai: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e5e7eb' },
  userText: { color: '#fff', fontSize: 15 },
  aiText: { color: '#1a1a1a', fontSize: 15 },
  row: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, maxHeight: 100 },
  send: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  sendText: { color: '#fff', fontWeight: '600' },
})
