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
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

describe('runProgrammaticStep', () => {
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
    spyOn(analytics, 'trackEvent').mockImplementation(() => {})
    spyOn(crypto, 'randomUUID').mockImplementation(
      () =>
        'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
    )
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
  })

  it('should pass tool results back to generator', async () => {
    const _toolResults: ToolMessage[] = []
    let receivedToolResult: ToolResultOutput[] | undefined

    const mockGenerator = (function* () {
      const input1 = yield {
        toolName: 'read_files',
        input: { paths: ['test.txt'] },
      }
      receivedToolResult = input1.toolResult
      yield { toolName: 'end_turn', input: {} }
    })() as StepGenerator

    mockTemplate.handleSteps = () => mockGenerator

    executeToolCallSpy.mockImplementation(
      async (
        options: ParamsOf<typeof executeToolCall>,
      ): ReturnType<typeof executeToolCall> => {
        if (options.toolName === 'read_files') {
          options.toolResults.push({
            role: 'tool',
            toolName: 'read_files',
            toolCallId: 'test-id',
            content: [{ type: 'json', value: 'file content' }],
          } satisfies ToolMessage)
        }
      },
    )

    await runProgrammaticStep(mockParams)

    expect(receivedToolResult).toEqual([
      {
        type: 'json',
        value: 'file content',
      },
    ])
  })
})
