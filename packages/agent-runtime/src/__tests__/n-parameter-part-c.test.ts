import * as analytics from '@savant-code/common/analytics'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import {
  createNParameterFixture,
  type NParameterFixture,
} from './n-parameter-part-b-fixtures'
import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'

import type { StepGenerator } from '../templates/types'

describe('n parameter and GENERATE_N functionality', () => {
  let mockTemplate: NParameterFixture['mockTemplate']
  let createParams: NParameterFixture['createParams']
  let logger: NParameterFixture['logger']

  beforeEach(() => {
    const fixture = createNParameterFixture()
    mockTemplate = fixture.mockTemplate
    createParams = fixture.createParams
    logger = fixture.logger

    // Mock analytics
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})

    // Mock crypto.randomUUID
    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  describe('Edge cases and error handling', () => {
    it('should handle GENERATE_N with n=1', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 1 }
      } as () => StepGenerator

      const result = await runProgrammaticStep(
        createParams({ prompt: 'Test', userInputId: 'test-input' }),
      )

      expect(result.generateN).toBe(1)
      expect(result.endTurn).toBe(false)
    })

    it('should handle empty nResponses array', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step = yield { type: 'GENERATE_N', n: 3 }
        receivedResponses = step.nResponses
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      const mockParams = createParams({
        prompt: 'Test',
        userInputId: 'test-input',
      })

      await runProgrammaticStep(mockParams)

      // Second call with empty array
      await runProgrammaticStep({
        ...mockParams,
        nResponses: [],
        stepNumber: 2,
      })

      expect(receivedResponses).toEqual([])
    })

    it('should handle undefined nResponses', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step = yield { type: 'GENERATE_N', n: 2 }
        receivedResponses = step.nResponses
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      const mockParams = createParams({
        prompt: 'Test',
        userInputId: 'test-input',
      })

      await runProgrammaticStep(mockParams)

      // Second call without nResponses
      await runProgrammaticStep({
        ...mockParams,
        nResponses: undefined,
        stepNumber: 2,
      })

      expect(receivedResponses).toBeUndefined()
    })

    it('should handle GENERATE_N followed by error', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 3 }
        throw new Error('Unexpected error after GENERATE_N')
      } as () => StepGenerator

      const mockParams = createParams({
        prompt: 'Test',
        userInputId: 'test-input',
      })

      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(3)

      // Second call should handle error
      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: ['R1', 'R2', 'R3'],
        stepNumber: 2,
      })

      expect(result2.endTurn).toBe(true)
      expect(result2.agentState.output?.error).toContain(
        'Unexpected error after GENERATE_N',
      )
    })

    it('should handle GENERATE_N with STEP afterwards', async () => {
      let receivedResponses: string[] | undefined

      mockTemplate.handleSteps = function* () {
        const step1 = yield { type: 'GENERATE_N', n: 4 }
        receivedResponses = step1.nResponses

        // Yield STEP to pause execution
        yield 'STEP'

        // Continue after LLM runs
        yield {
          toolName: 'set_output',
          input: { processedResponses: receivedResponses?.length },
        }
        yield { toolName: 'end_turn', input: {} }
      } as () => StepGenerator

      mockTemplate.toolNames = ['set_output', 'end_turn']

      const mockParams = createParams({
        prompt: 'Test',
        userInputId: 'test-input',
      })

      // First call yields GENERATE_N
      const result1 = await runProgrammaticStep(mockParams)
      expect(result1.generateN).toBe(4)

      // Second call receives nResponses and yields STEP
      const result2 = await runProgrammaticStep({
        ...mockParams,
        agentState: result1.agentState,
        nResponses: ['A', 'B', 'C', 'D'],
        stepNumber: 2,
      })

      expect(receivedResponses).toEqual(['A', 'B', 'C', 'D'])
      expect(result2.endTurn).toBe(false) // STEP should not end turn
    })

    it('should clear generateN when endTurn is true', async () => {
      mockTemplate.handleSteps = function* () {
        yield { type: 'GENERATE_N', n: 2 }
        // Generator ends immediately
      } as () => StepGenerator

      const result = await runProgrammaticStep(
        createParams({ prompt: 'Test', userInputId: 'test-input' }),
      )

      // Should still set generateN even though endTurn will be true
      expect(result.generateN).toBe(2)
      expect(result.endTurn).toBe(false)
    })
  })
})
