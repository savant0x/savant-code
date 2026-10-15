// T62-followup(1): decide authoritative roster for the commandcode GLM rows.
// 1) commandcode keyless roster — does it publish context_length?
// 2) orcarouter keyed roster — which glm ids does it list (and at what window)?
import { z } from 'zod/v4'

import { readProviderProbeKeys } from './credentials'

const modelsSchema = z.object({
  data: z
    .array(
      z
        .object({
          id: z.string().optional(),
          context_length: z
            .union([z.number(), z.string(), z.null()])
            .optional(),
          context_window: z
            .union([z.number(), z.string(), z.null()])
            .optional(),
        })
        .passthrough(),
    )
    .default([]),
})

async function main(): Promise<void> {
  const keys = readProviderProbeKeys()
  const cc = await fetch('https://api.commandcode.ai/provider/v1/models', {
    headers: keys.COMMAND_CODE_API_KEY
      ? { Authorization: `Bearer ${keys.COMMAND_CODE_API_KEY}` }
      : {},
    signal: AbortSignal.timeout(30_000),
  })
  console.log('commandcode /models →', cc.status)
  const ccRows = modelsSchema.parse(await cc.json()).data
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
  const glmRows = modelsSchema
    .parse(await orca.json())
    .data.filter((m) => typeof m.id === 'string' && /glm/i.test(m.id))
  console.log('orcarouter glm rows:')
  for (const m of glmRows) console.log('  ', m.id, m.context_length)
}

if (import.meta.main) await main()
