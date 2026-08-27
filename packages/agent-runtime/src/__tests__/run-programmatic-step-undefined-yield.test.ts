import { describe, expect, it, spyOn } from 'bun:test'

import { runProgrammaticStep } from '../run-programmatic-step'
import { createRunProgrammaticStepFixture } from './run-programmatic-step-part-c-fixtures'
import * as executeModule from '../run-programmatic-step/execute-tool-calls'

/**
 * FID-2026-0823-009 C2 — integration regression net at the exact crash site.
 *
 * Pre-fix, a generator yielding a tool call whose input carries explicit
 * undefined-valued keys failed HandleStepsYieldValueSchema.safeParse and
 * killed the ENTIRE subagent run ("Invalid yield value from handleSteps").
 * This drives runProgrammaticStep itself through that yield shape and asserts
 * the run survives and executes the SANITIZED call.
 */
describe('runProgrammaticStep — undefined-keyed yields (FID-2026-0823-009)', () => {
  it('survives an undefined-keyed tool-call yield and executes the sanitized input', async () => {
    const { mockTemplate, mockParams } = createRunProgrammaticStepFixture()
    // The Detective crash shape: optional params set to explicit undefined.
    mockTemplate.handleSteps = function* () {
      const result = yield {
        toolName: 'code_search',
        input: { pattern: 'checkRecorderOutcome', maxResults: undefined },
      }
      expect(result.toolResult).toEqual([])
      yield 'STEP'
    }

    const spy = spyOn(executeModule, 'executeSingleToolCall').mockResolvedValue(
      [],
    )
    try {
      const result = await runProgrammaticStep(mockParams)
      // Pre-fix this line was unreachable: safeParse threw before execution.
      expect(result.endTurn).toBe(false)
      expect(spy).toHaveBeenCalledTimes(1)
      const executedCall = spy.mock.calls[0][0]
      expect(executedCall.toolName).toBe('code_search')
      expect(executedCall.input).toEqual({ pattern: 'checkRecorderOutcome' })
    } finally {
      spy.mockRestore()
    }
  })
})
