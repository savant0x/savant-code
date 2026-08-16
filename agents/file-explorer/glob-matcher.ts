import { publisher } from '../constants'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONValue, JSONObject } from '@savant-code/common/types/json'

interface GlobQuery {
  pattern: string
  cwd?: string
}

const paramsSchema = {
  type: 'object' as const,
  properties: {
    patterns: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string' as const },
          cwd: { type: 'string' as const },
        },
        required: ['pattern'],
      },
      description: 'Array of glob patterns to match',
    },
  },
  required: ['patterns'],
}

const globMatcher: SecretAgentDefinition = {
  id: 'glob-matcher',
  displayName: 'Glob Matcher',
  spawnerPrompt:
    'Mechanically runs multiple glob pattern matches and returns all matching files',
  // FID-2026-0814-009 B-08: display metadata only — inherits the operator's
  // model via withParentModel; `openrouter/free` is the safe free fallback.
  model: 'openrouter/free',
  publisher,
  outputMode: 'structured_output',
  includeMessageHistory: false,
  toolNames: ['glob', 'set_output'],
  spawnableAgents: [],
  inputSchema: {
    params: paramsSchema,
  },
  handleSteps: function* ({ params }) {
    function isJSONObject(value: JSONValue): value is JSONObject {
      return (
        value !== null && typeof value === 'object' && !Array.isArray(value)
      )
    }
    function asGlobQueryArray(value: JSONValue): GlobQuery[] {
      if (!Array.isArray(value)) return []
      const result: GlobQuery[] = []
      for (const item of value) {
        if (!isJSONObject(item)) continue
        const pattern = item.pattern
        if (typeof pattern !== 'string') continue
        const cwd = item.cwd
        result.push({
          pattern,
          ...(typeof cwd === 'string' ? { cwd } : {}),
        })
      }
      return result
    }
    const p = params ?? {}
    const patterns = asGlobQueryArray(p.patterns)

    const toolResults: JSONValue[] = []
    for (const query of patterns) {
      const { toolResult } = yield {
        toolName: 'glob',
        input: {
          pattern: query.pattern,
          cwd: query.cwd,
        },
      }
      if (toolResult) {
        toolResults.push(
          ...toolResult
            .filter((result) => result.type === 'json')
            .map((result) => result.value),
        )
      }
    }

    yield {
      toolName: 'set_output',
      input: {
        results: toolResults,
      },
      includeToolCall: false,
    }
  },
}

export default globMatcher
