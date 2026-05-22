import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native'

const IOS_APP_STORE_URL = 'itms-apps://itunes.apple.com/app/idcarecompanion'
const ANDROID_MARKET_URL = 'market://details?id=com.carecompanion.app'

export function UpdateScreen() {
  const storeUrl = Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_MARKET_URL

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔄</Text>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.body}>
          A new version of CareCompanion is available. Please update to continue.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(storeUrl).catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel="Open app store to update CareCompanion"
        >
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  button: { backgroundColor: '#6366F1', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
})
