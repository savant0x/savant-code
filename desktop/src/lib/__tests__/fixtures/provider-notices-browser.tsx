import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { ProviderNotificationsPanel } from '../../../components/chat/ProviderNotificationsPanel'
import { useProviderNotifications } from '../../../hooks/use-provider-notifications'
import { useProviderNoticeStore } from '../../../state/provider-notifications'
import { ingestEvents, transcriptStore } from '../../../state/transcript-store'
import { GatewayClient } from '../../gateway-client'

import '../../../tokens.css'
import '../../../styles.css'

declare global {
  interface Window {
    providerSmoke: {
      connect: (port: number) => void
      disconnect: () => void
      unread: () => number
      transcriptSize: () => number
    }
  }
}
const client = new GatewayClient()
client.onEvents(ingestEvents)
window.providerSmoke = {
  connect: (port) => client.connect({ port, token: 'local-smoke-fixture' }),
  disconnect: () => client.close(),
  unread: () =>
    useProviderNoticeStore
      .getState()
      .notices.filter((n) => !n.dismissed && n.unread).length,
  transcriptSize: () => transcriptStore.getState().blocks.length,
}
function Harness() {
  const [status, setStatus] = useState(client.getStatus())
  useProviderNotifications(client)
  useEffect(() => client.onStatus(setStatus), [])
  return (
    <main style={{ maxWidth: '28rem', margin: '2rem' }}>
      <p role="status">{status}</p>
      <ProviderNotificationsPanel
        api={client.providerNotices}
        connected={status === 'ready'}
      />
    </main>
  )
}
const node = document.createElement('div')
document.body.append(node)
createRoot(node).render(<Harness />)
