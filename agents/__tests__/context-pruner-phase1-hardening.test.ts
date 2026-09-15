/**
 * FID-2026-0914-002 — context-pruner deterministic-writer hardening (RED).
 *
 * Pins the five artifact failure classes at the source modules (the source
 * of truth for the generated `04-context-pruner.ts`, which is never
 * hand-edited): assistant-turn coalescing, resume-spam coalescing,
 * placeholder-aware digests, no error-replay section in the structured
 * block, repo-relative preserved-state paths, and the recency-capped path
 * lists. Also pins the protocol-dump guard on the first-user-turn pin.
 */
import { describe, expect, test } from 'bun:test'

import { assistantMsg, toolMsg, userMsg } from './context-pruner-test-fixtures'
import {
  buildPreservedState,
  normalizePathForState,
} from '../context-pruner/preserved-state'
import { buildResultDigest } from '../context-pruner/result-digests'
import {
  buildStructuredSummary,
  findFirstUserTurnText,
} from '../context-pruner/structured-summary'
import { summarizeMessages } from '../context-pruner/summarize-messages'

import type { Message } from '../types/util-types'

const PROJECT_ROOT = 'C:\\Users\\spenc\\dev\\savant-code'

describe('assistant-turn coalescing (fragment-storm fix)', () => {
  test('N consecutive assistant messages coalesce into ONE Progress note entry', () => {
    // Fragments are trimmed per message-part by the summarizer's
    // text-part extraction, so the fixture avoids leading/trailing spaces.
    const fragments = ['Hel', 'lo w', 'orld', '— d', 'one.']
    const messages: Message[] = fragments.map((text) => assistantMsg(text))
    const { entries } = summarizeMessages(messages, null)
    const progressNotes = entries.filter((entry) =>
      entry.parts.some((part) => part.startsWith('Progress note:')),
    )
    expect(progressNotes).toHaveLength(1)
    const joined = progressNotes[0].parts.join('\n')
    for (const fragment of fragments) {
      expect(joined).toContain(fragment)
    }
  })

  test('tool-carrying assistant turns still keep their tool summaries distinct', () => {
    const messages: Message[] = [
      assistantMsg('part one'),
      assistantMsg('part two', [
        { toolName: 'read_files', input: { paths: ['src/a.ts'] } },
      ]),
    ]
    const { entries } = summarizeMessages(messages, null)
    const progressNotes = entries.filter((entry) =>
      entry.parts.some((part) => part.startsWith('Progress note:')),
    )
    expect(progressNotes).toHaveLength(1)
    // summarizeToolCall renders read_files as "inspected files: <paths>".
    expect(progressNotes[0].parts.join('\n')).toContain('inspected files:')
  })
})

describe('resume-spam coalescing (MQ3: ×N marker)', () => {
  test('consecutive identical user messages coalesce into one (×N) entry', () => {
    // A distinct turn precedes the run: the (×N) suffix makes the FIRST
    // entry's text differ from a later raw repeat, so the run must be
    // interior to exercise the suffix-stripped comparison honestly.
    const messages: Message[] = [
      userMsg('start the work'),
      userMsg('resume'),
      userMsg('resume'),
      userMsg('resume'),
      userMsg('resume'),
      userMsg('resume'),
      userMsg('resume'),
    ]
    const { entries } = summarizeMessages(messages, null)
    const userEntries = entries.filter((entry) => entry.role === 'user')
    // One entry for the distinct prefix turn + ONE coalesced run entry.
    expect(userEntries).toHaveLength(2)
    expect(userEntries[1].parts[0]).toContain('resume')
    expect(userEntries[1].parts[0]).toContain('(×6)')
  })

  test('different user messages never coalesce', () => {
    const messages: Message[] = [userMsg('resume'), userMsg('now do X')]
    const { entries } = summarizeMessages(messages, null)
    const userEntries = entries.filter((entry) => entry.role === 'user')
    expect(userEntries).toHaveLength(2)
  })
})

describe('placeholder-aware digests (re-digest fix)', () => {
  test('[compacted] sentinel tool results produce NO digest', () => {
    const digest = buildResultDigest('run_terminal_command', [
      { type: 'json', value: '[compacted]' },
    ])
    expect(digest).toBeNull()
  })

  test('micro-compact JSON placeholders produce NO digest', () => {
    const digest = buildResultDigest('run_terminal_command', [
      {
        type: 'json',
        value: { compacted: true, command: 'bun test', exitCode: 0 },
      },
    ])
    expect(digest).toBeNull()
  })

  test('real tool results still digest (preservation contract intact)', () => {
    const digest = buildResultDigest('find_files', [
      { type: 'json', value: { path: 'src/x.ts' } },
    ])
    expect(digest).not.toBeNull()
    expect(digest).toContain('[digest]')
  })

  test('summarizeMessages skips placeholder tool results entirely', () => {
    const messages: Message[] = [
      toolMsg('run_terminal_command', '[compacted]'),
      toolMsg('run_readonly_command', {
        compacted: true,
        command: 'grep -n foo src/a.ts',
        exitCode: 0,
      }),
    ]
    const { entries } = summarizeMessages(messages, null)
    const serialized = JSON.stringify(entries)
    expect(serialized).not.toContain('[digest]')
  })
})

