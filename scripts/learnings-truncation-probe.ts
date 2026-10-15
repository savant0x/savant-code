import { truncateToolOutputValue } from '@savant-code/agent-runtime/util/simplify-tool-results'

import type { JSONValue } from '@savant-code/common/types/json'

/** Current producer-shaped measurements replace the expired scratchpad probe. */
export function measureLearningTruncation(): Array<{
  shape: string
  originalCharacters: number
  resultCharacters: number
  preservedWithoutRetention: boolean
}> {
  const shapes: Array<{ shape: string; value: JSONValue }> = [
    { shape: '60000-character string', value: 'x'.repeat(60_000) },
    {
      shape: '3000-item array',
      value: Array.from(
        { length: 3000 },
        (_, index) => `item ${index} ${'x'.repeat(20)}`,
      ),
    },
    { shape: '3000-line string', value: 'line\n'.repeat(3000) },
    { shape: 'over-cap object', value: { text: 'x'.repeat(60_000) } },
    {
      shape: 'nested search object',
      value: { results: [{ content: 'x'.repeat(60_000) }] },
    },
  ]
  return shapes.map(({ shape, value }) => {
    const result = truncateToolOutputValue(value)
    return {
      shape,
      originalCharacters: JSON.stringify(value).length,
      resultCharacters: JSON.stringify(result).length,
      preservedWithoutRetention:
        result === value ||
        (typeof result === 'object' &&
          result !== null &&
          !Array.isArray(result) &&
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.entries(value).every(([key, field]) => result[key] === field)),
    }
  })
}

if (import.meta.main) {
  const result = measureLearningTruncation()
  console.log(
    JSON.stringify({
      measurement: 'current code; no historical parity claim',
      shapes: result,
    }),
  )
  process.exitCode = result.every((entry) => entry.preservedWithoutRetention)
    ? 0
    : 1
}
