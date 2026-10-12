// T62-followup(1): case-sensitivity evidence. Compare gateway error shape for
// lowercase vs uppercase GLM ids with a minimal 1-token request. If the
// lowercase id yields "model not found" while uppercase does not, the static
// catalog ids are dead on the wire. Read-only in spirit: error paths, 1 token.
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
const key = keys.COMMAND_CODE_API_KEY
console.log('COMMAND_CODE_API_KEY present:', key !== undefined)

async function probe(model: string): Promise<void> {
  const r = await fetch(
    'https://api.commandcode.ai/provider/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  )
  const body = await r.text()
  console.log(`\n${model} → HTTP ${r.status}`)
  console.log('  ', body.slice(0, 220).replace(/\s+/g, ' '))
}

await probe('zai-org/glm-5.2') // static catalog spelling (lowercase)
await probe('zai-org/GLM-5.2') // live roster spelling
await probe('zai-org/NOT-A-MODEL') // control: definitely-absent id
