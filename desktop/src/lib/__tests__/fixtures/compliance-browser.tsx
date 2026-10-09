import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { CompliancePanel } from '../../../components/chat/CompliancePanel'
import { GatewayClient } from '../../gateway-client'
import '../../../tokens.css'
import '../../../styles.css'

const client = new GatewayClient()
declare global {
  interface Window {
    complianceSmoke: { connect(port: number): void; disconnect(): void }
  }
}
window.complianceSmoke = {
  connect: (port) =>
    client.connect({ port, token: 'local-compliance-fixture' }),
  disconnect: () => client.close(),
}
function Harness() {
  const [status, setStatus] = useState(client.getStatus())
  useEffect(() => client.onStatus(setStatus), [])
  return (
    <main style={{ width: 'min(420px, calc(100vw - 32px))', margin: '16px' }}>
      <p role="status">{status}</p>
      <CompliancePanel api={client} connected={status === 'ready'} />
    </main>
  )
}
const mount = document.createElement('div')
document.body.append(mount)
createRoot(mount).render(<Harness />)
