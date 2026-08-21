import type { ToolCall } from '../types/agent-definition'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONValue } from '../types/util-types'

/**
 * handleSteps for max mode — programmatic glob + deeper LLM exploration.
 * Max mode encourages the LLM to explore directories more deeply during STEP.
 */
export const handleStepsMax: SecretAgentDefinition['handleSteps'] = function* ({
  prompt,
  params,
}) {
  function isStringArray(value: JSONValue): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    )
  }
  const p = params ?? {}
  const rawDirectories = p.directories
  const directories = isStringArray(rawDirectories) ? rawDirectories : []
  const cwd = directories.length > 0 ? directories[0] : undefined

  // Inlined extractKeywords (must be self-contained for .toString() serialization)
  function _extractKeywords(p: string): string[] {
    const STOP_WORDS = new Set([
      'find',
      'search',
      'look',
      'for',
      'files',
      'file',
      'related',
      'to',
      'the',
      'a',
      'an',
      'in',
      'on',
      'of',
      'and',
      'or',
      'that',
      'which',
      'about',
      'with',
      'show',
      'me',
      'list',
      'get',
      'all',
      'any',
      'where',
      'what',
      'how',
      'please',
      'can',
      'you',
      'i',
      'we',
      'need',
      'want',
    ])
    const raw = p
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_./]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    const seen = new Set<string>()
    const unique = raw.filter((t) =>
      seen.has(t) ? false : (seen.add(t), true),
    )
    if (unique.length === 0) {
      const fallback = p
        .replace(/[^a-z0-9\s\-_./]/gi, ' ')
        .trim()
        .split(/\s+/)[0]
      return fallback ? [fallback.toLowerCase()] : ['*']
    }
    return unique
  }

  // 1. Programmatic glob: extract keywords, search file NAMES
  if (prompt) {
    const keywords = _extractKeywords(prompt)
    for (const keyword of keywords) {
      yield {
        toolName: 'glob',
        input: {
          pattern: `**/*${keyword}*`,
          ...(cwd ? { cwd } : {}),
        },
      } satisfies ToolCall
    }
  }

  // 2. Yield STEP — in max mode, the LLM should explore more deeply:
  //    read key files, explore directory structures, find related modules
  yield 'STEP'

  // 3. LLM calls set_output with final results
  yield {
    toolName: 'set_output',
    input: {
      message: `Scout found these files for: ${prompt}`,
    },
  } satisfies ToolCall
}
