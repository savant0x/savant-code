/** FID-2026-0806-003 Phase 1 — P1a/P1c structured-summary tests. */
import { describe, expect, test } from 'bun:test'

import { assistantMsg, toolMsg, userMsg } from './context-pruner-test-fixtures'
import {
  buildPreservedState,
  extractPreservedState,
} from '../context-pruner/preserved-state'
import {
  buildStructuredSummary,
  findFirstUserTurnText,
} from '../context-pruner/structured-summary'

import type { Message } from '../types/util-types'

describe('empty / degenerate inputs (P1a/P1b)', () => {
  test('buildPreservedState on empty history yields an empty state', () => {
    const state = buildPreservedState([])
    expect(state).toEqual({
      todos: [],
      readFiles: [],
      modifiedFiles: [],
      createdFiles: [],
      skills: [],
      fid: null,
    })
  })

  test('buildStructuredSummary on empty history emits every section with (none) markers', () => {
    const block = buildStructuredSummary({
      messages: [],
      goalText: null,
      preservedState: buildPreservedState([]),
    })
    expect(block).toContain('<structured_state>')
    expect(block).toContain('</structured_state>')
    expect(block).toContain('(none in this window)')
    expect(block).toContain('(none)')
  })

  test('buildStandingFacts dedupes the pinned first turn against raw text', () => {
    const text = 'Repeat this request verbatim'
    const messages: Message[] = [userMsg(text), userMsg(text)]
    const block = buildStructuredSummary({
      messages,
      goalText: text,
      preservedState: buildPreservedState(messages),
    })
    const standingSection = block.split('## Goal')[0]
    expect(standingSection.match(/Repeat this request verbatim/g)).toHaveLength(
      1,
    )
  })
})

// P1c — first user turn pin

describe('findFirstUserTurnText (P1c)', () => {
  test('returns the first real user turn, skipping harness messages and summaries', () => {
    const messages: Message[] = [
      userMsg('instructions for the agent', ['INSTRUCTIONS_PROMPT']),
      userMsg(
        '<conversation_summary>\nprior condensed memory\n</conversation_summary>',
      ),
      userMsg('the actual first user request'),
    ]
    expect(findFirstUserTurnText(messages)).toBe(
      'the actual first user request',
    )
  })

  test('pins long first turns with a truncation notice, keeping the head', () => {
    const long = 'A'.repeat(20_000)
    const pinned = findFirstUserTurnText([userMsg(long)])
    expect(pinned).not.toBeNull()
    expect(pinned!.startsWith('AAA')).toBe(true)
    expect(pinned).toContain('[...pinned text truncated')
  })
})

// P1a — structured summary contract

describe('buildStructuredSummary (P1a)', () => {
  const goalText = 'Refactor the auth module to use the new token service'
  const messages: Message[] = [
    userMsg('Build the auth module rewrite', ['USER_PROMPT']),
    assistantMsg('Inspected src/auth.ts and src/tokens.ts', [
      {
        toolName: 'read_files',
        input: { paths: ['src/auth.ts', 'src/tokens.ts'] },
      },
      {
        toolName: 'write_todos',
        input: {
          todos: [
            { task: 'Implement token service', completed: false },
            { task: 'Update auth middleware', completed: false },
          ],
        },
      },
    ]),
    assistantMsg('Rewrote the middleware', [
      { toolName: 'str_replace', input: { path: 'src/auth.ts' } },
    ]),
    userMsg('Also handle the refresh flow'),
  ]

  function buildBlock() {
    const preserved = buildPreservedState(messages)
    return buildStructuredSummary({
      messages,
      goalText,
      preservedState: preserved,
    })
  }

  test('contains all eight required sections and the state markers', () => {
    const block = buildBlock()
    expect(block).toContain('<structured_state>')
    expect(block).toContain('</structured_state>')
    for (const heading of [
      '## Standing facts & constraints',
      '## Goal',
      '## Decisions & rationale',
      '## Files & code',
      '## Open TODOs (reference-only)',
      '## Pending user asks',
      '## Exact identifiers',
      '## Preserved state',
    ]) {
      expect(block).toContain(heading)
    }
  })

  test('forbids active-instruction headings (reference-only rule)', () => {
    const block = buildBlock()
    expect(block).not.toContain('## Next Steps')
    expect(block).not.toContain('## Remaining Work')
  })

  test('standing facts carry user turns verbatim (never paraphrased)', () => {
    const block = buildBlock()
    expect(block).toContain('Build the auth module rewrite')
    expect(block).toContain('Also handle the refresh flow')
  })

  test('pins the first user turn verbatim (P1c)', () => {
    const block = buildBlock()
    expect(block).toContain('[pinned first user turn — verbatim]')
    expect(block).toContain('Build the auth module rewrite')
  })

  test('goal section carries the latest live user request verbatim', () => {
    const block = buildBlock()
    expect(block).toContain(goalText)
  })

  test('files & code section carries file ops from preserved state', () => {
    const block = buildBlock()
    expect(block).toContain('read: src/auth.ts, src/tokens.ts')
    expect(block).toContain('modified: src/auth.ts')
  })

  test('open TODOs are reference-only with checkbox state', () => {
    const block = buildBlock()
    expect(block).toContain('- [ ] Implement token service')
    expect(block).toContain('- [ ] Update auth middleware')
  })

  test('exact identifiers are literal', () => {
    const withIds: Message[] = [
      userMsg(
        'See https://example.com/docs and FID-2026-0806-003 and src/api.ts',
      ),
    ]
    const preserved = buildPreservedState(withIds)
    const block = buildStructuredSummary({
      messages: withIds,
      goalText: null,
      preservedState: preserved,
    })
    expect(block).toContain('- https://example.com/docs')
    expect(block).toContain('- FID-2026-0806-003')
    expect(block).toContain('- src/api.ts')
  })

  test('pending asks lists an unanswered ask_user call', () => {
    const withAsk = [
      userMsg('Answer my question'),
      assistantMsg('', [
        {
          toolName: 'ask_user',
          input: { questions: [{ question: 'Which provider do you prefer?' }] },
        },
      ]),
    ]
    const preserved = buildPreservedState(withAsk)
    const block = buildStructuredSummary({
      messages: withAsk,
      goalText: 'Answer my question',
      preservedState: preserved,
    })
    expect(block).toContain('- Which provider do you prefer?')
  })

  test('pending asks is empty once the ask was answered', () => {
    const withAnsweredAsk = [
      userMsg('Answer my question'),
      assistantMsg('', [
        {
          toolName: 'ask_user',
          input: { questions: [{ question: 'Which provider do you prefer?' }] },
        },
      ]),
      toolMsg('ask_user', {
        answers: [{ selectedOption: 'OpenRouter' }],
      }),
    ]
    const preserved = buildPreservedState(withAnsweredAsk)
    const block = buildStructuredSummary({
      messages: withAnsweredAsk,
      goalText: 'Answer my question',
      preservedState: preserved,
    })
    expect(block).toContain('## Pending user asks')
    expect(block).toContain('(none)')
    expect(block).not.toContain('- Which provider do you prefer?')
  })

  test('preserved-state JSON block is embedded and re-extractable', () => {
    const block = buildBlock()
    const match = block.match(/## Preserved state\n(\{.*\})/)
    expect(match).not.toBeNull()
    const extracted = extractPreservedState(block)
    expect(extracted).not.toBeNull()
    expect(extracted!.todos.length).toBe(2)
    expect(extracted!.readFiles).toEqual(['src/auth.ts', 'src/tokens.ts'])
  })
})
