// Parity-gateway-probes — Kilo + OpenCode gateway surface probe (2026-10-12).
//
// Read-only surface measurement for the provider-parity program. The Tier 1/2
// per-vendor addition path is blocked on operator keys (none held for any
// target), so the aggregator path — one registry entry per gateway — is
// measured instead. Per gateway this probe captures:
//   1. keyless catalog GET — status, roster count, envelope + field shape
//   2. keyed catalog GET   — status, roster count (skipped without a key)
//   3. free-row and window-field coverage on the keyless roster
//   4. inference smoke     — one free model per gateway, reasoning budget
//
// Key handling follows the identity gauntlet
// (scripts/providers/identity-gauntlet.ts): `<SLUG>_API_KEY` from process.env
// at invocation, sent in request headers only, never logged or written. A
// missing key skips the keyed legs with a named refusal before any request is
// attempted. The gauntlet's IDENTITY_API_KEY fallback is deliberately NOT
// mirrored: this probe measures two different gateways, so a shared fallback
// key would be sent to the wrong host.
//
// Module scope is required for the top-level await below (TS1375): this file
// has no imports of its own — hence the empty export. Keep it.
export {}

const TIMEOUT_MS = 30_000

// Reasoning models spend a small budget on reasoning tokens and return empty
// content with finish_reason "length" (measured 2026-10-12 at 16 tokens);
// 128 leaves room for visible content after the reasoning phase.
const SMOKE_MAX_TOKENS = 128
const SMOKE_PROMPT = 'Reply with exactly: SAVANT-CHAIN-OK'

interface GatewaySpec {
  readonly id: string
  readonly label: string
  readonly catalogUrl: string
  readonly chatUrl: string
  readonly smokeModels: readonly string[]
}

const GATEWAYS: readonly GatewaySpec[] = [
  {
    id: 'kilo',
    label: 'Kilo Gateway',
    catalogUrl: 'https://api.kilo.ai/api/gateway/models',
    chatUrl: 'https://api.kilo.ai/api/gateway/chat/completions',
    smokeModels: ['liquid/lfm-2.5-2.6b:free', 'inclusionai/ling-3.1-flash'],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    catalogUrl: 'https://opencode.ai/inference/v1/models',
    chatUrl: 'https://opencode.ai/inference/v1/chat/completions',
    smokeModels: ['ling-3.0-flash-free'],
  },
]

type FetchOutcome =
  | {
      readonly kind: 'response'
      readonly status: number
      readonly text: string
    }
  | { readonly kind: 'transport'; readonly error: string }

