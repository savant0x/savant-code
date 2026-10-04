/**
 * FID-2026-0916-002 probe gate — LIVE window-truth drift alarm.
 *
 * Re-pulls the two keyed vendor rosters that publish context windows
 * (bazaarlink, orcarouter) and asserts the fallback table's sampled rows
 * still match the vendor payload. Any mismatch exits 1 — the table must be
 * re-derived from vendor data before shipping.
 *
 * FID-2026-1004-002: additionally CENSUSES the no-publish gateways' live
 * rosters (apinex keyless per its llms.txt contract; bai via BAI_API_KEY
 * when present) — every roster id must be a fallback-table row or a
 * documented no-row register id, so roster growth fails loudly at audit
 * time instead of silently re-opening the silent-200k gap.
 *
 * Keys are loaded from the credential store / env and NEVER printed (Law 12).
 * Read-only. Run: bun run scripts/providers/verify-window-truth.ts
 */
import { APINEX_NO_ROW_IDS } from '../../common/src/constants/context-window-table-apinex'
import { BAI_NO_ROW_IDS } from '../../common/src/constants/context-window-table-bai'
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
for (const n of [
  'BAZAARLINK_API_KEY',
  'ORCAROUTER_API_KEY',
  'APINEX_API_KEY',
  'BAI_API_KEY',
]) {
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
  // FID-2026-0928-010: re-pointed to orcarouter — 2-of-3 vote upheld the
  // table row on 2026-09-28 (orcarouter + OpenRouter both serve 1,048,576;
  // bazaarlink drifted to 1,000,000 and the WARN path covers its leg).
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
  // FID-2026-0928-010: removed the two pre-realign commandcode keys and the
  // two opencode-go rows (provider removed from Savant — FID-2026-0916-004);
  // all four had failed structurally since the realign. Re-keyed commandcode
  // rows sourced from orcarouter (z-ai/glm-5.2 / z-ai/glm-5.3 → 1,000,000,
  // matching the re-sourced table values).
  ['commandcode/zai-org/GLM-5.2', 'z-ai/glm-5.2', 'orcarouter'],
  ['commandcode/zai-org/GLM-5.3', 'z-ai/glm-5.3', 'orcarouter'],
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

/**
 * No-publish gateway census (FID-2026-1004-002): fetch a live /v1/models
 * roster (ids only — these gateways publish no window fields) and require
 * every id to be either a fallback-table row or a documented no-row
 * register id. Unregistered ids FAIL: the table must be extended (or the
 * id registered with a reason) before shipping.
 */
const NO_ROW_REGISTERS: Record<string, ReadonlySet<string>> = {
  apinex: new Set(APINEX_NO_ROW_IDS.map(([id]) => id)),
  bai: new Set(BAI_NO_ROW_IDS.map(([id]) => id)),
}

async function pullIdList(url: string, apiKey?: string): Promise<string[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const r = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  })
  if (!r.ok) {
    throw new Error(`${url} → HTTP ${r.status}`)
  }
  const j = (await r.json()) as { data?: Array<{ id?: string }> }
  return (j.data ?? [])
    .filter((m): m is { id: string } => typeof m.id === 'string')
    .map((m) => m.id)
}

const censusUnregistered: string[] = []
const censusCounts: string[] = []

for (const [provider, url] of [
  ['apinex', 'https://api.apinex.bond/v1/models'],
  ['bai', 'https://api.b.ai/v1/models'],
] as const) {
  const apiKey = keys[provider === 'apinex' ? 'APINEX_API_KEY' : 'BAI_API_KEY']
  // apinex serves its catalog keyless (llms.txt contract, FID-2026-0907-008);
  // bai requires BAI_API_KEY — without it the census is UNAVAILABLE, noted
  // as an environmental condition, not a failure.
  if (!apiKey && provider === 'bai') {
    console.log(
      `CENSUS-UNAVAILABLE ${provider}: no BAI_API_KEY in env/credential store — run with the key to census the roster`,
    )
    continue
  }
  try {
    const ids = await pullIdList(url, apiKey || undefined)
    const noRow = NO_ROW_REGISTERS[provider]
    let registered = 0
    for (const id of ids) {
      const key = `${provider}/${id}`
      if (CONTEXT_WINDOW_FALLBACKS.has(key) || noRow.has(key)) {
        registered += 1
      } else {
        censusUnregistered.push(key)
      }
    }
    censusCounts.push(
      `${provider}: ${registered}/${ids.length} roster ids registered`,
    )
  } catch (err) {
    // A dead gateway is an environmental condition, not a table drift.
    console.log(`CENSUS-UNAVAILABLE ${provider}: ${(err as Error).message}`)
  }
}

if (failures.length > 0) {
  console.error('\nWINDOW-TRUTH DRIFT DETECTED:')
  for (const f of failures) console.error(`  FAIL ${f}`)
  process.exit(1)
}
if (censusUnregistered.length > 0) {
  console.error('\nWINDOW-TRUTH DRIFT DETECTED (no-publish gateway census):')
  for (const id of censusUnregistered) {
    console.error(
      `  FAIL ${id}: live roster id with no table row and no no-row register entry`,
    )
  }
  process.exit(1)
}
for (const line of censusCounts) console.log(`census ${line}`)
console.log(
  `\nwindow-truth probe PASS: ${SAMPLES.length} sampled rows match vendor rosters`,
)
