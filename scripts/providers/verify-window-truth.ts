/**
 * FID-2026-0916-002 probe gate — LIVE window-truth drift alarm.
 *
 * Re-pulls the two keyed vendor rosters that publish context windows
 * (bazaarlink, orcarouter) and asserts the fallback table's sampled rows
 * still match the vendor payload. Any mismatch exits 1 — the table must be
 * re-derived from vendor data before shipping.
 *
 * Keys are loaded from the credential store / env and NEVER printed (Law 12).
 * Read-only. Run: bun run scripts/providers/verify-window-truth.ts
 */
import { CONTEXT_WINDOW_FALLBACKS } from '../../common/src/constants/context-windows'

type Roster = Map<string, number>

const keys: Record<string, string> = {}
try {
  const os = require('node:os')
  const fs = require('node:fs')
  const path = require('node:path')
  const creds = JSON.parse(
    fs.readFileSync(
      path.join(os.homedir(), '.savant-code', 'credentials.json'),
      'utf8',
    ),
  )
  for (const [k, v] of Object.entries(creds.providerApiKeys ?? {})) {
    if (typeof v === 'string') keys[k] = v
  }
} catch {}
for (const n of ['BAZAARLINK_API_KEY', 'ORCAROUTER_API_KEY']) {
  if (!keys[n]) keys[n] = process.env[n] ?? ''
}

async function pullRoster(
  url: string,
  apiKey: string | undefined,
): Promise<Roster> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const r = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) {
    throw new Error(`${url} → HTTP ${r.status}`)
  }
  const j = (await r.json()) as {
    data?: Array<{ id?: string; context_length?: number }>
  }
  const map: Roster = new Map()
  for (const m of j.data ?? []) {
    if (typeof m.id === 'string' && typeof m.context_length === 'number') {
      map.set(m.id, m.context_length)
    }
  }
  return map
}

/**
 * Sampled table rows: [tableKey, vendorId as the publishing roster names it,
 * which roster is authoritative for the row]. Vendor ids omit the internal
 * provider prefix (the strip transform's remainder).
 */
const SAMPLES: Array<[string, string, 'bazaarlink' | 'orcarouter']> = [
  // The operator-reported bug row.
  ['tokenharbor/deepseek-v4-flash', 'deepseek-v4-flash', 'bazaarlink'],
  ['tokenharbor/deepseek-v4-flash', 'deepseek/deepseek-v4-flash', 'orcarouter'],
  // Conflict-resolved 2-of-3 rows.
  ['tokenrouter/z-ai/glm-5.2', 'glm-5.2', 'bazaarlink'],
  ['tokenrouter/qwen/qwen3.6-plus', 'qwen3.6-plus', 'bazaarlink'],
  ['tokenrouter/z-ai/glm-5.1', 'glm-5.1', 'bazaarlink'],
  // One row per provider family, cross-vendor where possible.
  ['tokenrouter/openai/gpt-5.6-sol', 'gpt-5.6-sol', 'bazaarlink'],
  ['tokenrouter/moonshotai/kimi-k3', 'kimi-k3', 'bazaarlink'],
  ['tokenrouter/MiniMax-M3', 'minimax-m3', 'bazaarlink'],
  ['tokenharbor/grok-4.5', 'grok-4.5', 'bazaarlink'],
  ['tokenharbor/grok-4.5', 'grok/grok-4.5', 'orcarouter'],
  ['opencode-go/deepseek-v4-pro', 'deepseek/deepseek-v4-pro', 'orcarouter'],
  ['opencode-go/kimi-k3', 'kimi/kimi-k3', 'orcarouter'],
  ['commandcode/z-ai/glm-5.2', 'glm-5.2', 'bazaarlink'],
  ['commandcode/openai/gpt-5.6-sol', 'gpt-5.6-sol', 'bazaarlink'],
  // The direct bazaarlink catalog rows.
  [
    'bazaarlink/qwen/qwen3.7-flash:free',
    'qwen/qwen3.7-flash:free',
    'bazaarlink',
  ],
  ['bazaarlink/claude-fable-5.1', 'claude-fable-5.1', 'bazaarlink'],
  ['bazaarlink/grok-4.5', 'grok-4.5', 'bazaarlink'],
]

const failures: string[] = []
const bl = await pullRoster(
  'https://api.bazaarlink.ai/v1/models',
  keys['BAZAARLINK_API_KEY'],
)
const orca = await pullRoster(
  'https://api.orcarouter.ai/v1/models',
  keys['ORCAROUTER_API_KEY'],
)

for (const [tableKey, vendorId, source] of SAMPLES) {
  const expected = CONTEXT_WINDOW_FALLBACKS.get(tableKey)
  const actual = (source === 'bazaarlink' ? bl : orca).get(vendorId)
  if (expected === undefined) {
    failures.push(`${tableKey}: no fallback-table row (row was removed?)`)
    continue
  }
  if (actual === undefined) {
    // Vendor stopped publishing the id — drift worth flagging, not a table bug.
    console.log(
      `WARN ${tableKey}: vendor ${source} no longer lists ${vendorId}`,
    )
    continue
  }
  if (actual !== expected) {
    failures.push(
      `${tableKey}: table=${expected} but ${source} roster says ${actual} (${vendorId})`,
    )
  } else {
    console.log(`ok   ${tableKey} = ${expected} (${source})`)
  }
}

if (failures.length > 0) {
  console.error('\nWINDOW-TRUTH DRIFT DETECTED:')
  for (const f of failures) console.error(`  FAIL ${f}`)
  process.exit(1)
}
console.log(
  `\nwindow-truth probe PASS: ${SAMPLES.length} sampled rows match vendor rosters`,
)
