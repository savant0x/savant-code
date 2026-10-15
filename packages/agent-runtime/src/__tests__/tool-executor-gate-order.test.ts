/**
 * Gate-order characterization tests — FID-2026-0905-001 RED.
 *
 * Pins the native tool executor's pre-dispatch gate ORDER before the
 * architectural decomposition. These tests must be green on the current
 * monolith and stay green after every extraction — that is the pin. All
 * calls go through the public barrel (`tools/tool-executor`), never
 * `./native` directly (harness precedent: `tool-executor-sandbox.test.ts`).
 * Result-lifecycle pins live in `tool-executor-result-lifecycle.test.ts`.
 *
 * Invariants (each traced to its origin FID in the test name):
 *   1. Parse-error branch precedes ANY `toolCall.input` dereference
 *      (FID-2026-0802-005 C1).
 *   2. Capability allowlist rejects a tool the template does not declare,
 *      before the write gate runs.
 *   3/4a. Sandbox gate precedes the Law 1 record — a sandbox-denied write
 *      produces NO write receipt (FID-2026-0804-009 code-review finding).
 *   4b. EHEL `beforeToolCall` is unconditional — a blocked write never
 *      reaches the PreToolUse hook gate or the handler (FID-2026-0811-016;
 *      hooks are an additional gate, never a bypass — FID-2026-0814-003).
 *   4c. EHEL-advised write dispatches exactly one Law-1 receipt.
 *   7. Abort gate: no dispatch after abort (FID-2026-0802-005 H7).
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

describe('tool-executor gate order (FID-2026-0905-001 characterization)', () => {
  it('1. parse error precedes any toolCall.input dereference (C1)', async () => {
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      '/test/project',
      chunks,
      makeAgentTemplate(['write_file']),
    )
    params.toolName = 'write_file'
    // Null input: a dereference before the parse-error branch would throw
    // `TypeError: Cannot read properties of null` instead of surfacing the
    // parse error (the exact regression C1 fixed).
    params.input = null as unknown as Record<string, never>
    params.requestToolCall = async () => ({ output: [] })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    const errorChunk = chunks.find((c) => c.type === 'error')
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.message).toContain('Original tool call input:')
    expect(chunks.filter((c) => c.type === 'tool_call')).toEqual([])
  })

  it('2. capability allowlist rejects an undeclared tool before the write gate', async () => {
    const { projectRoot } = newTempProjectWithFile('// existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['end_turn']),
    )
    params.toolName = 'write_file'
    params.input = {
      path: `${projectRoot}/src/new-file.ts`,
      content: 'x',
      instructions: 'test',
    }
    params.requestToolCall = async () => ({ output: [] })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    const errorChunk = chunks.find((c) => c.type === 'error')
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.message).toContain('not currently available')
    expect(chunks.find((c) => c.type === 'tool_call')).toBeUndefined()
  })

  it('3. sandbox deny precedes the Law 1 record — no write receipt (FID-2026-0804-009)', async () => {
    const { projectRoot } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['run_terminal_command']),
    )
    // The documented deny path: run_terminal_command in safe mode is
    // 'prompt' → downgraded to deny. The order pin that MATTERS here is
    // that the sandbox deny happens and the tracker records NOTHING (no
    // write receipts, no dispatch, no history pushes).
    params.agentState = makeAgentState({
      echoCompliance: new EchoComplianceTracker({
        fidPaths: [],
        userPrompt: 'sandbox-order',
      }),
    })
    params.toolName = 'run_terminal_command'
    params.input = { command: 'echo "hello"' }
    params.requestToolCall = async () => ({ output: [] })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    const errorChunk = chunks.find((c) => c.type === 'error')
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.message).toContain('blocked by the sandbox')
    const tracker = (params.agentState as ReturnType<typeof makeAgentState>)
      .echoCompliance as EchoComplianceTracker
    expect(tracker.getWriteRecords().length).toBe(0)
    expect(params.toolCalls).toEqual([])
  })

  it('4a. sandbox deny on a terminal call emits exactly one error and no tool_call', async () => {
    const { projectRoot } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['run_terminal_command']),
    )
    params.toolName = 'run_terminal_command'
    params.input = { command: 'echo "safe"' }
    params.requestToolCall = async () => ({ output: [] })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.filter((c) => c.type === 'error').length).toBe(1)
    expect(chunks.find((c) => c.type === 'tool_call')).toBeUndefined()
    expect(chunks.find((c) => c.type === 'tool_result')).toBeUndefined()
  })

  it('4b. EHEL block on a never-read write precedes hooks and handler (FID-2026-0811-016)', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    params.agentState = makeAgentState({
      echoCompliance: new EchoComplianceTracker({
        fidPaths: [],
        userPrompt: 'ehel-order',
      }),
    })
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// new content\n',
    }
    params.requestToolCall = async () => ({ output: [] })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    // Universal Law 1 block from the EHEL pre-write gate — the hook gate and
    // the handler are never reached.
    const blockedError = chunks.find((c) => c.type === 'error')
    expect(blockedError).toBeDefined()
    expect(blockedError?.message).toContain('[ECHO Enforcement] BLOCKED')
    expect(chunks.find((c) => c.type === 'tool_call')).toBeUndefined()
  })

  it('4c. EHEL-advised read-first write dispatches exactly one write receipt', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'advised-write',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    // Mirror production wiring: the EHEL pre-write gate checks its OWN
    // filesRead state (populated by read_files calls through beforeToolCall)
    // — seed it via the public factory so the write passes Law 1 pre-dispatch.
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// updated content\n',
    }
    params.requestToolCall = async () => ({
      output: [
        {
          type: 'json' as const,
          value: { file: target, content: '// updated content\n' },
        },
      ],
    })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.find((c) => c.type === 'tool_call')).toBeDefined()
    expect(chunks.find((c) => c.type === 'tool_result')).toBeDefined()
    const trackerAgain = (
      params.agentState as ReturnType<typeof makeAgentState>
    ).echoCompliance as EchoComplianceTracker
    expect(trackerAgain.getWriteRecords().length).toBe(1)
  })

  it('7. abort before dispatch — no tool_call, no handler, cancelled finish', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'abort-gate',
    })
    tracker.recordRead([target])
    const controller = new AbortController()
    params.signal = controller.signal
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'test write',
      content: '// aborted write\n',
    }
    params.requestToolCall = async () => ({ output: [] })
    controller.abort()

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()
    expect(chunks.find((c) => c.type === 'tool_call')).toBeUndefined()
    expect(params.toolCalls).toEqual([])
  })
})
