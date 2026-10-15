/** Controlled local desktop smoke. No provider credentials or outbound IO. */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'provider-desktop-smoke-'))
process.env.SAVANT_CODE_CONFIG_DIR = dir
mkdirSync(join(dir, 'fids'))
globalThis.fetch = Object.assign(async () => Response.json({ data: [] }), {
  preconnect: fetch.preconnect,
})
const { startGateway } = await import('../gateway')
const { providerNotifications } =
  await import('../../utils/provider-notifications')
let sequence = 0
function observe(label: string): void {
  sequence++
  providerNotifications.observe(`smoke-${sequence}`, [
    {
      key: 'endpoint',
      value: 'down',
      providerId: 'fixture',
      kind: 'health-down',
      severity: 'warning',
      selected: true,
      message: label,
    },
  ])
}
observe('Fixture endpoint unavailable')
const gateway = await startGateway({
  token: 'local-smoke-fixture',
  allowedOrigins: ['http://127.0.0.1:1420'],
  fidsDir: join(dir, 'fids'),
  providerMonitoring: false,
  listCommands: () => [],
  loadScopedThreads: () => [],
  runPrompt: async () => {
    throw new Error('Inference prohibited in UI smoke')
  },
})
const control = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch: async (request) => {
    if (request.method === 'POST')
      observe('Fixture warning created while disconnected')
    await providerNotifications.deliver()
    return Response.json(
      { gatewayPort: gateway.port, snapshot: providerNotifications.snapshot() },
      { headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:1420' } },
    )
  },
})
console.log(
  JSON.stringify({ controlPort: control.port, gatewayPort: gateway.port }),
)
function stop(): void {
  control.stop(true)
  gateway.stop()
  rmSync(dir, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
