import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { isIllegalCut } from '../context-compactor/cut-points'
import { planCompactionCut } from '../run-agent-step/compaction-plan'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-1006-003 WP1: the cut planner must be computed on a real step
 * boundary and reach the pruner. These tests assert the CALLER (the step
 * boundary plans, the spawn boundary forwards) and the plan's own guarantees,
 * so removing the wiring fails here instead of only leaving compaction
 * unchanged.
 */
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..', '..')

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const user: Message = { role: 'user', content: [{ type: 'text', text: 'go' }] }

const text: Message = {
  role: 'assistant',
  content: [{ type: 'text', text: 'working' }],
}

const call = (
  toolName: string,
  input: Record<string, JSONValue>,
): Message => ({
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId: 'c1', toolName, input }],
})

const result: Message = {
  role: 'tool',
  toolCallId: 'c1',
  toolName: 'read_files',
  content: [{ type: 'json', value: 'ok' }],
}

describe('compaction cut plan wiring (FID-2026-1006-003 WP1)', () => {
  test('the step boundary plans the cut and the spawn boundary forwards it', () => {
    expect(
      source('packages/agent-runtime/src/run-agent-step/context-tokens.ts'),
    ).toContain('planCompactionCut(')
    expect(
      source(
        'packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts',
      ),
    ).toContain('cutPlan: parentAgentState.compactionCutPlan')
    // The embedded pruner consumes the plan as data (it cannot import us).
    expect(
      source('agents/context-pruner/summarization-context.ts'),
    ).toContain('spawnParams.cutPlan')
    expect(source('agents/context-pruner/summary-assembly.ts')).toContain(
      'index >= cutWindowStart',
    )
  })

  test('the boundary never opens the live region on a tool result', () => {
    const messages = [
      user,
      text,
      call('read_files', { paths: ['a.ts'] }),
      result,
      user,
      text,
    ]
    const plan = planCompactionCut({ messages, tailBudgetTokens: 1_000 })

    expect(isIllegalCut(messages, plan.cutIndex)).toBe(false)
    expect(plan.cutIndex).toBe(4)
    expect(plan.segments).toEqual([{ start: 0, end: 4 }])
  })

  test('the window opens at the previous kept boundary, not at zero', () => {
    const summary: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<conversation_summary><historical_memory>old</historical_memory></conversation_summary>',
        },
      ],
    }
    const messages = [user, text, summary, user, text]
    const plan = planCompactionCut({ messages, tailBudgetTokens: 1_000 })

    // Everything before the boundary is already carried by the summary, so
    // the planned window never opens before it.
    expect(plan.segments[0]?.start).toBe(3)
  })
})
