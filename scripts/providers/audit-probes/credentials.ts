import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { z } from 'zod/v4'

const credentialsSchema = z.object({
  providerApiKeys: z.record(z.string(), z.json()).optional(),
})

/** Read only when an explicit probe runs; imports never inspect operator credentials. */
export function readProviderProbeKeys(): Record<string, string> {
  try {
    const credentials = credentialsSchema.parse(
      JSON.parse(
        readFileSync(
          join(homedir(), '.savant-code', 'credentials.json'),
          'utf8',
        ),
      ),
    )
    const keys: Record<string, string> = {}
    for (const [name, value] of Object.entries(
      credentials.providerApiKeys ?? {},
    )) {
      if (typeof value === 'string') keys[name] = value
    }
    return keys
  } catch {
    console.error(
      'Provider credentials unavailable; probing without authorization credentials.',
    )
    return {}
  }
}
