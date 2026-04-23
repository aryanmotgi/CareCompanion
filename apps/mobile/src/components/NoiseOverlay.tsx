import React from 'react'
import { View, StyleSheet } from 'react-native'

export function NoiseOverlay() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.noise]} pointerEvents="none" />
  )
}

const styles = StyleSheet.create({
  noise: {
    opacity: 0.02,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
})
