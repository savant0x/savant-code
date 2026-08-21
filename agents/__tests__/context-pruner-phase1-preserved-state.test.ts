/** FID-2026-0806-003 Phase 1 — P1b preserved-state tests. */
import { describe, expect, test } from 'bun:test'

import { assistantMsg, userMsg } from './context-pruner-test-fixtures'
import {
  buildPreservedState,
  extractPreservedState,
  mergePreservedState,
  serializePreservedState,
} from '../context-pruner/preserved-state'

import type { Message } from '../types/util-types'

describe('buildPreservedState (P1b)', () => {
  test('latest write_todos call wins', () => {
    const messages: Message[] = [
      assistantMsg('', [
        {
          toolName: 'write_todos',
          input: { todos: [{ task: 'old task', completed: true }] },
        },
      ]),
      assistantMsg('', [
        {
          toolName: 'write_todos',
          input: {
            todos: [
              { task: 'new task', completed: false },
              { task: 'done task', completed: true },
            ],
          },
        },
      ]),
    ]
    const state = buildPreservedState(messages)
    expect(state.todos).toEqual([
      { task: 'new task', completed: false },
      { task: 'done task', completed: true },
    ])
  })

  test('extracts file ops from tool calls', () => {
    const messages: Message[] = [
      assistantMsg('', [
        {
          toolName: 'read_files',
          input: { paths: ['src/a.ts', 'src/b.ts', 'src/a.ts'] },
        },
        { toolName: 'write_file', input: { path: 'src/new.ts' } },
        { toolName: 'str_replace', input: { path: 'src/a.ts' } },
        { toolName: 'propose_write_file', input: { path: 'src/proposed.ts' } },
        { toolName: 'propose_str_replace', input: { path: 'src/b.ts' } },
        { toolName: 'read_subtree', input: { paths: ['src/components'] } },
      ]),
    ]
    const state = buildPreservedState(messages)
    expect(state.readFiles).toEqual(['src/a.ts', 'src/b.ts', 'src/components'])
    expect(state.createdFiles).toEqual(['src/new.ts', 'src/proposed.ts'])
    expect(state.modifiedFiles).toEqual(['src/a.ts', 'src/b.ts'])
  })

  test('extracts loaded skills', () => {
    const messages: Message[] = [
      assistantMsg('', [
        { toolName: 'skill', input: { name: 'coding-typescript' } },
      ]),
      assistantMsg('', [
        { toolName: 'skill', input: { name: 'release-workflow' } },
      ]),
    ]
    const state = buildPreservedState(messages)
    expect(state.skills).toEqual(['coding-typescript', 'release-workflow'])
  })

  test('extracts the most recent FID reference from message text', () => {
    const messages: Message[] = [
      userMsg('working on FID-2026-0805-001 and then FID-2026-0806-003'),
    ]
    const state = buildPreservedState(messages)
    expect(state.fid).toBe('FID-2026-0806-003')
  })

  test('applies hard caps', () => {
    const manyFiles = Array.from({ length: 40 }, (_, i) => `src/file${i}.ts`)
    const messages: Message[] = [
      assistantMsg('', [
        { toolName: 'read_files', input: { paths: manyFiles } },
      ]),
    ]
    const state = buildPreservedState(messages)
    expect(state.readFiles.length).toBe(25)
    expect(state.readFiles[0]).toBe('src/file0.ts')
  })
})

describe('serializePreservedState / extractPreservedState (P1b)', () => {
  test('round-trips through a single-line JSON block', () => {
    const messages: Message[] = [
      assistantMsg('', [
        {
          toolName: 'write_todos',
          input: { todos: [{ task: 't1', completed: false }] },
        },
        { toolName: 'write_file', input: { path: 'src/x.ts' } },
      ]),
    ]
    const state = buildPreservedState(messages)
    const json = serializePreservedState(state)
    expect(json).not.toContain('\n')
    expect(JSON.parse(json)).toEqual(state)
    expect(extractPreservedState(`## Preserved state\n${json}`)).toEqual(state)
  })

  test('extractPreservedState returns null when absent or malformed', () => {
    expect(extractPreservedState('no state here')).toBeNull()
    expect(extractPreservedState('## Preserved state\nnot json')).toBeNull()
  })

  test('serializePreservedState shrinks oversized states to fit the JSON cap', () => {
    const longSegment = 'very/long/path/to/module/with/many/segments/'.repeat(
      10,
    )
    const hugeFiles = Array.from(
      { length: 25 },
      (_, i) => `packages/${longSegment}file${i}.ts`,
    )
    const state = {
      todos: [{ task: 't', completed: false }],
      readFiles: hugeFiles,
      modifiedFiles: [],
      createdFiles: [],
      skills: [],
      fid: null,
    }
    const json = serializePreservedState(state)
    expect(json.length).toBeLessThanOrEqual(8_192)
    expect(JSON.parse(json)).not.toBeNull()
    expect(JSON.parse(json).readFiles.length).toBeLessThan(25)
  })
})

describe('mergePreservedState (P1b re-distill)', () => {
  test('newest todos win; file lists are unions, newest first', () => {
    const prev = {
      todos: [{ task: 'carried task', completed: false }],
      readFiles: ['src/old.ts'],
      modifiedFiles: [],
      createdFiles: [],
      skills: ['coding-go'],
      fid: 'FID-2026-0805-001',
    }
    const next = {
      todos: [],
      readFiles: ['src/new.ts'],
      modifiedFiles: [],
      createdFiles: [],
      skills: [],
      fid: null,
    }
    const merged = mergePreservedState(prev, next)
    expect(merged.todos).toEqual([{ task: 'carried task', completed: false }])
    expect(merged.readFiles).toEqual(['src/new.ts', 'src/old.ts'])
    expect(merged.skills).toEqual(['coding-go'])
    expect(merged.fid).toBe('FID-2026-0805-001')
  })

  test('null prev returns next unchanged', () => {
    const next = buildPreservedState([
      assistantMsg('', [{ toolName: 'skill', input: { name: 'coding-rust' } }]),
    ])
    expect(mergePreservedState(null, next)).toEqual(next)
  })
})
