import { mock } from 'bun:test'

import { createTextChunk, createToolCallChunk } from './stream'

import type { StreamChunk } from './stream'
import type { JSONValue } from '../../types/json'
import type { Mock } from 'bun:test'

/**
 * Options for creating a mock prompt function.
 */
export interface MockPromptOptions {
  /**
   * Default response text.
   */
  defaultResponse?: string

  /**
   * Whether to include an end_turn tool call.
   */
  includeEndTurn?: boolean

  /**
   * Custom chunks to yield.
   */
  chunks?: StreamChunk[]
}

/**
 * Mock prompt function result type.
 */
export type MockPromptFn = Mock<
  (
    params: Record<string, JSONValue>,
  ) => AsyncGenerator<StreamChunk, string | null>
>

/**
 * Creates a mock promptAiSdkStream function for testing.
 *
 * @param options - Configuration options
 * @returns A mock function that returns streams
 *
 * @example
 * ```typescript
 * const mockPrompt = createMockPromptAiSdkStream({
 *   defaultResponse: 'I understand your request.',
 * })
 *
 * loopAgentStepsBaseParams.promptAiSdkStream = mockPrompt
 *
 * await loopAgentSteps({ ...params })
 *
 * expect(mockPrompt).toHaveBeenCalledTimes(1)
 * ```
 */
export function createMockPromptAiSdkStream(
  options: MockPromptOptions = {},
): MockPromptFn {
  const {
    defaultResponse = 'Mock response\n\n',
    includeEndTurn = true,
    chunks,
  } = options

  return mock(async function* () {
    if (chunks) {
      for (const chunk of chunks) {
        yield chunk
      }
    } else {
      yield createTextChunk(defaultResponse)
      if (includeEndTurn) {
        yield createToolCallChunk('end_turn', {})
      }
    }
    return 'mock-message-id'
  })
}
