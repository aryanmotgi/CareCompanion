// apps/mobile/src/utils/haptics.ts
import * as Haptics from 'expo-haptics'

/** Double-tap feel: medium then light 80ms later */
export function hapticMedTaken(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80)
}

/** Warning pulse for abnormal lab values */
function hapticAbnormalLab(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}

/** Soft tap when AI message arrives */
export function hapticAIMessage(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

/** Success burst when scan completes */
function hapticScanSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

/** Escalating scan complete: light → medium → success */
export function hapticScanComplete(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150)
  setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300)
}

/** Double warning pulse for abnormal lab values on entrance */
export function hapticAbnormalLabEntrance(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 100)
}

/** Soft landing for card entrance */
function hapticCardLand(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
}
