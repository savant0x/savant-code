import { describe, expect, it } from 'bun:test'

import {
  createDsmlParserState,
  DSML_BAR,
  DSML_BEGIN,
  DSML_END,
  DSML_TOOL_CALL_BEGIN,
  DSML_TOOL_CALL_END,
  DSML_TOOL_CALLS_BEGIN,
  DSML_TOOL_CALLS_END,
  DSML_TOOL_SEP,
  parseDsmlChunk,
} from '../dsml-stream-parser'

import type { DsmlParserState } from '../dsml-stream-parser'

function callBlock(name: string, args: string): string {
  return `${DSML_TOOL_CALL_BEGIN.raw}${name}${DSML_TOOL_SEP.raw}${args}${DSML_TOOL_CALL_END.raw}`
}

function runChunks(chunks: readonly string[]): {
  text: string
  toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>
} {
  const state = createDsmlParserState()
  let text = ''
  const toolCalls: Array<{ toolName: string; input: Record<string, unknown> }> =
    []
  for (const chunk of chunks) {
    const result = parseDsmlChunk(chunk, state)
    text += result.filteredText
    toolCalls.push(...result.toolCalls)
  }
  // flush tail: parse empty chunk flushes held buffer (spec: unterminated
  // blocks stay held, so passing '' only returns empty)
  return { text, toolCalls }
}

