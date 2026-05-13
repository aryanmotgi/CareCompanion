/**
 * Document scanner wrapper. Uses VisionKit on iOS (multi-page scan with
 * auto-edge-detection) and falls back to expo-image-picker camera elsewhere.
 *
 * OCR is a separate concern — runs after a scan returns image paths. Uses
 * Apple's Vision framework via react-native-vision-camera-text-recognition
 * OR a lazy-loaded MLKit module. Both optional.
 *
 * Install on device:
 *   npx expo install expo-image-picker
 *   npx expo install react-native-document-scanner-plugin
 * Then rebuild via `npx expo run:ios --device <udid>`.
 */
import { Platform } from 'react-native'

export interface ScanResult {
  imageUris: string[]
  // Best-effort OCR text from the first page. null when OCR unavailable.
  extractedText: string | null
}

type ScannerModule = {
  scanDocument: (opts?: unknown) => Promise<{ scannedImages?: string[] }>
} | null

type ImagePickerModule = {
  launchCameraAsync: (opts?: unknown) => Promise<{
    canceled: boolean
    assets?: Array<{ uri: string; text?: string | null }>
  }>
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>
} | null

let scannerCached: ScannerModule | undefined
let pickerCached: ImagePickerModule | undefined

function getScanner(): ScannerModule {
  if (scannerCached !== undefined) return scannerCached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-document-scanner-plugin')
    scannerCached = (mod?.default ?? mod) as ScannerModule
  } catch {
    scannerCached = null
  }
  return scannerCached
}

function getPicker(): ImagePickerModule {
  if (pickerCached !== undefined) return pickerCached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pickerCached = require('expo-image-picker') as ImagePickerModule
  } catch {
    pickerCached = null
  }
  return pickerCached
}

export function isSupported(): boolean {
  return getScanner() !== null || getPicker() !== null
}

export async function scanDocument(): Promise<ScanResult | null> {
  // Prefer the native VisionKit scanner — multi-page, auto-edge, hands users
  // the standard iOS scan UI they already know from Notes/Files.
  const Scanner = getScanner()
  if (Scanner) {
    try {
      const res = await Scanner.scanDocument({ maxNumDocuments: 1 })
      const images = res.scannedImages ?? []
      if (images.length === 0) return null
      return { imageUris: images, extractedText: null }
    } catch {
      // fall through to picker
    }
  }

  // Fallback: regular camera capture. Loses multi-page + auto-crop but works
  // anywhere expo-image-picker is installed (which it usually already is for
  // profile photos).
  const Picker = getPicker()
  if (Picker) {
    try {
      const perm = await Picker.requestCameraPermissionsAsync()
      if (!perm.granted) return null
      const result = await Picker.launchCameraAsync({
        mediaTypes: 'Images',
        quality: 0.85,
        allowsEditing: false,
      })
      if (result.canceled || !result.assets?.[0]) return null
      const asset = result.assets[0]
      return { imageUris: [asset.uri], extractedText: asset.text ?? null }
    } catch {
      return null
    }
  }

  return null
}

// Heuristic: pull a candidate medication name from raw OCR. Most Rx labels
// stack the brand name on its own line near the top in all caps, often
// followed by strength (e.g. "TAMOXIFEN\n20 MG"). This is a best-effort
// regex — UI should always let the user edit the prefilled value.
export function extractMedicationName(text: string | null): { name: string; dose: string } | null {
  if (!text || !text.trim()) return null
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Skip obvious non-name lines: phone numbers, addresses, RX numbers,
    // dates, common Rx prefixes/suffixes.
    if (/^(rx|ndc|dea|pt|qty|pharm|refill|exp|sig|date|dr|md)[:\s#]/i.test(line)) continue
    if (/^[\d\s\-(),.]+$/.test(line)) continue
    if (line.length < 3 || line.length > 40) continue
    // A name is usually 1-3 capitalized words, often all-caps on labels.
    const looksLikeName = /^[A-Z][A-Za-z][A-Za-z0-9\- ]{1,38}$/.test(line)
    if (!looksLikeName) continue
    // Look ahead for a dose ("20 mg", "100MG", "5 ml") on the next 1-2 lines.
    const doseMatch = (lines[i + 1] ?? '').match(/(\d+(?:\.\d+)?)\s?(mg|mcg|ml|g|iu|units?)\b/i)
      || (lines[i + 2] ?? '').match(/(\d+(?:\.\d+)?)\s?(mg|mcg|ml|g|iu|units?)\b/i)
    const dose = doseMatch ? `${doseMatch[1]}${doseMatch[2].toLowerCase()}` : ''
    return { name: titleCase(line), dose }
  }
  return null
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// Stub: Platform.OS check used by callers to hide the scan button on Android
// when the iOS-specific multi-page VisionKit flow is preferred.
export function isPreferredPlatform(): boolean {
  return Platform.OS === 'ios'
}
