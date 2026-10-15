// loopAgentSteps part-f family — Thinker convergence gate integration
// (FID-2026-0801-012). Sibling of the Loop-346 decomposition (parent:
// loop-agent-steps-part-f.test.ts; shared lifecycle in
// ./loop-agent-steps-part-f-test-harness).
import { afterEach, describe, expect, it } from 'bun:test'
import { z } from 'zod/v4'

import {
  createToolCallChunk,
  getBaseParams,
  getTemplate,
  loopAgentSteps,
  promptSuccess,
  registerLoopAgentStepsPartFLifecycle,
} from './loop-agent-steps-part-f-test-harness'
import { clearThinkerConvergenceStateForTests as clearConvergence } from '../tools/thinker-convergence-gate'
import { clearAllThoughtSessionsForTests } from '../tools/thought-session-store'

import type { AgentTemplate } from '../templates/types'

describe('loopAgentSteps - runAgentStep vs runProgrammaticStep behavior', () => {
  registerLoopAgentStepsPartFLifecycle()

  describe('Thinker convergence gate integration (FID-2026-0801-012)', () => {
    const thinkerTemplate = (): AgentTemplate => ({
      ...getTemplate(),
      id: 'thinker-test-agent',
      outputMode: 'structured_output',
      outputSchema: z.object({
        status: z.string(),
        payload: z.object({ message: z.string() }).nullable(),
      }),
      toolNames: ['sequentialthinking', 'end_turn'],
      handleSteps: undefined,
    })

    afterEach(() => {
      clearAllThoughtSessionsForTests()
      clearConvergence()
    })

    it('sets output from the session snapshot and breaks without the set_output restart', async () => {
      // The Thinker converges with a single nextThoughtNeeded=false thought and
      // ends its turn. The gate must build the FinalArtifact from the session
      // snapshot and set agentState.output BEFORE the loop-top
      // `output === undefined && shouldEndTurn` restart check can inject the
      // "You must use set_output" message (which would reintroduce the null).
      const template = thinkerTemplate()
      let llmCallNumber = 0
      getBaseParams().promptAiSdkStream = async function* () {
        llmCallNumber++
        yield createToolCallChunk('sequentialthinking', {
          thought: 'Conclusion: use the hybrid approach.',
          thoughtNumber: 1,
          totalThoughts: 1,
          nextThoughtNeeded: false,
        })
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('mock-message-id')
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentType: 'thinker-test-agent',
        localAgentTemplates: { 'thinker-test-agent': template },
      })

      // Exactly one LLM call: the loop must NOT have restarted.
      expect(llmCallNumber).toBe(1)
      expect(result.agentState.output).toBeDefined()
      expect((result.agentState.output as { status?: string }).status).toBe(
        'success',
      )
      const restartMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('set_output'),
      )
      expect(restartMessages.length).toBe(0)
    })

    it('retries on non-convergence instead of restarting, then converges', async () => {
      // First turn: the model thinks (nextThoughtNeeded=true) and ends the turn
      // unconverged. The gate appends a typed retry message and keeps the loop
      // going — it must NOT hit the set_output restart path. Second turn
      // converges and the gate sets the artifact.
      const template = thinkerTemplate()
      let llmCallNumber = 0
      getBaseParams().promptAiSdkStream = async function* () {
        llmCallNumber++
        if (llmCallNumber === 1) {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'Partial analysis, not done yet.',
            thoughtNumber: 1,
            totalThoughts: 2,
            nextThoughtNeeded: true,
          })
        } else {
          yield createToolCallChunk('sequentialthinking', {
            thought: 'Final conclusion: hybrid wins.',
            thoughtNumber: 2,
            totalThoughts: 2,
            nextThoughtNeeded: false,
          })
        }
        yield { type: 'text' as const, text: '\n\n' }
        yield createToolCallChunk('end_turn', {})
        return promptSuccess('mock-message-id')
      }

      const result = await loopAgentSteps({
        ...getBaseParams(),
        agentType: 'thinker-test-agent',
        localAgentTemplates: { 'thinker-test-agent': template },
      })

      // Two LLM calls: first unconverged turn + retry, second converged turn.
      expect(llmCallNumber).toBe(2)
      expect(result.agentState.output).toBeDefined()
      expect((result.agentState.output as { status?: string }).status).toBe(
        'success',
      )
      // The typed retry message was appended after the first turn...
      const retryMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('nextThoughtNeeded=false'),
      )
      expect(retryMessages.length).toBeGreaterThan(0)
      // ...and the set_output restart message was never injected.
      const restartMessages = result.agentState.messageHistory.filter(
        (m) =>
          m.role === 'user' &&
          m.content[0].type === 'text' &&
          m.content[0].text.includes('set_output'),
      )
      expect(restartMessages.length).toBe(0)
    })
  })
})
