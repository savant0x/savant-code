import { describe, expect, spyOn, test } from 'bun:test'

import { runProgrammaticStep } from '../run-programmatic-step'
import { createRunProgrammaticStepFixture } from './run-programmatic-step-part-c-fixtures'
import * as toolExecutor from '../tools/tool-executor'

import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

// FID-2026-0821-004 D1 — stale shared-array return. executeSingleToolCall
// used to return `toolResults[toolResults.length - 1]?.content` where
// toolResults is the CUMULATIVE array shared across ALL yields of a run
// (created once in run-programmatic-step.ts). When the CURRENT yield's call
// produces no result while an EARLIER call in the same run did (a silent
// gate early-return — e.g. the abort gate, which emits no error chunk by
// design), the generator received the PREVIOUS call's output as if fresh.
//
// The fix captures the shared-array length before executeToolCall and slices
// out only this call's own results, so a silent block yields undefined — not
// a stale prior output.

describe('runProgrammaticStep — per-call result return (FID-2026-0821-004 D1)', () => {
  test("a silently-blocked second yield does NOT receive the first yield's output", async () => {
    const { mockTemplate, mockAgentState, mockParams } =
      createRunProgrammaticStepFixture()

    const receivedByGenerator: unknown[] = []

    const executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async (options) => {
      const { toolName, toolResults, agentState } = options
      if (toolName === 'find_files') {
        // FIRST yield: a normal successful result lands in the shared array
        // (mirrors native.ts pushing the tool result into toolResults).
        const toolResult: ToolMessage = {
          role: 'tool',
          toolName: 'find_files',
          toolCallId: 'first-call-id',
          content: [
            {
              type: 'json',
              value: { files: [{ path: 'FIRST_CALL_ONLY.txt' }] },
            },
          ],
        }
        toolResults.push(toolResult)
        agentState.messageHistory.push(toolResult)
        return
      }
      // SECOND yield: a SILENT gate block — returns without pushing a tool
      // result AND without emitting an error chunk (abort-gate shape). The
      // old code fell through to `toolResults[last]` and handed back the
      // first call's output; the fix must deliver undefined instead.
    })

    const template = {
      ...mockTemplate,
      toolNames: ['find_files', 'set_output'],
      handleSteps: function* () {
        const first = (yield {
          toolName: 'find_files',
          input: { query: 'first' },
        }) as { toolResult: unknown }
        receivedByGenerator.push(first.toolResult)

        const second = (yield {
          toolName: 'set_output',
          input: { summary: 'silently blocked' },
        }) as { toolResult: unknown }
        receivedByGenerator.push(second.toolResult)
        yield {
          toolName: 'set_output',
          input: { summary: 'done' },
        }
      },
    } as typeof mockTemplate

    await runProgrammaticStep({
      ...mockParams,
      agentState: mockAgentState,
      template,
    })

    // The FIRST yield received its own result.
    expect(receivedByGenerator.length).toBe(2)
    const firstDelivered = receivedByGenerator[0] as Array<{
      value: { files: Array<{ path: string }> }
    }>
    expect(firstDelivered.length).toBe(1)
    expect(firstDelivered[0].value.files[0].path).toBe('FIRST_CALL_ONLY.txt')

    // THE D1 ASSERTION: the second yield must NOT receive the first call's
    // output. A silent block produces no result — run-programmatic-step
    // feeds `toolResult ?? []` to the generator, so it gets an EMPTY array
    // (the BASHER-1 guard's discriminator), never the first call's output.
    expect(receivedByGenerator[1]).toEqual([])
    expect(JSON.stringify(receivedByGenerator[1])).not.toContain(
      'FIRST_CALL_ONLY.txt',
    )

    executeToolCallSpy.mockRestore()
  })
})
