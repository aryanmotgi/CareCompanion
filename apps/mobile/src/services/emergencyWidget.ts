import { NativeModules, Platform } from 'react-native'
import type { Medication } from '@carecompanion/types'
import type { Profile } from '../context/ProfileContext'

const { EmergencyWidgetBridge } = NativeModules

export interface EmergencyWidgetData {
  patientName: string
  bloodType: string
  allergies: string
  conditions: string
  emergencyContactName: string
  emergencyContactPhone: string
  insuranceId: string
  medications: Array<{ name: string; dose: string }>
}

/**
 * Pushes emergency data to the iOS WidgetKit shared UserDefaults.
 * Call this whenever profile or medications change so the widget stays current.
 * No-ops on Android or if the native module is unavailable.
 */
export function syncEmergencyWidget(
  profile: Profile | null,
  medications: Medication[],
  extra?: { bloodType?: string; insuranceId?: string },
): void {
  if (Platform.OS !== 'ios' || !EmergencyWidgetBridge) return

  const data: EmergencyWidgetData = {
    patientName: profile?.patientName || profile?.displayName || 'Unknown',
    bloodType: extra?.bloodType || '',
    allergies: profile?.allergies || 'NKDA (No Known Drug Allergies)',
    conditions: profile?.conditions || 'None listed',
    emergencyContactName: profile?.emergencyContactName || '',
    emergencyContactPhone: profile?.emergencyContactPhone || '',
    insuranceId: extra?.insuranceId || '',
    medications: medications.map((m) => ({
      name: m.name,
      dose: m.dose || '',
    })),
  }

  try {
    EmergencyWidgetBridge.updateEmergencyData(data)
  } catch {
    // Silently fail — widget sync is non-critical
  }
}
