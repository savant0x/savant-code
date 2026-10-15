import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { createProposeToolsFixture, logger } from './propose-tools-fixture'
import { clearAllProposedContent } from '../tools/handlers/tool/proposed-content-store'

import type { AgentTemplate, StepGenerator } from '../templates/types'
import type { ParamsOf } from '@savant-code/common/types/function-params'

/**
 * Tests for propose_str_replace and propose_write_file tools.
 * These tools allow agents to propose file edits without applying them,
 * returning unified diffs instead. This is useful for best-of-n editor patterns
 * where multiple implementations are generated and one is selected.
 */
describe('propose_str_replace and propose_write_file tools', () => {
  let mockTemplate: AgentTemplate
  let mockParams: ParamsOf<typeof runProgrammaticStep>

  beforeEach(() => {
    const fixture = createProposeToolsFixture()
    mockTemplate = fixture.mockTemplate
    mockParams = fixture.mockParams
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
    clearAllProposedContent()
  })

  describe('implementor agent workflow', () => {
    it('should receive tool results from previous tool calls across multiple steps', async () => {
      /**
       * This test verifies that when an agent makes multiple tool calls,
       * each subsequent yield receives the tool result from the previous call.
       * This is critical for the implementor2 pattern where the agent needs to
       * see the unified diff results to know what changes were proposed.
       */
      const receivedToolResults: any[] = []

      const mockGenerator = (function* () {
        // First tool call - propose_str_replace
        const step1 = yield {
          toolName: 'propose_str_replace',
          input: {
            path: 'src/utils.ts',
            replacements: [
              {
                oldString: 'return a + b;',
                newString: 'return a + b; // first change',
                allowMultiple: false,
              },
            ],
          },
        }
        const step1First = step1.toolResult?.[0]
        const step1HasDiff =
          step1First?.type === 'json' &&
          !!(step1First.value as { unifiedDiff?: string })?.unifiedDiff
        receivedToolResults.push({
          step: 1,
          toolResult: step1.toolResult,
          hasUnifiedDiff: step1HasDiff,
        })

        // Second tool call - another propose_str_replace
        const step2 = yield {
          toolName: 'propose_str_replace',
          input: {
            path: 'src/utils.ts',
            replacements: [
              {
                oldString: 'return a - b;',
                newString: 'return a - b; // second change',
                allowMultiple: false,
              },
            ],
          },
        }
        const step2First = step2.toolResult?.[0]
        const step2HasDiff =
          step2First?.type === 'json' &&
          !!(step2First.value as { unifiedDiff?: string })?.unifiedDiff
        receivedToolResults.push({
          step: 2,
          toolResult: step2.toolResult,
          hasUnifiedDiff: step2HasDiff,
        })

        // Third tool call - propose_write_file
        const step3 = yield {
          toolName: 'propose_write_file',
          input: {
            path: 'src/new-file.ts',
            instructions: 'Create new file',
            content: 'export const newFile = true;',
          },
        }
        const step3First = step3.toolResult?.[0]
        const step3HasDiff =
          step3First?.type === 'json' &&
          !!(step3First.value as { unifiedDiff?: string })?.unifiedDiff
        receivedToolResults.push({
          step: 3,
          toolResult: step3.toolResult,
          hasUnifiedDiff: step3HasDiff,
        })

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)

      // Verify we received tool results for all 3 steps
      expect(receivedToolResults).toHaveLength(3)

      // Step 1: Should have received tool result with unified diff
      expect(receivedToolResults[0].step).toBe(1)
      expect(receivedToolResults[0].toolResult).toBeDefined()
      expect(receivedToolResults[0].hasUnifiedDiff).toBe(true)
      const step1Result = receivedToolResults[0].toolResult[0] as {
        type: 'json'
        value: { file: string; unifiedDiff: string }
      }
      expect(step1Result.value.file).toBe('src/utils.ts')
      expect(step1Result.value.unifiedDiff).toContain('first change')

      // Step 2: Should have received tool result with unified diff
      expect(receivedToolResults[1].step).toBe(2)
      expect(receivedToolResults[1].toolResult).toBeDefined()
      expect(receivedToolResults[1].hasUnifiedDiff).toBe(true)
      const step2Result = receivedToolResults[1].toolResult[0] as {
        type: 'json'
        value: { file: string; unifiedDiff: string }
      }
      expect(step2Result.value.file).toBe('src/utils.ts')
      expect(step2Result.value.unifiedDiff).toContain('second change')

      // Step 3: Should have received tool result with unified diff for new file
      expect(receivedToolResults[2].step).toBe(3)
      expect(receivedToolResults[2].toolResult).toBeDefined()
      expect(receivedToolResults[2].hasUnifiedDiff).toBe(true)
      const step3Result = receivedToolResults[2].toolResult[0] as {
        type: 'json'
        value: { file: string; message: string }
      }
      expect(step3Result.value.file).toBe('src/new-file.ts')
      expect(step3Result.value.message).toContain('new file')
    })

    it('should collect tool calls and results for output', async () => {
      /**
       * This test simulates the editor-implementor2 workflow:
       * 1. Agent makes propose_* tool calls
       * 2. Tool results (with unified diffs) are captured
       * 3. Agent extracts tool calls and diffs for set_output
       */
      // Capture tool results as they come in
      const capturedToolResults: any[] = []
      const capturedToolCalls: { toolName: string; input: any }[] = []

      const mockGenerator = (function* () {
        // Make a propose_str_replace call
        const proposalInput = {
          path: 'src/utils.ts',
          replacements: [
            {
              oldString:
                'export function subtract(a: number, b: number): number {\n  return a - b;\n}',
              newString: `export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`,
              allowMultiple: false,
            },
          ],
        }
        const step1 = yield {
          toolName: 'propose_str_replace',
          input: proposalInput,
        }

        // Capture the original tool input and its result. `step1` is the
        // generator's public state, not the input sent to the tool.
        capturedToolCalls.push({
          toolName: 'propose_str_replace',
          input: proposalInput,
        })
        const step1First = step1.toolResult?.[0]
        if (step1First?.type === 'json' && step1First.value) {
          capturedToolResults.push(step1First.value)
        }

        // Generate unified diffs string from captured results
        const unifiedDiffs = capturedToolResults
          .filter((result: any) => result.unifiedDiff)
          .map((result: any) => `--- ${result.file} ---\n${result.unifiedDiff}`)
          .join('\n\n')

        yield {
          toolName: 'set_output',
          input: {
            toolCalls: capturedToolCalls,
            toolResults: capturedToolResults,
            unifiedDiffs,
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(result.agentState.output).toBeDefined()

      const output = result.agentState.output as {
        toolCalls: any[]
        toolResults: any[]
        unifiedDiffs: string
      }

      // Verify tool calls were captured
      expect(output.toolCalls).toHaveLength(1)
      expect(output.toolCalls[0].toolName).toBe('propose_str_replace')

      // Verify tool results were captured
      expect(output.toolResults).toHaveLength(1)
      expect(output.toolResults[0].file).toBe('src/utils.ts')
      expect(output.toolResults[0].unifiedDiff).toContain(
        '+export function multiply',
      )

      // Verify unified diffs string was generated
      expect(output.unifiedDiffs).toContain('--- src/utils.ts ---')
      expect(output.unifiedDiffs).toContain('+export function multiply')
    })
  })
})
