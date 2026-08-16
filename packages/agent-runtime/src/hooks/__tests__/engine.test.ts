/**
 * FID-2026-0814-003 — hook engine tests: event/matcher selection, dedupe,
 * block aggregation, and the fail-open contract. Also exercises the cached
 * `getHookEngine` factory against a real `protocol.config.yaml` in a temp cwd.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { HookEngine, buildHookInput, getHookEngine } from '../engine'

describe('HookEngine — selection & dedupe', () => {
  test('filters by event and tool-name regex matcher', () => {
    const engine = new HookEngine([
      { event: 'PreToolUse', matcher: 'write_file', command: 'a' },
      { event: 'PreToolUse', matcher: 'str_replace', command: 'b' },
      { event: 'PostToolUse', command: 'c' },
    ])
    expect(engine.getHooksFor('PreToolUse', 'write_file')).toHaveLength(1)
    expect(engine.getHooksFor('PreToolUse', 'str_replace')[0].command).toBe('b')
    expect(engine.getHooksFor('PreToolUse', 'read_files')).toHaveLength(0)
    expect(engine.getHooksFor('PostToolUse', 'write_file')).toHaveLength(1)
  })

  test('a matcher without a tool name matches all tools for that event', () => {
    const engine = new HookEngine([{ event: 'PreToolUse', command: 'a' }])
    expect(engine.getHooksFor('PreToolUse', 'anything')).toHaveLength(1)
  })

  test('dedupes identical (cwd + command) declarations within one trigger', async () => {
    const engine = new HookEngine([
      { event: 'PreToolUse', command: 'missing-binary-a', cwd: '/x' },
      { event: 'PostToolUse', command: 'missing-binary-a', cwd: '/x' },
      { event: 'PreToolUse', command: 'missing-binary-a', cwd: '/x' },
    ])
    // The same command declared for a DIFFERENT event still fires for that
    // event; duplicates within one event are collapsed at trigger time.
    expect(engine.getHooksFor('PreToolUse', 'tool')).toHaveLength(2)
    expect(engine.getHooksFor('PostToolUse', 'tool')).toHaveLength(1)

    const pre = await engine.triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: 's',
        cwd: process.cwd(),
        toolName: 'tool',
      }),
    )
    // Two declared PreToolUse hooks share (cwd + command) → one run.
    expect(pre.runs).toHaveLength(1)
  })

  test('an invalid matcher regex never matches (fail-safe)', () => {
    const engine = new HookEngine([
      { event: 'PreToolUse', matcher: '(', command: 'a' },
    ])
    expect(engine.getHooksFor('PreToolUse', 'write_file')).toHaveLength(0)
  })
})

describe('HookEngine — aggregation & fail-open', () => {
  test('one block among many blocks the action', async () => {
    const engine = new HookEngine([
      { event: 'PreToolUse', command: 'missing-binary-xyz' }, // fail-open
      {
        event: 'PreToolUse',
        command: `"${process.execPath}" "${path.join(import.meta.dir, 'fixtures', 'exit-2.ts')}"`,
      },
    ])
    const result = await engine.triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: 's',
        cwd: process.cwd(),
        toolName: 'write_file',
      }),
    )
    expect(result.blocked).toBe(true)
    expect(result.reasons.length).toBe(1)
  })

  test('all fail-open hooks → allowed, no throw', async () => {
    const engine = new HookEngine([
      { event: 'PreToolUse', command: 'missing-binary-xyz' },
    ])
    const result = await engine.triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: 's',
        cwd: process.cwd(),
        toolName: 'write_file',
      }),
    )
    expect(result.blocked).toBe(false)
    expect(result.runs[0].spawnError).toBeDefined()
  })

  test('no matching hooks → immediate allow', async () => {
    const engine = new HookEngine([{ event: 'PostToolUse', command: 'x' }])
    const result = await engine.triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: 's',
        cwd: process.cwd(),
      }),
    )
    expect(result.blocked).toBe(false)
    expect(result.runs).toHaveLength(0)
  })

  test('fireAndForgetTrigger never throws for a missing binary', () => {
    const engine = new HookEngine([
      { event: 'SessionStart', command: 'missing-binary-xyz' },
    ])
    // fire-and-forget is synchronous (returns void) and swallows hook errors.
    expect(
      engine.fireAndForgetTrigger(
        buildHookInput({
          event: 'SessionStart',
          sessionId: 's',
          cwd: process.cwd(),
        }),
      ),
    ).toBeUndefined()
  })
})

describe('getHookEngine — config-driven factory', () => {
  test('reads hooks from protocol.config.yaml and refreshes on demand', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-engine-'))
    try {
      fs.mkdirSync(path.join(cwd, 'dev', 'fids'), { recursive: true })
      fs.writeFileSync(
        path.join(cwd, 'protocol.config.yaml'),
        [
          'hooks:',
          '  - event: PreToolUse',
          '    matcher: write_file',
          '    command: missing-binary-xyz',
          '',
        ].join('\n'),
      )
      const engine = getHookEngine(cwd, { refresh: true })
      expect(engine.getHooksFor('PreToolUse', 'write_file')).toHaveLength(1)
      expect(engine.getHooksFor('PreToolUse', 'read_files')).toHaveLength(0)

      // Re-writing the config and refreshing re-reads it.
      fs.writeFileSync(path.join(cwd, 'protocol.config.yaml'), '')
      const refreshed = getHookEngine(cwd, { refresh: true })
      expect(refreshed.getHooksFor('PreToolUse', 'write_file')).toHaveLength(0)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
})
