// apps/mobile/src/utils/haptics.ts
import * as Haptics from 'expo-haptics'

/** Double-tap feel: medium then light 80ms later */
export function hapticMedTaken(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80)
}

/** Warning pulse for abnormal lab values */
export function hapticAbnormalLab(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}

/** Soft tap when AI message arrives */
export function hapticAIMessage(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

/** Success burst when scan completes */
export function hapticScanSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}
