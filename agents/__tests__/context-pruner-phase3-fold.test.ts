/**
 * FID-2026-0806-003 Phase 3 (P3a/P3d) — amortized fold + force-ratio tests.
 */
import { describe, expect, test } from 'bun:test'

import {
  assistantMessage,
  getText,
  runPruner,
  toolMessage,
  userMessage,
} from './context-pruner-phase3-test-fixtures'

import type { JSONValue, Message } from '../types/util-types'

describe('P3a amortized fold (foldOldestExchange)', () => {
  test('folds only the oldest exchange and keeps the rest verbatim', async () => {
    const now = Date.now()
    const history: Message[] = [
      userMessage('First request: build auth'),
      assistantMessage('Inspected src/auth.ts'),
      toolMessage('read_files', { paths: ['src/auth.ts'] }),
      userMessage('Second request: add tests'),
      assistantMessage('Wrote auth tests'),
      userMessage('Third request: run them'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    expect(messages).toBeDefined()
    expect(messages!.length).toBeGreaterThanOrEqual(3)

    const summaryText = getText(messages![0])
    expect(summaryText).toContain('<conversation_summary>')
    expect(summaryText).toContain('<compaction-summary>')
    expect(summaryText).toContain('<structured_state>')
    expect(summaryText).toContain('First request: build auth')

    const verbatim = messages!.slice(1)
    const verbatimText = verbatim.map(getText).join('\n')
    expect(verbatimText).toContain('Second request: add tests')
    expect(verbatimText).toContain('Third request: run them')
    expect(verbatimText).toContain('Wrote auth tests')
    expect(getText(messages![messages!.length - 1])).toContain(
      'Third request: run them',
    )
  })

  test('folds exactly one exchange per call (not all history)', async () => {
    const now = Date.now()
    const history: Message[] = [
      userMessage('Turn one'),
      assistantMessage('Work one'),
      userMessage('Turn two'),
      assistantMessage('Work two'),
      userMessage('Turn three'),
      assistantMessage('Work three'),
      userMessage('Turn four'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    const summaryText = getText(messages![0])
    expect(summaryText).toContain('Turn one')
    const verbatim = messages!.slice(1)
    const verbatimText = verbatim.map(getText).join('\n')
    expect(verbatimText).toContain('Turn two')
    expect(verbatimText).toContain('Turn three')
    expect(verbatimText).toContain('Turn four')
    expect(verbatimText).toContain('Work two')
    expect(verbatimText).toContain('Work three')
    expect(getText(messages![messages!.length - 1])).toContain('Turn four')
  })

  test('no-op when there is nothing un-absorbed (single user message)', async () => {
    const now = Date.now()
    const history: Message[] = [userMessage('Only one message')]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    expect(messages).toBeDefined()
    expect(messages!.length).toBe(1)
    expect(getText(messages![0])).toContain('Only one message')
    expect(getText(messages![0])).not.toContain('<conversation_summary>')
  })

  test('re-distills a prior summary when folding (Continue rule)', async () => {
    const now = Date.now()
    const priorSummary = userMessage(
      `<conversation_summary>
This is a summary of the conversation so far. The original messages have been condensed to save context space.

<historical_memory>
<compaction-summary>
<structured_state>
## Standing facts & constraints
[USER] Original pinned request
## Goal
(goal)
## Preserved state
{"todos":[],"readFiles":["src/a.ts"],"modifiedFiles":[],"createdFiles":[],"skills":[],"fid":null}
</structured_state>

[USER]
Original pinned request
</compaction-summary>
</historical_memory>
</conversation_summary>`,
    )
    const history: Message[] = [
      priorSummary,
      userMessage('New turn after summary'),
      assistantMessage('Work after summary'),
      userMessage('Live turn'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, { foldOldestExchange: true })

    const summaryText = getText(messages![0])
    expect(summaryText).toContain('Original pinned request')
    expect(summaryText).toContain('New turn after summary')
    expect(summaryText).toContain('src/a.ts')
    const verbatim = messages!.slice(1)
    expect(verbatim.map(getText).join('\n')).toContain('Live turn')
    expect(getText(messages![messages!.length - 1])).toContain('Live turn')
  })
})

describe('P3d force ratio (force: true)', () => {
  test('force bypasses the context-limit / cache-miss gates', async () => {
    const now = Date.now()
    const history: Message[] = [
      userMessage('Request one'),
      assistantMessage('Work one'),
      userMessage('Request two'),
    ]
    for (const m of history) (m as { sentAt?: number }).sentAt = now

    const { messages } = await runPruner(history, {
      force: true,
      maxContextLength: 200_000,
    } as Record<string, JSONValue>)

    expect(messages).toBeDefined()
    expect(getText(messages![0])).toContain('<conversation_summary>')
    expect(getText(messages![0])).toContain('Request one')
  })
})