describe('no error-replay section in the structured block', () => {
  test('the structured block never carries a dedicated error-log section', () => {
    const messages: Message[] = [
      toolMsg('run_terminal_command', {
        errorMessage: 'spawn failed',
        exitCode: 1,
      }),
      assistantMsg('Tried to run the build'),
    ]
    const block = buildStructuredSummary({
      messages,
      goalText: 'Fix the build',
      preservedState: buildPreservedState(messages),
    })
    expect(block).not.toMatch(/^## Error/i)
    expect(block).not.toContain('## Error-log')
  })
})

describe('repo-relative preserved-state paths', () => {
  test('normalizePathForState converts absolute paths under the project root to repo-relative', () => {
    expect(
      normalizePathForState(
        'C:\\Users\\spenc\\dev\\savant-code\\src\\auth.ts',
        PROJECT_ROOT,
      ),
    ).toBe('src/auth.ts')
    expect(normalizePathForState('src/b.ts', PROJECT_ROOT)).toBe('src/b.ts')
    expect(
      normalizePathForState('C:\\Users\\spenc\\elsewhere\\x.ts', PROJECT_ROOT),
    ).toBe('C:/Users/spenc/elsewhere/x.ts')
  })

  test('buildPreservedState normalizes absolute paths to repo-relative', () => {
    const messages: Message[] = [
      assistantMsg('', [
        {
          toolName: 'read_files',
          input: {
            paths: [
              'C:\\Users\\spenc\\dev\\savant-code\\src\\auth.ts',
              'src/b.ts',
            ],
          },
        },
        {
          toolName: 'str_replace',
          input: { path: 'C:\\Users\\spenc\\dev\\savant-code\\src\\c.ts' },
        },
      ]),
    ]
    const state = buildPreservedState(messages, PROJECT_ROOT)
    expect(state.readFiles).toEqual(['src/auth.ts', 'src/b.ts'])
    expect(state.modifiedFiles).toEqual(['src/c.ts'])
  })

  test('without a project root, paths are still forward-slashed (never absolute Windows noise in new entries)', () => {
    expect(normalizePathForState('a\\b\\c.ts')).toBe('a/b/c.ts')
  })
})

describe('recency-capped path lists (12, newest kept)', () => {
  test('30 read_files calls collapse to the 12 most recent paths', () => {
    const messages: Message[] = []
    for (let i = 0; i < 30; i++) {
      messages.push(
        assistantMsg('', [
          { toolName: 'read_files', input: { paths: [`src/file-${i}.ts`] } },
        ]),
      )
    }
    const state = buildPreservedState(messages)
    expect(state.readFiles).toHaveLength(12)
    // Recency bias: the OLDEST paths are dropped, the newest survive.
    expect(state.readFiles[0]).toBe('src/file-18.ts')
    expect(state.readFiles[11]).toBe('src/file-29.ts')
  })
})

describe('first-user-turn pin skips protocol dumps', () => {
  test('a system/protocol dump as the first turn is skipped in favor of the operator-authored turn', () => {
    const dump = [
      '<system><compaction-notice layer="auto">Earlier tool responses were compacted.</compaction-notice></system>',
      '<system><!--echo-critical-->',
      '# ECHO Protocol (condensed refresh)',
      '```',
      'bun run typecheck',
      '```',
      '</system>',
    ].join('\n')
    const messages: Message[] = [
      userMsg(dump),
      userMsg('i want to add this provider and review my system'),
    ]
    expect(findFirstUserTurnText(messages)).toBe(
      'i want to add this provider and review my system',
    )
  })

  test('a normal operator first turn is still pinned verbatim', () => {
    expect(findFirstUserTurnText([userMsg('fix the login bug')])).toBe(
      'fix the login bug',
    )
  })

  test('a history with ONLY protocol dumps pins nothing rather than pinning infrastructure', () => {
    // Same full dump shape as the skip test (the detector requires harness
    // system markers plus an infrastructure-dense body over 120 chars).
    const dump = [
      '<system><compaction-notice layer="auto">Earlier tool responses were compacted.</compaction-notice></system>',
      '<system><!--echo-critical-->',
      '# ECHO Protocol (condensed refresh)',
      '```',
      'bun run typecheck',
      '```',
      '</system>',
    ].join('\n')
    expect(findFirstUserTurnText([userMsg(dump)])).toBeNull()
  })
})
