import { tool } from 'ai'
import z from 'zod/v4'

import {
  modelFacingToolSet,
  toToolDefinitions,
} from '@savant-code/agent-runtime/tools/canonical-tool-set'
import { stableHash } from '@savant-code/agent-runtime/util/cache-debug-serialize'

/** Remeasure the shipped canonical payload seam; no provider cache ratio is claimed. */
export function measureLearningPrefixStability(): {
  comparisons: number
  stable: number
  ratio: number
} {
  const read = tool({
    description: 'Read evidence',
    inputSchema: z.object({ path: z.string() }),
  })
  const write = tool({
    description: 'Write evidence',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
  })
  const payloads = [
    { read_files: read, write_file: write },
    { write_file: write, read_files: read },
    { read_files: read, write_file: write },
  ]
  const hashes = payloads.map((tools) =>
    stableHash(JSON.stringify(toToolDefinitions(modelFacingToolSet(tools)))),
  )
  const comparisons = hashes.length - 1
  const stable = hashes.slice(1).filter((hash) => hash === hashes[0]).length
  return { comparisons, stable, ratio: stable / comparisons }
}

if (import.meta.main) {
  const result = measureLearningPrefixStability()
  console.log(
    JSON.stringify({
      measurement:
        'canonical payload ordering; current code, synthetic phase orderings',
      ...result,
    }),
  )
  process.exitCode = result.ratio === 1 ? 0 : 1
}
