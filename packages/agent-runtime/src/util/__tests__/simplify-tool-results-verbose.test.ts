// simplify-tool-results — verbose tool pre-pass (P2c).
// Sibling of the Loop 327 decomposition.

import { describe, expect, it } from 'bun:test'

import {
  TOOL_OUTPUT_LIMITS,
  VERBOSE_TOOL_NAMES,
  simplifyVerboseToolResults,
} from '../simplify-tool-results'

import type { JSONValue } from '@savant-code/common/types/json'

describe('simplifyVerboseToolResults (P2c pre-pass)', () => {
  it('truncates the JSON part of a verbose tool message', () => {
    const content = [
      {
        type: 'json' as const,
        value: {
          matches: Array.from(
            { length: TOOL_OUTPUT_LIMITS.maxLines + 10 },
            (_, i) => `file${i}.ts:${i}\n`,
          ).join(''),
        },
      },
    ]
    const result = simplifyVerboseToolResults({ messageContent: content })
    expect(result).not.toBe(content) // changed -> new array
    expect(result[0].type).toBe('json')
    const value = result[0] as { value: Record<string, JSONValue> }
    expect(value.value.truncated).toBeDefined()
  })

  it('returns the original content by reference when no truncation needed', () => {
    const content = [{ type: 'json' as const, value: { ok: true } }]
    const result = simplifyVerboseToolResults({ messageContent: content })
    expect(result).toBe(content)
  })

  it('covers the documented verbose tool set', () => {
    for (const name of [
      'code_search',
      'glob',
      'list_directory',
      'find_files',
      'read_subtree',
      'read_url',
      'web_search',
      'gravity_index',
      'read_docs',
      'run_readonly_command',
    ]) {
      expect(VERBOSE_TOOL_NAMES.has(name)).toBe(true)
    }
  })
})
