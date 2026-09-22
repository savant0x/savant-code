/**
 * FID-2026-0919-031 — the compaction pair and `Notification` (sibling of
 * `lifecycle-hooks.test.ts`, which owns the `Stop` / `Interrupt` terminal pair).
 *
 * **The `PreCompact` / `PostCompact` ruling** is attempt vs effect, and the
 * asymmetry IS the predicate: `PreCompact` reports the compaction ATTEMPT (a
 * `Pre` event cannot know the effect); `PostCompact` fires only on the runtime's
 * existing `pruned` predicate (`messagesRemoved > 0 && tokensSaved > 0`), so an
 * ineffective attempt cannot claim the context was compacted. The unmatched
 * `PreCompact` is the signal.
 *
 * **`Notification`** is the runtime handing control to the operator (`ask_user`),
 * fired before the client call so a hook observes the request even if the
 * operator never answers.
 *
 * These pins drive the REAL boundaries — the pruner outcome and the tool
 * dispatcher — because a pin that calls the helper directly would pass just as
 * happily against a helper nothing invokes, which is the defect being fixed.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { userMessage } from '@savant-code/common/util/messages'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  installHookCapture,
  repoRoot,
  rootAgentState,
  type HookCapture,
} from './lifecycle-hooks-test-harness'
import { firedEventsFromSource } from '../../../../../scripts/hook-events-check'
import { mockFileContext } from '../../__tests__/test-utils'
import { savantCodeToolHandlers } from '../../tools/handlers/list'
import { handleAskUser } from '../../tools/handlers/tool/ask-user'
import { applyPrunerCompactionOutcome } from '../../tools/handlers/tool/spawn-agent-inline-pruner-outcome'
import { fireCompactionHook, fireNotificationHook } from '../lifecycle-hooks'

let capture: HookCapture

beforeEach(() => {
  capture = installHookCapture()
})

afterEach(() => {
  capture.restore()
})

describe('compaction: attempt is Pre, effect is Post (FID-2026-0919-031)', () => {
  function compactionOutcome(historyAfter: number): void {
    const parentAgentState =
      getInitialSessionState(mockFileContext).mainAgentState
    parentAgentState.runId = 'run-compact-1'
    const previousHistory = [
      userMessage('one'),
      userMessage('two'),
      userMessage('three'),
    ]
    parentAgentState.messageHistory = previousHistory.slice(0, historyAfter)

    applyPrunerCompactionOutcome({
      parentAgentState,
      previousHistory,
      previousHistoryLength: previousHistory.length,
      previousTokenEstimate: 5000,
      summaryExcerpt: 'folded the oldest exchange',
      spawnParams: {},
      projectRoot: '/test',
      writeToClient: () => {},
    })
  }

  it('a compaction that removed something and saved tokens emits PostCompact', () => {
    compactionOutcome(2)

    const posts = capture.of('PostCompact')
    expect(posts).toHaveLength(1)
    expect(posts[0].tool_result).toMatchObject({ messagesRemoved: 1 })
    expect(
      (posts[0].tool_result as { tokensSaved: number }).tokensSaved,
    ).toBeGreaterThan(0)
  })

  it('an ineffective attempt emits NO PostCompact — the unmatched Pre IS the signal', () => {
    // Nothing removed: the runtime itself calls this `ineffective`, and an
    // `PostCompact` here would tell an operator the context was compacted when
    // nothing changed. That is the lying-event failure this work exists to stop.
    compactionOutcome(3)

    expect(capture.of('PostCompact')).toHaveLength(0)
  })

  it('the compaction helper is effect-blind by construction: both events report caller facts', () => {
    fireCompactionHook({
      event: 'PreCompact',
      parentAgentState: getInitialSessionState(mockFileContext).mainAgentState,
      projectRoot: '/test',
      toolResult: { trigger: 'pruner-spawn', contextTokenCount: 150_000 },
    })

    expect(capture.of('PreCompact')).toHaveLength(1)
    expect(capture.of('PreCompact')[0].tool_result).toMatchObject({
      trigger: 'pruner-spawn',
      contextTokenCount: 150_000,
    })
    expect(capture.of('PostCompact')).toHaveLength(0)
  })
})

describe('Notification is the runtime handing control to the operator (FID-2026-0919-031)', () => {
  it('the registered ask_user handler is the one that fires it', () => {
    // Reachability, not spelling: the dispatcher looks the handler up by tool
    // name, so this is the seam the event has to live on.
    expect(savantCodeToolHandlers.ask_user).toBe(handleAskUser as never)
  })

  it('an ask_user call fires Notification with the questions as tool input', async () => {
    const result = await handleAskUser({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'ask_user',
        toolCallId: 'call-1',
        input: { questions: [{ question: 'Which database?' }] },
      },
      requestClientToolCall: async () => [
        { type: 'json' as const, value: { skipped: true } },
      ],
      agentState: rootAgentState('run-notify-1'),
      fileContext: mockFileContext,
    } as never)

    const notifications = capture.of('Notification')
    expect(notifications).toHaveLength(1)
    expect(notifications[0].tool_name).toBe('ask_user')
    expect(notifications[0].tool_input).toEqual({
      questions: [{ question: 'Which database?' }],
    })
    expect(notifications[0].tool_result).toEqual({
      reason: 'agent-requested-operator-input',
    })
    // Observation-only: the client call still happened and its output is relayed.
    expect(result.output).toEqual([{ type: 'json', value: { skipped: true } }])
  })

  it('a bare notification needs no tool, and never reports an outcome', () => {
    fireNotificationHook({
      agentState: rootAgentState('run-notify-2'),
      fileContext: mockFileContext,
      reason: 'attention-required',
    })

    expect(capture.of('Notification')).toHaveLength(1)
    expect(capture.of('Notification')[0].tool_name).toBeUndefined()
    expect(capture.of('Notification')[0].tool_result).toEqual({
      reason: 'attention-required',
    })
  })
})

describe('the census proves all five are reachable, not merely named (FID-2026-0919-031)', () => {
  it('every newly wired event has a live site in the source', () => {
    const live = firedEventsFromSource(repoRoot)
    for (const event of [
      'Stop',
      'Interrupt',
      'PreCompact',
      'PostCompact',
      'Notification',
    ]) {
      expect(live.get(event)?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('a hook-helper mention alone is not a site (the census asks for a caller)', () => {
    // `hooks/lifecycle-hooks.ts` NAMES every event it can fire in its own
    // parameter types, which is exactly what a type annotation does without
    // firing anything. The helper-mediated events must therefore also appear in
    // a file that calls the helper — this pin states the rule, and
    // `scripts/hook-events-check.ts` enforces it over all sources.
    const helper = readFileSync(
      join(repoRoot, 'packages/agent-runtime/src/hooks/lifecycle-hooks.ts'),
      'utf8',
    )
    expect(helper).toContain("event: 'Stop' | 'Interrupt'")
    const callers = [
      'packages/agent-runtime/src/run-agent-step/loop.ts',
      'packages/agent-runtime/src/run-agent-step/loop/exit-paths.ts',
      'packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-precompact.ts',
      'packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-pruner-outcome.ts',
      'packages/agent-runtime/src/tools/handlers/tool/ask-user.ts',
    ]
    for (const caller of callers) {
      expect(readFileSync(join(repoRoot, caller), 'utf8')).toMatch(
        /fire(MainAgentTerminalHook|CompactionHook|NotificationHook)\(/,
      )
    }
  })
})
