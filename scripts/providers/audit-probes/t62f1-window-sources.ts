// T62-followup(1): decide authoritative roster for the commandcode GLM rows.
// 1) commandcode keyless roster — does it publish context_length?
// 2) orcarouter keyed roster — which glm ids does it list (and at what window)?
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const keys: Record<string, string> = {}
try {
  const creds = JSON.parse(
    readFileSync(join(homedir(), '.savant-code', 'credentials.json'), 'utf8'),
  )
  for (const [k, v] of Object.entries(creds.providerApiKeys ?? {})) {
    if (typeof v === 'string') keys[k] = v
  }
} catch {}

const cc = await fetch('https://api.commandcode.ai/provider/v1/models', {
  headers: keys.COMMAND_CODE_API_KEY
    ? { Authorization: `Bearer ${keys.COMMAND_CODE_API_KEY}` }
    : {},
  signal: AbortSignal.timeout(30_000),
})
console.log('commandcode /models →', cc.status)
const ccj = (await cc.json()) as { data?: Array<Record<string, unknown>> }
const ccRows = ccj.data ?? []
console.log(
  'commandcode sample row keys:',
  Object.keys(ccRows[0] ?? {}).join(','),
)
for (const row of ccRows) {
  const id = row.id
  if (typeof id === 'string' && /glm/i.test(id)) {
    console.log(
      ' cc:',
      id,
      'context_length =',
      row.context_length,
      'context_window =',
      row.context_window,
    )
  }
}

const orca = await fetch('https://api.orcarouter.ai/v1/models', {
  headers: keys.ORCAROUTER_API_KEY
    ? { Authorization: `Bearer ${keys.ORCAROUTER_API_KEY}` }
    : {},
  signal: AbortSignal.timeout(30_000),
})
console.log('orcarouter /models →', orca.status)
const oj = (await orca.json()) as {
  data?: Array<{ id?: string; context_length?: number }>
}
const glmRows = (oj.data ?? []).filter(
  (m) => typeof m.id === 'string' && /glm/i.test(m.id),
)
console.log('orcarouter glm rows:')
for (const m of glmRows) console.log('  ', m.id, m.context_length)
