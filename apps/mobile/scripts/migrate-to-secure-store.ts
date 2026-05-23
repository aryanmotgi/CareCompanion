import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// SecureStore iOS Keychain enforces ~2048-byte values. Queue keys may exceed
// this; for those we leave the data in AsyncStorage but the AsyncStorage
// directory is now NSURLIsExcludedFromBackupKey (AppDelegate.mm) so the PHI
// is at rest on-device only, not in iCloud/iTunes backup. Follow-up: shard
// or move to expo-file-system + AES.
const SMALL_PHI_KEYS = ['cc-display-name', 'cc-user-type'] as const

const LARGE_PHI_KEYS = [
  'cc-dev-meds',
  'cc-dev-labs',
  'cc-healthkit-retry-queue',
  'cc-wellness-retry-queue',
] as const

export async function migratePhiToSecureStore(): Promise<void> {
  await Promise.allSettled(
    SMALL_PHI_KEYS.map(async (key) => {
      try {
        const value = await AsyncStorage.getItem(key)
        if (value === null) return
        await SecureStore.setItemAsync(key, value, SECURE_OPTIONS)
        await AsyncStorage.removeItem(key)
      } catch {
        console.warn(`[secure-storage] migration failed for key: ${key}`)
      }
    }),
  )
}

