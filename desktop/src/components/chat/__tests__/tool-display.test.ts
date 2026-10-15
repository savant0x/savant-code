// FID-2026-0901-006 P14 — design-language pass regression tests.
//
// Locks the CLI-parity contracts of the tool display helpers:
// - toolDisplayName mirrors getToolDisplayInfo (Title-Case + override)
// - toolCollapsedPreview mirrors the CLI's per-tool collapsed previews
//   ($ command, Create/Write path (N lines), last output line, …)

import { describe, expect, test } from 'bun:test'

import {
  setOutputPayloadJson,
  toolCollapsedPreview,
  toolDisplayName,
} from '../tool-display'

describe('toolDisplayName', () => {
  test('Title-Cases snake_case tool names (CLI getToolDisplayInfo)', () => {
    expect(toolDisplayName('read_files')).toBe('Read Files')
    expect(toolDisplayName('run_terminal_command')).toBe('Run Terminal Command')
    expect(toolDisplayName('str_replace')).toBe('Str Replace')
  })

  test('applies the CLI list_directory override', () => {
    expect(toolDisplayName('list_directory')).toBe('List Directories')
  })
})

describe('toolCollapsedPreview', () => {
  test('terminal commands preview as $ command', () => {
    expect(
      toolCollapsedPreview(
        'run_terminal_command',
        JSON.stringify({ command: 'bun test src/' }),
        null,
      ),
    ).toBe('$ bun test src/')
  })

  test('write_file previews as Create|Write path (N lines)', () => {
    // Create vs Write resolves from the result message (CLI isCreateFile).
    expect(
      toolCollapsedPreview(
        'write_file',
        JSON.stringify({ path: 'a/b.ts', content: 'x\ny\nz' }),
        null,
      ),
    ).toBe('Write a/b.ts (3 lines)')
    expect(
      toolCollapsedPreview(
        'write_file',
        JSON.stringify({ path: 'new.md', content: '# hi' }),
        'Created file successfully: new.md',
      ),
    ).toBe('Create new.md (1 lines)')
  })

  test('prefers the last non-empty output line (CLI finished preview)', () => {
    expect(
      toolCollapsedPreview(
        'code_search',
        JSON.stringify({ pattern: 'foo' }),
        '  file-a.ts:12\n  file-b.ts:40\n  file-c.ts:77',
      ),
    ).toBe('file-c.ts:77')
  })

  test('falls back to meaningful input keys when no output', () => {
    expect(
      toolCollapsedPreview(
        'read_files',
        JSON.stringify({ paths: ['a.ts', 'b.ts'] }),
        null,
      ),
    ).toBe('a.ts, b.ts')
    expect(
      toolCollapsedPreview(
        'code_search',
        JSON.stringify({ pattern: 'foo\\.bar' }),
        null,
      ),
    ).toBe('foo\\.bar')
  })

  test('returns null for unrenderable input (Law 14 fail-safe)', () => {
    expect(toolCollapsedPreview('read_files', null, null)).toBeNull()
    expect(toolCollapsedPreview('read_files', 'not-json{', null)).toBeNull()
  })

  test('defers structured tools to their dedicated previews (P17)', () => {
    // sequentialthinking / write_todos / suggest_followups own a dedicated
    // preview (💭 Thought N/M, N/M todos). The generic output-last-line read
    // would return a bare `}` from their JSON result, so it must return null.
    expect(
      toolCollapsedPreview(
        'sequentialthinking',
        JSON.stringify({ thought: 'weigh options' }),
        '{"thoughtNumber":1}',
      ),
    ).toBeNull()
    expect(
      toolCollapsedPreview(
        'write_todos',
        JSON.stringify([{ task: 'a', completed: true }]),
        '{}',
      ),
    ).toBeNull()
    expect(
      toolCollapsedPreview(
        'suggest_followups',
        JSON.stringify({ followups: [] }),
        '{}',
      ),
    ).toBeNull()
  })
})

describe('toolCollapsedPreview — apply_patch and set_output (FID-2026-1013-013 W4-2)', () => {
  test('apply_patch previews the nested operation as Patch|Create|Delete <path>', () => {
    expect(
      toolCollapsedPreview(
        'apply_patch',
        JSON.stringify({
          operation: { type: 'update_file', path: 'lib/fib.py', diff: '@@' },
        }),
        '{}',
      ),
    ).toBe('Patch lib/fib.py')
    expect(
      toolCollapsedPreview(
        'apply_patch',
        JSON.stringify({
          operation: { type: 'create_file', path: 'hello.txt', diff: '@@\n+x' },
        }),
        '{}',
      ),
    ).toBe('Create hello.txt')
    // delete_file carries no diff but must still render an informative header.
    expect(
      toolCollapsedPreview(
        'apply_patch',
        JSON.stringify({ operation: { type: 'delete_file', path: 'gone.ts' } }),
        '{"message":"deleted"}',
      ),
    ).toBe('Delete gone.ts')
  })

  test('apply_patch flat legacy shape still previews a bare Patch', () => {
    expect(
      toolCollapsedPreview(
        'apply_patch',
        JSON.stringify({ patch: '@@\n+x' }),
        '{}',
      ),
    ).toBe('Patch')
  })

  test('set_output previews its message or payload instead of a bare }', () => {
    expect(
      toolCollapsedPreview(
        'set_output',
        JSON.stringify({ data: { message: 'indexed 42 files' } }),
        '{\n  "ok": true\n}',
      ),
    ).toBe('indexed 42 files')
    expect(
      toolCollapsedPreview(
        'set_output',
        JSON.stringify({ message: 'top-level summary' }),
        '\n}',
      ),
    ).toBe('top-level summary')
  })

  test('set_output payload without a message renders compact JSON', () => {
    expect(
      toolCollapsedPreview(
        'set_output',
        JSON.stringify({ data: { ok: true, count: 2 } }),
        '}',
      ),
    ).toBe('{"ok":true,"count":2}')
    expect(
      toolCollapsedPreview(
        'set_output',
        JSON.stringify({ data: 'plain text payload' }),
        '}',
      ),
    ).toBe('plain text payload')
    expect(
      toolCollapsedPreview('set_output', JSON.stringify({ data: 7 }), '}'),
    ).toBe('7')
  })

  test('setOutputPayloadJson unwraps the data envelope for the card body', () => {
    expect(setOutputPayloadJson(JSON.stringify({ data: { ok: true } }))).toBe(
      '{\n  "ok": true\n}',
    )
    expect(setOutputPayloadJson(JSON.stringify({ a: 1 }))).toBe(
      '{\n  "a": 1\n}',
    )
    expect(setOutputPayloadJson('not-json{')).toBeNull()
    expect(setOutputPayloadJson(null)).toBeNull()
  })
})
