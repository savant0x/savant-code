/**
 * Ephemeral probe (T146/T147): pull a Geaix/Excelnt gateway catalog and prove
 * one keyed completion.
 *
 * Observed contract (live, 2026-10-06): GET /v1/models is public and returns
 * 40 OpenAI-style rows carrying `display_name`, `context_window`,
 * `max_output_tokens` and `pricing{input,output,cached_input}`; POST
 * /v1/chat/completions requires the key (401 `missing_api_key`). Every
 * request this probe sends includes the key as `Authorization: Bearer`
 * whenever one is available, so request #1 is already authenticated. Keys
 * are loaded from `~/.savant-code/credentials.json` (`providerApiKeys`) or
 * the environment and NEVER printed (Law 12).
 *
 * Run (path updated by FID-2026-1012-006 step 5 — the probe moved out of the
 * gitignored scratchpad into the typechecked scripts tree):
 *   bun scripts/providers/audit-probes/gateway-catalog-probe.ts <geaix|excelnt>
 *   bun scripts/providers/audit-probes/gateway-catalog-probe.ts <geaix|excelnt> --chat <model-id>
 *
 * Without `--chat` the probe is a read-only GET; `--chat` sends exactly one
 * minimal completion request and needs a live key.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

type Gateway = {
  envVar: string
  baseUrl: string
}

type Pricing = {
  input?: number
  output?: number
  cached_input?: number
}

type ModelRow = {
  id?: string
  display_name?: string
  context_window?: number
  max_output_tokens?: number
  pricing?: Pricing
}

type ModelsResponse = {
  data?: ModelRow[]
}

const GATEWAYS: Record<string, Gateway> = {
  geaix: { envVar: 'GEAIX_API_KEY', baseUrl: 'https://geaix.com/v1' },
  excelnt: { envVar: 'EXCELNT_API_KEY', baseUrl: 'https://excelnt.ai/v1' },
  // Registry-backed gateway (FID-2026-1003-001) — catalog + inference
  // confirmation for an already-integrated provider.
  codecraft: {
    envVar: 'CODECRAFT_API_KEY',
    baseUrl: 'https://codecraftapi.com/v1',
  },
}

function loadKey(envVar: string): string | undefined {
  try {
    const creds = JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), '.savant-code', 'credentials.json'),
        'utf8',
      ),
    ) as { providerApiKeys?: Record<string, unknown> }
    const stored = creds.providerApiKeys?.[envVar]
    if (typeof stored === 'string' && stored.length > 0) return stored
  } catch {
    // fall through to env
  }
  const env = process.env[envVar]
  return env !== undefined && env.length > 0 ? env : undefined
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const USAGE =
  'usage: bun scripts/providers/audit-probes/gateway-catalog-probe.ts ' +
  `<${Object.keys(GATEWAYS).join('|')}> [--chat <model-id>]`

const args = process.argv.slice(2)
const providerName = args[0]
const gateway = providerName === undefined ? undefined : GATEWAYS[providerName]
if (gateway === undefined) fail(USAGE)
if (args.length > 1 && args[1] !== '--chat') fail(USAGE)
const chatModel = args[1] === '--chat' ? args[2] : undefined
if (
  args[1] === '--chat' &&
  (chatModel === undefined || chatModel.length === 0)
) {
  fail('--chat requires a model id (pick one from the catalog output)')
}

const key = loadKey(gateway.envVar)
const auth: Record<string, string> =
  key === undefined ? {} : { Authorization: `Bearer ${key}` }

const res = await fetch(`${gateway.baseUrl}/models`, {
  headers: auth,
  signal: AbortSignal.timeout(30_000),
})
const authMode = key === undefined ? 'none' : 'bearer'
console.log(
  `GET ${gateway.baseUrl}/models (auth: ${authMode}) -> HTTP ${res.status}`,
)
if (!res.ok) fail((await res.text()).slice(0, 500))
const json = (await res.json()) as ModelsResponse
const data = json.data ?? []
console.log(`model count: ${data.length}`)

const fieldSet = new Set<string>()
for (const m of data) for (const field of Object.keys(m)) fieldSet.add(field)
console.log(`fields observed: ${[...fieldSet].sort().join(', ')}`)
console.log(
  '--- id | display_name | context_window | max_output_tokens | in$/1m | out$/1m ---',
)
const rows = data.map((m) =>
  [
    m.id ?? '?',
    m.display_name ?? '-',
    m.context_window === undefined ? '-' : String(m.context_window),
    m.max_output_tokens === undefined ? '-' : String(m.max_output_tokens),
    m.pricing?.input === undefined ? '-' : String(m.pricing.input),
    m.pricing?.output === undefined ? '-' : String(m.pricing.output),
  ].join('\t'),
)
rows.sort()
for (const row of rows) console.log(row)

if (chatModel !== undefined) {
  if (key === undefined) {
    fail(
      `NO KEY: ${gateway.envVar} not present in env or ` +
        '~/.savant-code/credentials.json — --chat cannot run',
    )
  }
  const chatRes = await fetch(`${gateway.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: chatModel,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 16,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  console.log(
    `POST ${gateway.baseUrl}/chat/completions (${chatModel}) -> HTTP ${chatRes.status}`,
  )
  console.log((await chatRes.text()).slice(0, 500))
}
