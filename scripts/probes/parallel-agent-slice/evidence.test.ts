import { expect, test } from 'bun:test'

import {
  bindDraft,
  citationCatalog,
  validateEvidence,
  verifiedReadPaths,
} from './evidence'
import { draftSchema, handoffOf } from './types'
import { ASSIGNMENTS } from './workload'

import type { ArtifactDraft, Assignment } from './types'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const assignment: Assignment = {
  id: 'A',
  question: 'Inspect real evidence',
  files: ['a.ts'],
  dependsOn: [],
}
const sources = { 'a.ts': 'header\r\nconst first = 1\r\nconst second = 2\r\n' }
const draft: ArtifactDraft = {
  taskId: 'A',
  answer: 'Findings are provider-authored; metadata is host-owned.',
  citations: [{ ref: 'f1:l2' }, { ref: 'f1:l3' }],
  usedHandoffs: [],
}

test('host binds selected source references across CRLF and preserves findings', () => {
  const bound = bindDraft(draft, assignment, [], sources, ['a.ts'])
  expect(bound.citations.map((citation) => citation.line)).toEqual([2, 3])
  expect(bound.answer).toBe(draft.answer)
  expect(bound.citations.map((citation) => citation.quote)).toEqual([
    'const first = 1',
    'const second = 2',
  ])
  expect(validateEvidence(bound, assignment, [], sources, ['a.ts'])).toEqual([])
  const first = bound.citations[0]
  if (!first) throw new Error('Missing test citation')
  first.line = 1
  expect(validateEvidence(bound, assignment, [], sources, ['a.ts'])).toContain(
    'Unresolved quotation: a.ts:1',
  )
})

test('unknown, duplicate and unread references fail closed', () => {
  expect(() =>
    bindDraft(
      { ...draft, citations: [{ ref: 'f9:l999' }, { ref: 'f1:l2' }] },
      assignment,
      [],
      sources,
      ['a.ts'],
    ),
  ).toThrow('Unknown citation reference')
  expect(() =>
    bindDraft(
      { ...draft, citations: [{ ref: 'f1:l2' }, { ref: 'f1:l2' }] },
      assignment,
      [],
      sources,
      ['a.ts'],
    ),
  ).toThrow('Duplicate citation reference')
  expect(() => bindDraft(draft, assignment, [], sources, [])).toThrow(
    'without observed read',
  )
  const bound = bindDraft(draft, assignment, [], sources, ['a.ts'])
  expect(
    validateEvidence(bound, { ...assignment, files: [] }, [], sources, [
      'a.ts',
    ]),
  ).toContain('Unassigned citation: a.ts')
  expect(
    validateEvidence(bound, assignment, [], { 'a.ts': 'altered' }, ['a.ts']),
  ).toContain('Unresolved quotation: a.ts:2')
})

test('repeated source text has distinct explicit line identities', () => {
  const repeated = { 'a.ts': 'header\nconst repeated = 1\nconst repeated = 1' }
  const bound = bindDraft(draft, assignment, [], repeated, ['a.ts'])
  expect(bound.citations.map((citation) => citation.line)).toEqual([2, 3])
  expect(validateEvidence(bound, assignment, [], repeated, ['a.ts'])).toEqual(
    [],
  )
  expect(
    citationCatalog(assignment, repeated).map((entry) => entry.ref),
  ).toEqual(['f1:l2', 'f1:l3'])
})

test('predecessor metadata comes only from supplied handoffs', () => {
  const predecessor = handoffOf(
    bindDraft(draft, assignment, [], sources, ['a.ts']),
  )
  const next = { ...assignment, id: 'C', dependsOn: ['A'] }
  const followup: ArtifactDraft = {
    ...draft,
    taskId: 'C',
    usedHandoffs: [
      { taskId: 'A', finding: 'I used the actual first finding.' },
    ],
  }
  const bound = bindDraft(followup, next, [predecessor], sources, ['a.ts'])
  expect(bound.usedHandoffs[0]?.digest).toBe(predecessor.digest)
  expect(bound.usedHandoffs[0]?.finding).toBe(followup.usedHandoffs[0]?.finding)
  expect(() =>
    bindDraft({ ...followup, usedHandoffs: [] }, next, [predecessor], sources, [
      'a.ts',
    ]),
  ).toThrow('Missing exact handoff A')
  expect(() =>
    bindDraft(
      {
        ...followup,
        usedHandoffs: [{ taskId: 'X', finding: 'I invented a predecessor.' }],
      },
      next,
      [predecessor],
      sources,
      ['a.ts'],
    ),
  ).toThrow('Unknown handoff X')
  expect(() =>
    bindDraft(
      {
        ...followup,
        usedHandoffs: [...followup.usedHandoffs, ...followup.usedHandoffs],
      },
      next,
      [predecessor],
      sources,
      ['a.ts'],
    ),
  ).toThrow('Duplicate handoff')
  const used = bound.usedHandoffs[0]
  if (!used) throw new Error('Missing test handoff')
  used.digest = 'tampered'
  expect(
    validateEvidence(bound, next, [predecessor], sources, ['a.ts']),
  ).toContain('Changed handoff A')
})

test('draft rejects model-authored identity metadata and wrong task IDs', () => {
  expect(
    draftSchema.safeParse({
      ...draft,
      citations: [{ ...draft.citations[0], line: 999 }, draft.citations[1]],
    }).success,
  ).toBe(false)
  expect(() =>
    bindDraft({ ...draft, taskId: 'other' }, assignment, [], sources, ['a.ts']),
  ).toThrow('Wrong task identity')
})

test('downstream investigation can read every transitive predecessor source', () => {
  for (const task of ASSIGNMENTS)
    for (const id of task.dependsOn) {
      const predecessor = ASSIGNMENTS.find((entry) => entry.id === id)
      if (!predecessor) throw new Error('Unknown test predecessor')
      for (const file of predecessor.files) expect(task.files).toContain(file)
    }
})

test('only successful source-matching read receipts count as observed reads', () => {
  const read: Message = {
    role: 'tool',
    toolName: 'read_files',
    toolCallId: 'actual-read',
    content: [
      {
        type: 'json',
        value: [
          {
            path: 'C:\\repo\\a.ts',
            content: sources['a.ts'].replaceAll('\r\n', '\n'),
          },
          { path: 'b.ts', content: 'partial' },
          { path: 'c.ts', error: 'File unavailable' },
        ],
      },
    ],
  }
  expect(
    verifiedReadPaths(
      [read],
      { ...sources, 'b.ts': 'complete source', 'c.ts': 'source' },
      'C:/repo',
    ),
  ).toEqual(['a.ts'])
  const attempted: Message = {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolName: 'read_files',
        toolCallId: 'attempt',
        input: { paths: ['a.ts'] },
      },
    ],
  }
  expect(verifiedReadPaths([attempted], sources, 'C:/repo')).toEqual([])
  expect(
    verifiedReadPaths(
      [{ ...read, toolName: 'other_tool' }],
      sources,
      'C:/repo',
    ),
  ).toEqual([])
})

test('uncited assigned files must also have verified read receipts', () => {
  const bound = bindDraft(draft, assignment, [], sources, ['a.ts'])
  expect(
    validateEvidence(
      bound,
      { ...assignment, files: ['a.ts', 'b.ts'] },
      [],
      sources,
      ['a.ts'],
    ),
  ).toContain('Missing verified source read: b.ts')
})
