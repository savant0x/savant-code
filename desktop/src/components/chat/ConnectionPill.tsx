// FID-2026-0820-010 Loop 3 — connection-state pill (FID Loop 1 Q5 decision:
// persistent connected / reconnecting / offline indicator).

import type { GatewayStatus } from '../../lib/gateway-client'
import type { JSX } from 'react'

const STATUS_LABEL: Record<GatewayStatus, string> = {
  connecting: 'connecting',
  authenticating: 'authenticating',
  ready: 'connected',
  reconnecting: 'reconnecting…',
  offline: 'offline',
}

export function ConnectionPill({
  status,
}: {
  status: GatewayStatus
}): JSX.Element {
  return (
    <span className={`pill pill-${status}`} role="status">
      {STATUS_LABEL[status]}
    </span>
  )
}
