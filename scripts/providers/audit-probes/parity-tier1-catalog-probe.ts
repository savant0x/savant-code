// Parity-tier1-catalog-probe: Keyless registry expansion tool for the Tier 1
// provider-parity program. Users supply their own API keys, so inference
// testing and credential storage are strictly out of scope.
// Using the shared probe-url-guard.ts for trust boundaries and standard
// vendor/models.dev base URLs, this probe measures unauthenticated
// endpoints to determine:
// 1. Reachability & Auth Boundaries: Tests without credentials; an expected
//    401/403 response classifies the entry as a static catalog, not dead.
// 2. Response Structure: Identifies the data envelope and required parsing
//    fields (id, window, pricing).
// 3. ID Conventions: Captures sample model IDs to verify casing and prefixes.

import { isPublicProbeUrl } from '../lib/probe-url-guard'

const TIMEOUT_MS = 15_000
// Same identity string as the shared discovery probe (probe-endpoint.ts).
const UA =
  'SavantCode-DiscoveryBot/1.0 (+https://github.com/savant-code/savant-code)'

interface Target {
  readonly id: string
  readonly baseUrl: string
  readonly envVar: string
  /** Recorded when the models.dev snapshot and the documented URL diverge. */
  readonly note?: string
}

const TARGETS: readonly Target[] = [
  {
    id: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    envVar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    envVar: 'GEMINI_API_KEY',
    note: 'OpenAI-compatible surface; the native Gemini path is a separate protocol question',
  },
  { id: 'xai', baseUrl: 'https://api.x.ai/v1', envVar: 'XAI_API_KEY' },
  {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    envVar: 'DEEPSEEK_API_KEY',
    note: 'models list at /models, not /v1/models',
  },
  {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    envVar: 'GROQ_API_KEY',
  },
  {
    id: 'cohere',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    envVar: 'COHERE_API_KEY',
  },
  {
    id: 'togetherai',
    baseUrl: 'https://api.together.xyz/v1',
    envVar: 'TOGETHER_API_KEY',
  },
  {
    id: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    envVar: 'CEREBRAS_API_KEY',
  },
  {
    id: 'deepinfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    envVar: 'DEEPINFRA_API_KEY',
  },
  {
    id: 'perplexity',
    baseUrl: 'https://api.perplexity.ai',
    envVar: 'PERPLEXITY_API_KEY',
  },
  {
    id: 'alibaba',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    envVar: 'DASHSCOPE_API_KEY',
  },
  {
    id: 'moonshotai',
    baseUrl: 'https://api.moonshot.ai/v1',
    envVar: 'MOONSHOT_API_KEY',
  },
  {
    id: 'zai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    envVar: 'ZHIPU_API_KEY',
  },
  {
    id: 'minimax',
    baseUrl: 'https://api.minimax.io/anthropic/v1',
    envVar: 'MINIMAX_API_KEY',
  },
  {
    id: 'meta',
    baseUrl: 'https://api.llama.com/v1',
    envVar: 'META_MODEL_API_KEY',
    note: 'models.dev snapshot lists api.meta.ai/v1 — unverified; documented Llama API probed',
  },
  {
    id: 'fireworks-ai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    envVar: 'FIREWORKS_API_KEY',
  },
  {
    id: 'baseten',
    baseUrl: 'https://inference.baseten.co/v1',
    envVar: 'BASETEN_API_KEY',
  },
  {
    id: 'venice',
    baseUrl: 'https://api.venice.ai/api/v1',
    envVar: 'VENICE_API_KEY',
  },
]

type Verdict = 'public' | 'key-gated' | 'no-surface' | 'blocked' | 'error'

interface Measurement {
  readonly id: string
  readonly verdict: Verdict
  readonly status: number | null
  readonly rows: number
  readonly envelope: string
  readonly windowField: string
  readonly pricingField: string
  readonly sample: string
  readonly note: string
}

const WINDOW_FIELDS: readonly string[] = [
  'context_length',
  'context_window',
  'max_context_tokens',
  'input_token_limit',
]

const PRICING_FIELDS: readonly string[] = ['pricing', 'cost', 'pricing_tiers']

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function findRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['data', 'models', 'result']) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

