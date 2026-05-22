import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

export function useNetworkState(): boolean {
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false)
    })
  }, [])
  return isOnline
}
