/**
 * Ashna keyed model-catalog census probe (FID-2026-1016-018 evidence leg).
 *
 * GET https://api.ashna.ai/v1/api/models with the operator's ASHNA_API_KEY
 * (repo-root `.env.local`, Bun auto-load, optional explicit parse fallback).
 * The key is resolved, never printed, never embedded in output or an error
 * message (Law 12). The response body is public catalog metadata (model ids
 * and ownership), so the census prints the id/family histograms and the full
 * sorted id list as its durable evidence; nothing but the request header
 * ever sees the key.
 *
 * Exit codes: 0 = census recorded; 1 = HTTP/network failure; 2 = no key.
 * Inference is NOT probed here: the vendor plan-gates the external API
 * (429 insufficient_quota measured 2026-10-16) and the FID records that
 * disposition verbatim instead of spending quota.
 */
const MODEL_LIST_URL = 'https://api.ashna.ai/v1/api/models'

const ENV_NAME = 'ASHNA_API_KEY'

/** Resolve the key from the process env (Bun auto-loads .env.local). */
function resolveKey(): string {
  const direct = process.env[ENV_NAME]
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  // Explicit fallback: parse the repo-root .env.local for the one variable.
  // Only the single line assigned to ENV_NAME is read; values never leave
  // this function.
  for (const path of ['.env.local', '../.env.local', '../../.env.local']) {
    try {
      const text = require('node:fs').readFileSync(path, 'utf8') as string
      for (const line of text.split(/\r?\n/)) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
        if (match !== null && match[1] === ENV_NAME && match[2].length > 0) {
          return match[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      // Missing file — try the next candidate.
    }
  }
  throw new Error(`${ENV_NAME} is not available; refusing to probe keyless`)
}

function familyOf(id: string): string {
  const measured = [
    'voyage',
    'rerank',
    'gpt-',
    'o1',
    'o3',
    'o4',
    'claude',
    'glm',
    'kimi',
    'deepseek',
    'mistral',
    'gemini',
    'grok',
    'mercury',
    'inkling',
    'sonnet',
    'haiku',
    'opus',
    'auto',
  ]
  for (const head of measured) {
    if (id === head || id.startsWith(head)) return head
  }
  return 'other'
}

async function main(): Promise<void> {
  const key = resolveKey()
  const response = await fetch(MODEL_LIST_URL, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    console.error(`Census probe: HTTP ${response.status} from the model list`)
    process.exit(1)
  }
  const parsed: unknown = await response.json()
  const data = (parsed as { data?: unknown }).data
  if (!Array.isArray(data)) {
    console.error('Census probe: unexpected body shape (no data array)')
    process.exit(1)
  }
  const rows = data as Array<Record<string, unknown>>
  const families = new Map<string, number>()
  const objects = new Map<string, number>()
  const owners = new Map<string, number>()
  const ids: string[] = []
  for (const row of rows) {
    if (typeof row?.id !== 'string') continue
    ids.push(row.id)
    const family = familyOf(row.id)
    families.set(family, (families.get(family) ?? 0) + 1)
    const object = typeof row.object === 'string' ? row.object : 'other'
    objects.set(object, (objects.get(object) ?? 0) + 1)
    const owner = typeof row.owned_by === 'string' ? row.owned_by : 'other'
    owners.set(owner, (owners.get(owner) ?? 0) + 1)
  }
  const census = {
    generatedAt: new Date().toISOString(),
    url: MODEL_LIST_URL,
    rowTotal: ids.length,
    families: Object.fromEntries([...families.entries()].sort()),
    objects: Object.fromEntries([...objects.entries()].sort()),
    owners: Object.fromEntries([...owners.entries()].sort()),
    ids: [...ids].sort(),
  }
  console.log(JSON.stringify(census, null, 2))
}

void (async () => {
  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error(
      `Census probe failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    process.exit(
      error instanceof Error && error.message.includes('refusing') ? 2 : 1,
    )
  }
})()