function firstRecord(rows: unknown[]): Record<string, unknown> | undefined {
  for (const row of rows) {
    if (typeof row === 'object' && row !== null)
      return row as Record<string, unknown>
  }
  return undefined
}

function detectField(
  record: Record<string, unknown> | undefined,
  candidates: readonly string[],
): string {
  if (record === undefined) return 'no-rows'
  for (const candidate of candidates) {
    if (record[candidate] !== undefined) return candidate
  }
  return 'none'
}

function describeEnvelope(payload: unknown, rowCount: number): string {
  if (Array.isArray(payload)) return 'root-array'
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['data', 'models', 'result']) {
      if (Array.isArray(record[key])) return `${key}[]`
    }
  }
  return rowCount === 0 ? 'unrecognized' : 'unrecognized'
}

function sampleIds(rows: unknown[], limit: number): string {
  const ids: string[] = []
  for (const row of rows) {
    const record = firstRecord([row])
    const id = record?.['id']
    if (typeof id === 'string') ids.push(id)
    if (ids.length >= limit) break
  }
  return ids.length > 0 ? ids.join(', ') : '-'
}

function classifyStatus(status: number | null, rowCount: number): Verdict {
  if (status === null) return 'error'
  if (status === 401 || status === 403) return 'key-gated'
  if (status === 404 || status === 405) return 'no-surface'
  if (status >= 200 && status < 300)
    return rowCount > 0 ? 'public' : 'no-surface'
  return 'error'
}

async function measure(target: Target): Promise<Measurement> {
  const base = {
    id: target.id,
    status: null,
    rows: 0,
    envelope: '-',
    windowField: '-',
    pricingField: '-',
    sample: '-',
  }
  const guard = isPublicProbeUrl(target.baseUrl)
  if (!guard.ok) {
    return { ...base, verdict: 'blocked', note: `guard: ${guard.reason}` }
  }
  const url = `${target.baseUrl.replace(/\/+$/, '')}/models`
  let status: number | null = null
  let text = ''
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    status = response.status
    text = await response.text()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...base, verdict: 'error', note: message }
  }
  const rows = findRows(parseJson(text))
  const record = firstRecord(rows)
  const note = target.note ?? ''
  return {
    id: target.id,
    verdict: classifyStatus(status, rows.length),
    status,
    rows: rows.length,
    envelope: describeEnvelope(parseJson(text), rows.length),
    windowField: detectField(record, WINDOW_FIELDS),
    pricingField: detectField(record, PRICING_FIELDS),
    sample: sampleIds(rows, 5),
    note,
  }
}

function printMeasurement(m: Measurement): void {
  const status = m.status === null ? 'ERR' : String(m.status)
  console.log(
    `${m.id.padEnd(12)} ${m.verdict.padEnd(10)} HTTP ${status.padEnd(4)} rows=${String(m.rows).padEnd(5)} env=${m.envelope.padEnd(12)} window=${m.windowField.padEnd(20)} pricing=${m.pricingField}`,
  )
  if (m.verdict === 'public') console.log(`  ids: ${m.sample}`)
  if (m.note !== '') console.log(`  note: ${m.note}`)
}

function printSummary(measurements: Measurement[]): void {
  const counts = new Map<Verdict, number>()
  for (const m of measurements)
    counts.set(m.verdict, (counts.get(m.verdict) ?? 0) + 1)
  console.log('')
  console.log('=== summary ===')
  for (const verdict of [
    'public',
    'key-gated',
    'no-surface',
    'blocked',
    'error',
  ] as const) {
    const count = counts.get(verdict) ?? 0
    if (count === 0) continue
    const implication =
      verdict === 'public'
        ? 'live catalog viable; parser from the measured envelope'
        : verdict === 'key-gated'
          ? 'expected for first-party labs; static catalog from models.dev metadata, users bring keys'
          : verdict === 'no-surface'
            ? 'no public catalog endpoint; static catalog only'
            : 'investigate before any registry entry'
    console.log(`${verdict}: ${count} — ${implication}`)
  }
}
// FID-2026-1007-002: guarded entrypoint, same shape as scripts/window-coverage-check.ts.
if (import.meta.main) {
  const measurements: Measurement[] = []
  for (const target of TARGETS) measurements.push(await measure(target))
  for (const m of measurements) printMeasurement(m)
  printSummary(measurements)
}
