import { describe, expect, test } from 'bun:test'

import { runProgrammaticStep } from '../run-programmatic-step'
import { createRunProgrammaticStepFixture } from './run-programmatic-step-part-c-fixtures'

// FID-2026-0820-016: a gate-blocked programmatic tool call (here: the FSM
// phase gate with an idle-phase agentState blocking run_terminal_command)
// must synthesize the blocking tool result — a complete call/result pair in
// history and the block reason returned to the generator — instead of the
// silent drop that produced orphaned tool-calls and evidence-free NO-OUTPUT.

describe('runProgrammaticStep — blocked programmatic tool call (FID-2026-0820-016)', () => {
  test('synthesizes the gate-block result: complete pair in history + reason returned to the generator', async () => {
    const { mockTemplate, mockAgentState, mockParams } =
      createRunProgrammaticStepFixture()

    const receivedByGenerator: unknown[] = []
    const template = {
      ...mockTemplate,
      toolNames: ['run_terminal_command', 'set_output'],
      handleSteps: function* () {
        const { toolResult } = (yield {
          toolName: 'run_terminal_command',
          input: { command: 'echo blocked-probe' },
        }) as { toolResult: unknown }
        receivedByGenerator.push(toolResult)
        yield {
          toolName: 'set_output',
          input: { output: toolResult },
        }
      },
    } as typeof mockTemplate

    // The fixture's initial agentState is idle — the FSM phase gate blocks
    // run_terminal_command deterministically (native.ts FSM gate: idle is not
    // in ['audit', 'green', 'self_correct']).
    await runProgrammaticStep({
      ...mockParams,
      agentState: mockAgentState,
      template,
    })

    // The generator received the synthesized blocked result (type json with
    // blocked/reason) — not an empty array.
    expect(receivedByGenerator.length).toBe(1)
    const delivered = receivedByGenerator[0] as Array<{
      type: string
      value: { blocked: boolean; reason: string }
    }>
    expect(delivered.length).toBe(1)
    expect(delivered[0].type).toBe('json')
    expect(delivered[0].value.blocked).toBe(true)
    expect(delivered[0].value.reason).toContain('only available during')

    // Complete call/result pair in history: the assistant tool-call part is
    // followed by the synthesized tool result carrying the same reason.
    const toolCallIndex = mockAgentState.messageHistory.findIndex(
      (m) =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) => 'toolName' in p && p.toolName === 'run_terminal_command',
        ),
    )
    expect(toolCallIndex).toBeGreaterThanOrEqual(0)
    const resultMessage = mockAgentState.messageHistory[toolCallIndex + 1]
    expect(resultMessage?.role).toBe('tool')
    expect(resultMessage).toBeDefined()
    if (resultMessage?.role === 'tool') {
      expect(resultMessage.toolName).toBe('run_terminal_command')
      expect(resultMessage.content.length).toBe(1)
      expect(resultMessage.content[0].type).toBe('json')
      if (resultMessage.content[0].type === 'json') {
        const value = resultMessage.content[0].value as {
          blocked: boolean
          reason: string
        }
        expect(value.blocked).toBe(true)
        expect(value.reason).toContain('only available during')
      }
    }
  })

  test('a clean (non-blocked) execution produces no synthesized blocked result', async () => {
    const { mockTemplate, mockAgentState, mockParams } =
      createRunProgrammaticStepFixture()

    const template = {
      ...mockTemplate,
      toolNames: ['set_output'],
      handleSteps: function* () {
        yield {
          toolName: 'set_output',
          input: { summary: 'clean run' },
        }
      },
    } as typeof mockTemplate

    const result = await runProgrammaticStep({
      ...mockParams,
      agentState: mockAgentState,
      template,
    })

    expect(result.endTurn).toBe(true)
    const blockedEntries = mockAgentState.messageHistory.filter(
      (m) =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) =>
            p.type === 'json' &&
            typeof p.value === 'object' &&
            p.value !== null &&
            'blocked' in (p.value as Record<string, unknown>),
        ),
    )
    expect(blockedEntries.length).toBe(0)
  })
})
