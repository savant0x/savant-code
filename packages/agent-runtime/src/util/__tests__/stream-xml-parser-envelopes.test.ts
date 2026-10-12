// FID-2026-1012-002: envelope recognition pins. Sibling of
// `stream-xml-parser.test.ts` (split when that suite crossed the 300-line
// ceiling). A near-miss envelope is still protocol markup and must never reach
// the user: an observed `<SAVANT_TOOL_CALL>` block was rendered as raw JSON with
// its `cb_tool_name` argument intact, because the parser recognized only the
// canonical tag and one legacy name.
import { describe, expect, it } from 'bun:test'

import { createStreamParserState, parseStreamChunk } from '../stream-xml-parser'

describe('stream-xml-parser — envelope recognition (FID-2026-1012-002)', () => {
  it('should parse a case-variant alias envelope as the canonical call', () => {
    const result = parseStreamChunk(
      '<SAVANT_TOOL_CALL>\n{"cb_tool_name": "read_files", "paths": ["a.ts"]}\n</SAVANT_TOOL_CALL>',
      createStreamParserState(),
    )

    expect(result.toolCalls).toEqual([
      { toolName: 'read_files', input: { paths: ['a.ts'] } },
    ])
    expect(result.filteredText).not.toContain('cb_tool_name')
    expect(result.filteredText).toBe('')
  })

  it('should parse the legacy savant_tool_call prefix as the canonical call', () => {
    const result = parseStreamChunk(
      '<savant_tool_call>\n{"cb_tool_name": "code_search", "pattern": "x"}\n</savant_tool_call>',
      createStreamParserState(),
    )

    expect(result.toolCalls).toEqual([
      { toolName: 'code_search', input: { pattern: 'x' } },
    ])
    expect(result.filteredText).not.toContain('cb_tool_name')
  })

  it('should keep the text around a normalized alias envelope', () => {
    const result = parseStreamChunk(
      'before <SAVANT_TOOL_CALL>{"cb_tool_name": "code_search", "pattern": "y"}</SAVANT_TOOL_CALL> after',
      createStreamParserState(),
    )

    expect(result.toolCalls).toEqual([
      { toolName: 'code_search', input: { pattern: 'y' } },
    ])
    expect(result.filteredText).toBe('before  after')
  })

  it('should suppress an unrecognized tool-call envelope instead of leaking it', () => {
    const result = parseStreamChunk(
      '<some_new_tool_call>\n{"cb_tool_name": "write_file", "path": "x.ts"}\n</some_new_tool_call>\nafter',
      createStreamParserState(),
    )

    expect(result.filteredText).not.toContain('cb_tool_name')
    expect(result.filteredText).not.toContain('some_new_tool_call')
    expect(result.filteredText).toContain('after')
    expect(result.toolCalls).toEqual([])
  })

  it('should suppress an unrecognized envelope split across chunks', () => {
    const state = createStreamParserState()
    const chunks = [
      '<SOME_',
      'TOOL_CALL>\n{"cb_tool_name": "write_file"}',
      '\n</SOME_TOOL_CALL>tail',
    ]
    const emitted: string[] = []

    for (const chunk of chunks) {
      emitted.push(parseStreamChunk(chunk, state).filteredText)
    }

    expect(emitted.join('')).toBe('tail')
    expect(emitted.join('')).not.toContain('cb_tool_name')
  })

  it('should not treat a prose mention of a tool call as markup', () => {
    const result = parseStreamChunk(
      'The model emitted a tool_call without the envelope.',
      createStreamParserState(),
    )

    expect(result.filteredText).toBe(
      'The model emitted a tool_call without the envelope.',
    )
    expect(result.toolCalls).toEqual([])
  })
})
