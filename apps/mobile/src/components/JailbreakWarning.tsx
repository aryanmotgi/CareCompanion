// apps/mobile/src/components/JailbreakWarning.tsx
//
// Non-dismissible-by-accident warning shown when the device is jailbroken/rooted.
// HIPAA requires we warn users of increased risk; we do NOT block app use
// (blocking would impact caregiver emergencies) but we surface the risk clearly.
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../theme'

interface Props {
  visible: boolean
  onDismiss: () => void
}

export function JailbreakWarning({ visible, onDismiss }: Props) {
  const theme = useTheme()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.rose }]}>Security Warning</Text>
          <Text style={[styles.body, { color: theme.text }]}>
            This device appears to be jailbroken or rooted.
          </Text>
          <Text style={[styles.body, styles.bodySpaced, { color: theme.textSub }]}>
            Using CareCompanion on a jailbroken device may expose your protected health
            information (PHI) to unauthorized apps. Keychain-stored session tokens can be
            extracted by privileged processes.
          </Text>
          <Text style={[styles.body, styles.bodySpaced, { color: theme.textSub }]}>
            For HIPAA compliance, we strongly recommend using an unmodified device.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.accent }]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Acknowledge jailbreak warning and continue"
          >
            <Text style={styles.buttonText}>I Understand — Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  bodySpaced: {
    marginTop: 10,
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})