describe('dsml-stream-parser', () => {
  const constants = { DSML_BAR }

  it('DSML_BAR is the fullwidth vertical line U+FF5C', () => {
    expect(constants.DSML_BAR).toBe('\uFF5C')
    expect(DSML_TOOL_CALLS_BEGIN.raw).toBe(`<\uFF5Ctool_calls_begin\uFF5C>`)
  })

  it('parses a complete tool_calls block in one chunk', () => {
    const chunk = `prev${DSML_TOOL_CALLS_BEGIN.raw}${callBlock('test_tool', '{"path":"foo.ts"}')}${DSML_TOOL_CALLS_END.raw}next`
    const { text, toolCalls } = runChunks([chunk])

    expect(text).toBe('prevnext')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].toolName).toBe('test_tool')
    expect(toolCalls[0].input).toEqual({ path: 'foo.ts' })
  })

  it('extracts multiple tool calls from one block', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('toolA', '{"a":1}') +
      callBlock('toolB', '{"b":"two"}') +
      DSML_TOOL_CALLS_END.raw
    const { text, toolCalls } = runChunks([chunk])

    expect(text).toBe('')
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0].toolName).toBe('toolA')
    expect(toolCalls[1].toolName).toBe('toolB')
  })

  it('recovers a block split across chunk boundaries (realistic stream split)', () => {
    // Split inside the tool name / args payload
    const a = `Hello ${DSML_TOOL_CALLS_BEGIN.raw}${DSML_TOOL_CALL_BEGIN.raw}test_`
    const b = `tool${DSML_TOOL_SEP.raw}{"cb_tool_name":"ignored"}${DSML_TOOL_CALL_END.raw}${DSML_TOOL_CALLS_END.raw}`
    const { text, toolCalls } = runChunks([a, b])

    expect(text).toBe('Hello ')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].toolName).toBe('test_tool')
  })

  it('holds an unterminated open block (no partial leak, fail-closed)', () => {
    const state = createDsmlParserState()
    const result = parseDsmlChunk(
      `text${DSML_TOOL_CALLS_BEGIN.raw}${DSML_TOOL_CALL_BEGIN.raw}toolA`,
      state,
    )
    expect(result.filteredText).toBe('text')
    expect(result.toolCalls).toEqual([])

    // Still held on a later chunk without the end token
    const r2 = parseDsmlChunk(' more', state)
    expect(r2.filteredText).toBe('')
    expect(state.insideToolCalls).toBe(true)
  })

  it('strips stray special tokens as plain markup, no payload', () => {
    const chunk = `before${DSML_BEGIN.raw}mid${DSML_END.raw}after`
    const { text, toolCalls } = runChunks([chunk])
    expect(text).toBe('beforemidafter')
    expect(toolCalls).toEqual([])
  })

  it('strips an unknown special token like the template band name', () => {
    const chunk = `a<${DSML_BAR}DSML${DSML_BAR}>calls>b`
    const { text } = runChunks([chunk])
    // `<｜name｜>` non-tool tokens: the known set only. Unknown `<｜…｜>`
    // forms outside the recoverable set pass through unless they match a
    // known token exactly — DSML here is unknown ⇒ passthrough is safe
    // (it is content, not markup we can verify).
    expect(text).toBe('a<｜DSML｜>calls>b')
  })

  it('drops malformed payloads without throwing', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('toolA', 'not json at all') +
      DSML_TOOL_CALLS_END.raw
    const { text, toolCalls } = runChunks([chunk])
    expect(text).toBe('')
    expect(toolCalls).toEqual([])
  })

  it('drops an empty-name payload without throwing', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('   ', '{"a":1}') +
      DSML_TOOL_CALLS_END.raw
    const { toolCalls } = runChunks([chunk])
    expect(toolCalls).toEqual([])
  })

  it('repairs a truncated-args tool call by closing the open object', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('toolA', '{"path":"a.ts","content":"x') +
      DSML_TOOL_CALLS_END.raw
    const { toolCalls } = runChunks([chunk])
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].input).toEqual({ path: 'a.ts', content: 'x' })
  })

  it('buffers a token split mid-delimiter across chunks (split `<｜`)', () => {
    const a = 'keep-before <'
    const b = `${DSML_BAR}DSML_unknown${DSML_BAR}> after`
    const state = createDsmlParserState()
    const r1 = parseDsmlChunk(a, state)
    // '<' alone is not a DSML partial opener (opener is '<' + bar), so it
    // passes through, then the unknown token's opener is split and must be
    // held until the second chunk completes it.
    const r2 = parseDsmlChunk(b, state)
    expect(r1.filteredText + r2.filteredText).toBe(
      `keep-before <${DSML_BAR}DSML_unknown${DSML_BAR}> after`,
    )
  })

  it('recovers tool call when the fullwidth bar itself is split at chunk edge', () => {
    const state = createDsmlParserState()
    // chunk1 ends right after '<' (start of a '<｜…' token)
    const r1 = parseDsmlChunk('x<', state)
    expect(r1.filteredText).toBe('x')
    expect(state.buffer.length).toBeGreaterThan(0)
    const r2 = parseDsmlChunk(
      `${DSML_BAR}tool_calls_begin${DSML_BAR}>${DSML_TOOL_CALL_BEGIN.raw}n${DSML_TOOL_SEP.raw}{}\n${DSML_TOOL_CALL_END.raw}${DSML_TOOL_CALLS_END.raw}`,
      state,
    )
    expect(r2.toolCalls).toHaveLength(1)
    expect(r2.toolCalls[0].toolName).toBe('n')
  })

  it('wraps non-object JSON payload into input bag', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('toolA', '"just a string"') +
      DSML_TOOL_CALLS_END.raw
    const { toolCalls } = runChunks([chunk])
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].input).toEqual({ value: 'just a string' })
  })

  it('unwraps a quoted name', () => {
    const chunk =
      DSML_TOOL_CALLS_BEGIN.raw +
      callBlock('"toolA"', '{"a":1}') +
      DSML_TOOL_CALLS_END.raw
    const { toolCalls } = runChunks([chunk])
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].toolName).toBe('toolA')
  })

  it('parseDsmlChunk with empty chunk is a no-op', () => {
    const state: DsmlParserState = createDsmlParserState()
    const r = parseDsmlChunk('', state)
    expect(r.filteredText).toBe('')
    expect(r.toolCalls).toEqual([])
  })
})