async function fetchText(
  url: string,
  init: RequestInit,
): Promise<FetchOutcome> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return {
      kind: 'response',
      status: response.status,
      text: await response.text(),
    }
  } catch (error) {
    return {
      kind: 'transport',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Gauntlet key pattern: `<SLUG>_API_KEY` from the environment, or undefined. */
function resolveKey(slug: string): string | undefined {
  return process.env[`${slug.toUpperCase()}_API_KEY`]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Reads the `data[]` envelope both gateways publish; non-objects dropped. */
function readRows(payload: unknown): Record<string, unknown>[] {
  const data = asRecord(payload)?.['data']
  if (!Array.isArray(data)) return []
  const rows: Record<string, unknown>[] = []
  for (const row of data) {
    const record = asRecord(row)
    if (record) rows.push(record)
  }
  return rows
}

function reportShape(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log('shape: no rows to measure')
    return
  }
  const withId = rows.filter((row) => typeof row['id'] === 'string').length
  const withWindow = rows.filter(
    (row) => typeof row['context_length'] === 'number',
  ).length
  const withPricing = rows.filter(
    (row) => asRecord(row['pricing']) !== undefined,
  ).length
  const free = rows.filter((row) => row['isFree'] === true).length
  console.log(
    `shape: id ${withId}/${rows.length}, context_length ${withWindow}/${rows.length}, ` +
      `pricing ${withPricing}/${rows.length}, isFree ${free}`,
  )
}

async function probeCatalog(
  spec: GatewaySpec,
  key: string | undefined,
): Promise<void> {
  console.log(`--- ${spec.label} catalog ---`)
  const keyless = await fetchText(spec.catalogUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (keyless.kind === 'transport') {
    console.log(`keyless GET: transport error: ${keyless.error}`)
  } else {
    const rows = readRows(parsePayload(keyless.text))
    console.log(
      `keyless GET: HTTP ${keyless.status}, ${keyless.text.length} bytes, ${rows.length} rows`,
    )
    reportShape(rows)
  }
  if (key === undefined) {
    console.log(
      `keyed GET: skipped — no ${spec.id.toUpperCase()}_API_KEY (nothing was sent)`,
    )
    return
  }
  const keyed = await fetchText(spec.catalogUrl, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
  })
  if (keyed.kind === 'transport') {
    console.log(`keyed GET: transport error: ${keyed.error}`)
    return
  }
  const keyedRows = readRows(parsePayload(keyed.text))
  console.log(
    `keyed GET: HTTP ${keyed.status}, ${keyed.text.length} bytes, ${keyedRows.length} rows`,
  )
}

/** Surfaces the gateway's structured upstream-error metadata when present. */
function summarizeError(text: string): string {
  const error = asRecord(asRecord(parsePayload(text))?.['error'])
  const message =
    typeof error?.['message'] === 'string' ? error['message'] : 'unparsed body'
  const metadata = asRecord(error?.['metadata'])
  if (metadata === undefined) return message
  const provider = String(metadata['provider_name'] ?? 'unknown')
  const byok = metadata['is_byok'] === true ? 'yes' : 'no'
  const source = String(metadata['limit_source'] ?? 'unknown')
  return `${message} (upstream=${provider}, byok=${byok}, limit_source=${source})`
}

function reportCompletion(requested: string, payload: unknown): void {
  const body = asRecord(payload)
  const choices = body?.['choices']
  const choice = Array.isArray(choices) ? asRecord(choices[0]) : undefined
  const message = asRecord(choice?.['message'])
  const content =
    typeof message?.['content'] === 'string' ? message['content'].trim() : ''
  const hasReasoning = typeof message?.['reasoning'] === 'string'
  const echoed = typeof body?.['model'] === 'string' ? body['model'] : 'unknown'
  const finish =
    typeof choice?.['finish_reason'] === 'string'
      ? choice['finish_reason']
      : 'unknown'
  const usage = asRecord(body?.['usage'])
  console.log(
    `smoke ${requested}: HTTP 200, echoed=${echoed}, finish=${finish}`,
  )
  console.log(
    `  content: [${content}]${hasReasoning ? ' (reasoning field present)' : ''}`,
  )
  if (usage !== undefined) {
    const prompt = String(usage['prompt_tokens'])
    const completion = String(usage['completion_tokens'])
    console.log(`  usage: prompt=${prompt} completion=${completion}`)
  }
  if (echoed !== requested) {
    console.log(`  id note: requested ${requested}, gateway echoed ${echoed}`)
  }
}

async function probeSmoke(
  spec: GatewaySpec,
  model: string,
  key: string | undefined,
): Promise<void> {
  if (key === undefined) {
    console.log(
      `smoke ${model}: skipped — no ${spec.id.toUpperCase()}_API_KEY (nothing was sent)`,
    )
    return
  }
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: SMOKE_PROMPT }],
    max_tokens: SMOKE_MAX_TOKENS,
  })
  const outcome = await fetchText(spec.chatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  })
  if (outcome.kind === 'transport') {
    console.log(`smoke ${model}: transport error: ${outcome.error}`)
    return
  }
  if (outcome.status !== 200) {
    console.log(
      `smoke ${model}: HTTP ${outcome.status} — ${summarizeError(outcome.text)}`,
    )
    return
  }
  reportCompletion(model, parsePayload(outcome.text))
}

for (const spec of GATEWAYS) {
  const key = resolveKey(spec.id)
  console.log(`=== ${spec.label} (${spec.id}) ===`)
  await probeCatalog(spec, key)
  for (const model of spec.smokeModels) {
    await probeSmoke(spec, model, key)
  }
  console.log('')
}
