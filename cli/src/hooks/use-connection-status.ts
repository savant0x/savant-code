import { useEffect, useRef, useState } from 'react'

// FID-2026-0929-005 (gut the backend): the adaptive health-check loop is
// deleted. Its only job was pinging the backend /api/healthz via
// client.checkConnection(), and there is no backend. The hook now reports
// connected once on mount and never polls; the config + interval math below
// were its polling machinery.

/**
 * Hook that reports connection status. There is no SavantCode backend to
 * ping (FID-2026-0929-005), so the CLI is always "connected" — the status
 * bar shows a steady Ready. The onReconnect callback fires once on mount
 * (isInitialConnection=true) so consumers that armed work on the first
 * connection keep working.
 */
export const useConnectionStatus = (
  onReconnect?: (isInitialConnection: boolean) => void,
) => {
  const [isConnected, setIsConnected] = useState(true)
  // null = never connected, false = was disconnected, true = was connected
  const previousConnectedRef = useRef<boolean | null>(null)

  useEffect(() => {
    previousConnectedRef.current = null
    if (typeof onReconnect === 'function') {
      onReconnect(true)
    }
    void setIsConnected
  }, [])

  return isConnected
}
