// FID-2026-0901-006 P15 — tool-card copy affordance tests (CLI parity).

import { describe, expect, test } from 'bun:test'

import { diffStats, toolCopyText, toolHasCopyButton } from '../tool-copy'

describe('toolHasCopyButton', () => {
  test('skips the CLI copy-skip tools', () => {
    expect(toolHasCopyButton('run_terminal_command')).toBe(false)
    expect(toolHasCopyButton('run_readonly_command')).toBe(false)
    expect(toolHasCopyButton('transition_phase')).toBe(false)
  })

  test('shows the copy button for ordinary tools', () => {
    expect(toolHasCopyButton('str_replace')).toBe(true)
    expect(toolHasCopyButton('read_files')).toBe(true)
    expect(toolHasCopyButton('write_file')).toBe(true)
  })
})

describe('toolCopyText', () => {
  test('mirrors the CLI [Tool: name] Input/Output format', () => {
    expect(toolCopyText('str_replace', '{"path":"a.ts"}', 'done')).toBe(
      '[Tool: str_replace]\nInput:\n{\n  "path": "a.ts"\n}\n\nOutput:\ndone',
    )
  })

  test('uses (no output)/(no input) placeholders like the CLI', () => {
    expect(toolCopyText('read_files', null, null)).toBe(
      '[Tool: read_files]\nInput:\n(no input)\n\nOutput:\n(no output)',
    )
  })

  test('falls back to raw text for non-JSON input (Law 14)', () => {
    expect(toolCopyText('read_files', 'not-json{', null)).toContain(
      'Input:\nnot-json{',
    )
  })
})

describe('diffStats', () => {
  test('counts added and removed lines', () => {
    expect(
      diffStats([
        {
          lines: [
            { type: 'add' },
            { type: 'add' },
            { type: 'del' },
            { type: 'ctx' },
          ],
        },
        { lines: [{ type: 'del' }] },
      ]),
    ).toEqual({ added: 2, removed: 2 })
  })

  test('empty diff is zeroed', () => {
    expect(diffStats([{ lines: [] }])).toEqual({ added: 0, removed: 0 })
  })
})
