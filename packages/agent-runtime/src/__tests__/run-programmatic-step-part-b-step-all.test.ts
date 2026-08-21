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
  createRunProgrammaticStepFixture,
  logger,
} from './run-programmatic-step-part-c-fixtures'
import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import * as toolExecutor from '../tools/tool-executor'

import type { StepGenerator } from '../templates/types'
import type { executeToolCall } from '../tools/tool-executor'
import type { PublicAgentState } from '@savant-code/common/types/agent-template'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

describe('runProgrammaticStep STEP_ALL integration', () => {
  let mockTemplate: ReturnType<
    typeof createRunProgrammaticStepFixture
  >['mockTemplate']
  let mockParams: ReturnType<
    typeof createRunProgrammaticStepFixture
  >['mockParams']
  let executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >

  beforeEach(() => {
    const fixture = createRunProgrammaticStepFixture()
    mockTemplate = fixture.mockTemplate
    mockParams = fixture.mockParams
    executeToolCallSpy = spyOn(
      toolExecutor,
      'executeToolCall',
    ).mockImplementation(async () => {})
    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  it('preserves tool results and state across STEP_ALL', async () => {
    const toolResultsReceived: ToolResultOutput[][] = []
    const stateSnapshots: PublicAgentState[] = []
    let stepCount = 0
    const mockGenerator = (function* () {
      stepCount++
      const step1 = yield {
        toolName: 'read_files',
        input: { paths: ['src/auth.ts', 'src/config.ts'] },
      }
      toolResultsReceived.push(step1.toolResult)
      stateSnapshots.push({ ...step1.agentState })
      const step2 = yield {
        toolName: 'code_search',
        input: { pattern: 'authenticate', flags: '-i' },
      }
      toolResultsReceived.push(step2.toolResult)
      stateSnapshots.push({ ...step2.agentState })
      const step3 = yield {
        toolName: 'create_plan',
        input: {
          path: 'analysis-plan.md',
          plan: 'Comprehensive analysis of authentication system',
        },
      }
      toolResultsReceived.push(step3.toolResult)
      stateSnapshots.push({ ...step3.agentState })
      const step4 = yield {
        toolName: 'add_subgoal',
        input: {
          id: 'auth-analysis',
          objective: 'Analyze authentication patterns',
          status: 'IN_PROGRESS',
          plan: 'Review auth files and create recommendations',
        },
      }
      toolResultsReceived.push(step4.toolResult)
      stateSnapshots.push({ ...step4.agentState })
      const step5 = yield {
        toolName: 'write_file',
        input: {
          path: 'auth-analysis.md',
          instructions: 'Create authentication analysis document',
          content: '# Authentication Analysis\n\nBased on code review...',
        },
      }
      toolResultsReceived.push(step5.toolResult)
      stateSnapshots.push({ ...step5.agentState })
      const step6 = yield {
        toolName: 'update_subgoal',
        input: {
          id: 'auth-analysis',
          status: 'COMPLETE',
          log: 'Analysis completed successfully',
        },
      }
      toolResultsReceived.push(step6.toolResult)
      stateSnapshots.push({ ...step6.agentState })
      const step7 = yield {
        toolName: 'set_output',
        input: {
          status: 'success',
          filesAnalyzed: ['src/auth.ts', 'src/config.ts'],
          patternsFound: 3,
          recommendations: ['Use stronger auth', 'Add 2FA'],
          completedAt: new Date().toISOString(),
        },
      }
      toolResultsReceived.push(step7.toolResult)
      stateSnapshots.push({ ...step7.agentState })
      yield 'STEP_ALL'
    })() as StepGenerator

    mockTemplate.handleSteps = () => mockGenerator
    mockTemplate.toolNames = [
      'read_files',
      'code_search',
      'create_plan',
      'add_subgoal',
      'write_file',
      'update_subgoal',
      'set_output',
      'end_turn',
    ]
    executeToolCallSpy.mockImplementation(
      async (
        options: ParamsOf<typeof executeToolCall>,
      ): ReturnType<typeof executeToolCall> => {
        const { toolName, input, toolResults, agentState } = options
        let result: string
        switch (toolName) {
          case 'read_files':
            result = JSON.stringify({
              'src/auth.ts':
                'export function authenticate(user) { return true; }',
              'src/config.ts': 'export const authConfig = { enabled: true };',
            })
            break
          case 'code_search':
            result =
              'src/auth.ts:1:export function authenticate(user) {\nsrc/config.ts:1:authConfig'
            break
          case 'create_plan':
            result = 'Plan created successfully at analysis-plan.md'
            break
          case 'add_subgoal':
            result = 'Subgoal "auth-analysis" added successfully'
            agentState.agentContext['auth-analysis'] = {
              objective: 'Analyze authentication patterns',
              status: 'IN_PROGRESS',
              plan: 'Review auth files and create recommendations',
              logs: [],
            }
            break
          case 'write_file':
            result = 'File written successfully: auth-analysis.md'
            break
          case 'update_subgoal':
            result = 'Subgoal "auth-analysis" updated successfully'
            if (agentState.agentContext['auth-analysis']) {
              agentState.agentContext['auth-analysis'].status = 'COMPLETE'
              agentState.agentContext['auth-analysis'].logs.push(
                'Analysis completed successfully',
              )
            }
            break
          case 'set_output':
            result = 'Output set successfully'
            agentState.output = input
            break
          default:
            result = `${toolName} executed successfully`
        }
        const toolResult: ToolMessage = {
          role: 'tool',
          toolName,
          toolCallId: `${toolName}-call-id`,
          content: [{ type: 'json', value: result }],
        }
        toolResults.push(toolResult)
        agentState.messageHistory.push(toolResult)
      },
    )

    const result1 = await runProgrammaticStep(mockParams)
    expect(executeToolCallSpy).toHaveBeenCalledTimes(7)
    expect(result1.endTurn).toBe(false)
    expect(stepCount).toBe(1)
    const toolCalls = executeToolCallSpy.mock.calls
    expect(toolCalls[0][0].toolName).toBe('read_files')
    expect(toolCalls[0][0].input.paths).toEqual([
      'src/auth.ts',
      'src/config.ts',
    ])
    expect(toolCalls[1][0].toolName).toBe('code_search')
    expect(toolCalls[1][0].input.pattern).toBe('authenticate')
    expect(toolCalls[2][0].toolName).toBe('create_plan')
    expect(toolCalls[3][0].toolName).toBe('add_subgoal')
    expect(toolCalls[4][0].toolName).toBe('write_file')
    expect(toolCalls[5][0].toolName).toBe('update_subgoal')
    expect(toolCalls[6][0].toolName).toBe('set_output')
    expect(toolResultsReceived).toHaveLength(7)
    expect(JSON.stringify(toolResultsReceived[0])).toContain('authenticate')
    expect(JSON.stringify(toolResultsReceived[3])).toContain('auth-analysis')
    expect(JSON.stringify(toolResultsReceived[6])).toContain(
      'Output set successfully',
    )
    expect(stateSnapshots).toHaveLength(7)
    expect(Object.keys(result1.agentState.agentContext)).toContain(
      'auth-analysis',
    )
    expect(result1.agentState.agentContext['auth-analysis']?.status).toBe(
      'COMPLETE',
    )
    expect(result1.agentState.output).toEqual({
      status: 'success',
      filesAnalyzed: ['src/auth.ts', 'src/config.ts'],
      patternsFound: 3,
      recommendations: ['Use stronger auth', 'Add 2FA'],
      completedAt: expect.any(String),
    })
    expect(toolResultsReceived).toHaveLength(7)
    expect(toolResultsReceived.every((result) => result !== undefined)).toBe(
      true,
    )
    expect(executeToolCallSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentState: expect.objectContaining({
          messageHistory: expect.any(Array),
        }),
      }),
    )

    executeToolCallSpy.mockClear()
    const result2 = await runProgrammaticStep({
      ...mockParams,
      agentState: result1.agentState,
    })
    expect(executeToolCallSpy).not.toHaveBeenCalled()
    expect(result2.endTurn).toBe(false)
    expect(result2.agentState.agentId).toEqual(result1.agentState.agentId)
    expect(stepCount).toBe(1)

    const result3 = await runProgrammaticStep({
      ...mockParams,
      agentState: result2.agentState,
    })
    expect(executeToolCallSpy).not.toHaveBeenCalled()
    expect(result3.endTurn).toBe(false)
    expect(result3.agentState.agentId).toEqual(result1.agentState.agentId)
    expect(stepCount).toBe(1)
  })
})
