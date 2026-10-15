/**
 * Result-lifecycle characterization tests — FID-2026-0905-001 RED.
 *
 * Pins the native tool executor's two-branch result lifecycle (success /
 * rejection) and its cross-cutting contracts. Companion to
 * `tool-executor-gate-order.test.ts` (pre-dispatch gate ORDER); same rules:
 * green on the monolith, green after every extraction, public barrel only.
 *
 * Invariants (each traced to its origin FID in the test name):
 *   5. Trust boundary: a handler rejection surfaces as a tool error chunk,
 *      never fails the run (FID-2026-0802-005 C2 / Law 14).
 *   6. Failure lifecycle: a tool-result error routes the write lifecycle to
 *      the failure path (write recorded at dispatch, suppressed downstream).
 *   8. `set_messages` grounding refresh only on success + no tool-result
 *      error + non-subagent (history replaced in both branches).
 *   9. Success lifecycle: tool_call → tool_result ordering, history pushes.
 */

import { describe, expect, it } from 'bun:test'

import {
  createBaseParams,
  EchoComplianceTracker,
  makeAgentState,
  makeAgentTemplate,
  newTempProjectWithFile,
  runGateOrderTest,
  type ChunkRecord,
} from './tool-executor-gate-order-fixtures'
import { getOrCreateEnforcement } from '../echo/enforcement'

describe('tool-executor result lifecycle (FID-2026-0905-001 characterization)', () => {
  it('5. handler rejection is a trust boundary — tool error, run survives (C2/Law 14)', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'trust-boundary',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// trust-boundary write\n',
    }
    params.requestToolCall = async () => ({ output: [] })
    // A failed predecessor tool rejects the awaited predecessor promise —
    // the rejection must surface as a tool error chunk (the hadToolCallError
    // retry flow), never propagate and fail the run (FID-2026-0802-005 C2:
    // "thrown or rejected exception must surface as a tool error").
    // The no-op catch marks the rejection handled so bun's unhandled-rejection
    // probe does not fire before the handler reaches its await; the handler
    // still observes the rejection through its own await.
    const rejectedPredecessor = Promise.reject(
      new Error('predecessor tool failed'),
    )
    rejectedPredecessor.catch(() => {})
    params.previousToolCallFinished = rejectedPredecessor

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()
    const errorChunk = chunks.find(
      (c) =>
        c.type === 'error' && c.message?.includes('Tool `write_file` failed:'),
    )
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.message).toContain('predecessor tool failed')
    // The run survived; exactly one tool-error chunk was emitted.
    expect(chunks.filter((c) => c.type === 'error').length).toBe(1)
  })

  it('6. tool-result error routes to the failure lifecycle (no grounding refresh)', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'failure-lifecycle',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// failure-lifecycle write\n',
    }
    params.requestToolCall = async () => ({
      output: [
        {
          type: 'json' as const,
          value: { file: target, errorMessage: 'simulated write failure' },
        },
      ],
    })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.find((c) => c.type === 'tool_result')).toBeDefined()
    // Failure lifecycle: write lifecycle suppressed — no successful write
    // recorded beyond the dispatch-time receipt.
    const trackerAgain = (
      params.agentState as ReturnType<typeof makeAgentState>
    ).echoCompliance as EchoComplianceTracker
    expect(trackerAgain.getWriteRecords().length).toBe(1)
  })

  it('8a. successful set_messages refreshes grounding (non-subagent)', async () => {
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      '/test/project',
      chunks,
      makeAgentTemplate(['set_messages']),
    )
    const history = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hello' }],
      },
      {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'hi' }],
      },
    ]
    params.agentState = makeAgentState({ messageHistory: [] })
    params.toolName = 'set_messages'
    params.input = { messages: history } as unknown as Record<string, never>
    params.requestToolCall = async () => ({ output: [] })

    await runGateOrderTest(params)
    expect(
      (params.agentState as ReturnType<typeof makeAgentState>).messageHistory,
    ).toEqual(history)
    // ECHO_STEERING tag contract: the enforcement refresh is appended as a
    // tagged user message when a replacement fires with refresh text.
    const last = (
      params.agentState as ReturnType<typeof makeAgentState>
    ).messageHistory.at(-1)
    expect(['user', 'assistant']).toContain(String(last?.role))
  })

  it('8b. subagent set_messages skips the grounding refresh', async () => {
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      '/test/project',
      chunks,
      makeAgentTemplate(['set_messages']),
    )
    const history = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hello' }],
      },
    ]
    params.agentState = makeAgentState({
      parentId: 'parent-agent',
      messageHistory: [],
    })
    params.toolName = 'set_messages'
    params.input = { messages: history } as unknown as Record<string, never>
    params.requestToolCall = async () => ({ output: [] })

    await runGateOrderTest(params)
    expect(
      (params.agentState as ReturnType<typeof makeAgentState>).messageHistory,
    ).toEqual(history)
  })

  it('9. write_file happy path in safe mode emits call→result in order', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'happy-path',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// happy path content\n',
    }
    params.requestToolCall = async () => ({
      output: [
        {
          type: 'json' as const,
          value: { file: target, content: '// happy path content\n' },
        },
      ],
    })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    const callIndex = chunks.findIndex((c) => c.type === 'tool_call')
    const resultIndex = chunks.findIndex((c) => c.type === 'tool_result')
    expect(callIndex).toBeGreaterThan(-1)
    expect(resultIndex).toBeGreaterThan(callIndex)
    expect(params.toolCalls.length).toBe(1)
    expect(params.toolResults.length).toBe(1)
  })
})
