// T62-followup(1): case-sensitivity evidence. Compare gateway error shape for
// lowercase vs uppercase GLM ids with a minimal 1-token request. If the
// lowercase id yields "model not found" while uppercase does not, the static
// catalog ids are dead on the wire. Read-only in spirit: error paths, 1 token.
import { readProviderProbeKeys } from './credentials'

async function probe(model: string, key: string | undefined): Promise<void> {
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

async function main(): Promise<void> {
  const key = readProviderProbeKeys().COMMAND_CODE_API_KEY
  console.log('COMMAND_CODE_API_KEY present:', key !== undefined)
  await probe('zai-org/glm-5.2', key) // static catalog spelling (lowercase)
  await probe('zai-org/GLM-5.2', key) // live roster spelling
  await probe('zai-org/NOT-A-MODEL', key) // control: definitely-absent id
}

if (import.meta.main) await main()
