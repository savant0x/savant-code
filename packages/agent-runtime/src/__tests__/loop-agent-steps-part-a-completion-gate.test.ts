// loop-agent-steps part-a test family — first-turn completion gate
// (FID-2026-0810-002 / FID-2026-0822-003 regressions). Sibling of the
// Loop 352 decomposition (shared lifecycle in
// ./loop-agent-steps-part-a-test-harness).
import { describe, expect, it, mock } from 'bun:test'

import {
  createToolCallChunk,
  getLlmCallCount,
  getLoopAgentStepsBaseParams,
  getMockAgentState,
  getMockTemplate,
  incrLlmCallCount,
  loopAgentSteps,
  promptSuccess,
  registerPartALifecycle,
} from './loop-agent-steps-part-a-test-harness'

registerPartALifecycle()

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  it('first-turn completion gate: ungrounded text-only main-agent completion is steered, not emitted (FID-2026-0810-002)', async () => {
    // A fresh main agent with a resolved boot contract (protocolFile set) must
    // not end its turn with a text-only answer before the protocol read. The
    // completion gate injects ECHO_COMPLIANCE steering and keeps the loop
    // going; after the retry cap it disarms with a one-time notice and the
    // turn is allowed to end (bounded escape hatch).
    const mockAgentState = getMockAgentState()
    mockAgentState.protocolFile = 'ECHO.md'
    mockAgentState.protocolSource = 'local'

    // Ungrounded-text scenario: the model replies with PURE TEXT and no tool
    // calls (hasNoToolResults → shouldEndTurn=true). A tool-call reply would
    // be blocked by the universal tool gate instead — that is a different
    // layer. Every step here is a text completion.
    const baseParams = getLoopAgentStepsBaseParams()
    baseParams.promptAiSdkStream = mock(async function* ({}) {
      incrLlmCallCount()
      yield { type: 'text' as const, text: 'ungrounded answer\n\n' }
      return promptSuccess('mock-message-id')
    })

    const mockTemplate = getMockTemplate()
    const localAgentTemplates = {
      'test-agent': { ...mockTemplate, handleSteps: undefined },
    }

    const result = await loopAgentSteps({
      ...baseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // 3 blocked retries + 1 disarmed completion = 4 LLM steps.
    expect(getLlmCallCount()).toBe(4)
    const history = result.agentState.messageHistory
    const textOf = (m: (typeof history)[number]): string =>
      Array.isArray(m.content) && m.content[0]?.type === 'text'
        ? m.content[0].text
        : typeof m.content === 'string'
          ? m.content
          : ''
    const steers = history.filter(
      (m) =>
        m.role === 'user' &&
        textOf(m).includes('Session-init grounding required'),
    )
    expect(steers.length).toBeGreaterThanOrEqual(3)
    const disarm = history.find(
      (m) => m.role === 'user' && textOf(m).includes('disarmed'),
    )
    expect(disarm).toBeDefined()
  })

  it('first-turn completion gate: surrender turn output commits, never a permanent discard (FID-2026-0822-003 stager contract)', async () => {
    // Regression for the headless "No response from agent" failure: when the
    // completion gate surrenders (retry budget spent), the surrender turn's
    // streamed answer must COMMIT to history — bounded blocking must not
    // degrade into a permanent output shredder. The 3 blocked turns still
    // discard (by design), but the final turn's answer must survive.
    const mockAgentState = getMockAgentState()
    mockAgentState.protocolFile = 'ECHO.md'
    mockAgentState.protocolSource = 'local'

    const baseParams = getLoopAgentStepsBaseParams()
    baseParams.promptAiSdkStream = mock(async function* ({}) {
      incrLlmCallCount()
      yield { type: 'text' as const, text: `answer ${getLlmCallCount()}\n\n` }
      return promptSuccess('mock-message-id')
    })

    const mockTemplate = getMockTemplate()
    const localAgentTemplates = {
      'test-agent': {
        ...mockTemplate,
        handleSteps: undefined,
        outputMode: 'last_message' as const,
      },
    }

    const result = await loopAgentSteps({
      ...baseParams,
      agentType: 'test-agent',
      localAgentTemplates,
    })

    expect(getLlmCallCount()).toBe(4)
    const output = result.output
    expect(output?.type).toBe('lastMessage')
    const lastTurn = (
      output?.type === 'lastMessage' ? output.value : []
    ) as Array<{
      role: string
      content: unknown
    }>
    const assistantText = lastTurn
      .filter((m) => m.role === 'assistant')
      .map((m) =>
        Array.isArray(m.content) && m.content[0]?.type === 'text'
          ? m.content[0].text
          : typeof m.content === 'string'
            ? m.content
            : '',
      )
      .join('')
    expect(assistantText).toContain('answer 4')
    // The three blocked turns' answers remain discarded (steering-by-design).
    expect(assistantText).not.toContain('answer 1')
  })

  it('first-turn completion gate: a protocol read in the loop clears the gate and the turn ends normally (FID-2026-0810-002)', async () => {
    // Grounding must be the first action: when the agent reads the protocol
    // file, the tool gate clears (protocolRead=true) and the completion gate
    // passes — the turn ends without steering or retries.
    const mockAgentState = getMockAgentState()
    mockAgentState.protocolFile = 'ECHO.md'
    mockAgentState.protocolSource = 'local'

    const mockTemplate = getMockTemplate()
    const localAgentTemplates = {
      'test-agent': { ...mockTemplate, handleSteps: undefined },
    }
    const baseParams = getLoopAgentStepsBaseParams()
    baseParams.promptAiSdkStream = mock(async function* ({}) {
      incrLlmCallCount()
      yield createToolCallChunk('read_files', { paths: ['ECHO.md'] })
      yield { type: 'text' as const, text: 'grounded\n\n' }
      yield createToolCallChunk('end_turn', {})
      return promptSuccess('mock-message-id')
    })

    const result = await loopAgentSteps({
      ...baseParams,
      requestFiles: async ({ filePaths }) =>
        Object.fromEntries(filePaths.map((path) => [path, 'protocol content'])),
      agentType: 'test-agent',
      localAgentTemplates,
    })

    // The successful read clears the grounding checkpoint, the completion gate
    // sees protocolRead=true, and no grounding retry is required.
    expect(getLlmCallCount()).toBe(1)
    const history = result.agentState.messageHistory
    const textOf = (m: (typeof history)[number]): string =>
      Array.isArray(m.content) && m.content[0]?.type === 'text'
        ? m.content[0].text
        : typeof m.content === 'string'
          ? m.content
          : ''
    expect(
      history.some(
        (m) =>
          m.role === 'user' &&
          textOf(m).includes('Session-init grounding required'),
      ),
    ).toBe(false)
  })
})
