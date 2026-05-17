import React from 'react'
import { View, Text } from 'react-native'

interface Props {
  label: string
}

export function DiagnosisPill({ label }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,99,99,0.27)',
        borderWidth: 1,
        borderColor: 'rgba(255,99,99,0.33)',
      }}
    >
      <Text style={{ color: '#ff9d9d', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}
