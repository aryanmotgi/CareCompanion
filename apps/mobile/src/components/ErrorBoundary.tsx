import React from 'react'
import { View, Text, Pressable, ScrollView, Platform } from 'react-native'

type Props = { children: React.ReactNode }
type State = { error: Error | null; info: React.ErrorInfo | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info })
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  handleReset = () => {
    this.setState({ error: null, info: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          paddingTop: Platform.OS === 'ios' ? 80 : 48,
          backgroundColor: '#1a1a1a',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 12 }}>
          Something went wrong
        </Text>
        <Text style={{ color: '#ccc', fontSize: 15, marginBottom: 24, lineHeight: 22 }}>
          The app hit an unexpected error. Tap retry to reload this screen. If it keeps
          happening, shake the phone to send a bug report.
        </Text>
        <Pressable
          onPress={this.handleReset}
          style={{
            backgroundColor: '#3b82f6',
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Retry</Text>
        </Pressable>
        {__DEV__ && (
          <ScrollView style={{ marginTop: 16, maxHeight: 300 }}>
            <Text style={{ color: '#f87171', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }}>
              {this.state.error.message}
            </Text>
            {this.state.info?.componentStack && (
              <Text
                style={{
                  color: '#9ca3af',
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 11,
                  marginTop: 12,
                }}
              >
                {this.state.info.componentStack}
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    )
  }
}
