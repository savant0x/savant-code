import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  clearAgentGeneratorCache,
  runProgrammaticStep,
} from '../run-programmatic-step'
import { createProposeToolsFixture, logger } from './propose-tools-fixture'
import { clearAllProposedContent } from '../tools/handlers/tool/proposed-content-store'

import type { ProposeToolsFixture } from './propose-tools-fixture'
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
  let executeToolCallSpy: ProposeToolsFixture['executeToolCallSpy']
  let mockFiles: Record<string, string>

  beforeEach(() => {
    const fixture = createProposeToolsFixture()
    mockFiles = fixture.mockFiles
    executeToolCallSpy = fixture.executeToolCallSpy
    mockTemplate = fixture.mockTemplate
    mockParams = fixture.mockParams
  })

  afterEach(() => {
    mock.restore()
    clearAgentGeneratorCache({ logger })
    clearAllProposedContent()
  })

  describe('propose_str_replace', () => {
    it('should propose string replacement and return unified diff', async () => {
      const toolResultsCapture: any[] = []

      const mockGenerator = (function* () {
        const step = yield {
          toolName: 'propose_str_replace',
          input: {
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
          },
        }
        toolResultsCapture.push(step.toolResult)

        const firstResult = step.toolResult?.[0]
        const unifiedDiff =
          firstResult?.type === 'json'
            ? (firstResult.value as { unifiedDiff?: string })?.unifiedDiff
            : undefined
        yield {
          toolName: 'set_output',
          input: {
            toolCalls: [{ toolName: 'propose_str_replace', input: step }],
            toolResults: step.toolResult,
            unifiedDiffs: unifiedDiff ?? '',
          },
        }
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      const result = await runProgrammaticStep(mockParams)

      expect(result.endTurn).toBe(true)
      expect(executeToolCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'propose_str_replace',
        }),
      )

      // Verify tool result contains unified diff
      expect(toolResultsCapture).toHaveLength(1)
      const toolResult = toolResultsCapture[0]
      expect(toolResult).toBeDefined()
      expect(toolResult[0].type).toBe('json')
      const jsonResult = toolResult[0] as {
        type: 'json'
        value: { file: string; unifiedDiff: string }
      }
      expect(jsonResult.value.file).toBe('src/utils.ts')
      expect(jsonResult.value.unifiedDiff).toContain(
        '+export function multiply',
      )
      expect(jsonResult.value.unifiedDiff).toContain('return a * b')
    })

    it('should return error when string not found', async () => {
      const toolResultsCapture: any[] = []

      const mockGenerator = (function* () {
        const step = yield {
          toolName: 'propose_str_replace',
          input: {
            path: 'src/utils.ts',
            replacements: [
              {
                oldString: 'nonexistent string that does not exist in the file',
                newString: 'replacement',
                allowMultiple: false,
              },
            ],
          },
        }
        toolResultsCapture.push(step.toolResult)
        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep(mockParams)

      expect(toolResultsCapture).toHaveLength(1)
      const toolResult = toolResultsCapture[0]
      const jsonResult = toolResult[0] as {
        type: 'json'
        value: { errorMessage: string }
      }
      expect(jsonResult.value.errorMessage).toContain('String not found')
    })

    it('should stack multiple replacements on the same file', async () => {
      const toolResultsCapture: any[] = []

      const mockGenerator = (function* () {
        // First replacement
        const step1 = yield {
          toolName: 'propose_str_replace',
          input: {
            path: 'src/utils.ts',
            replacements: [
              {
                oldString: 'return a + b;',
                newString: 'return a + b; // addition',
                allowMultiple: false,
              },
            ],
          },
        }
        toolResultsCapture.push({ step: 1, result: step1.toolResult })

        // Second replacement should work on the already-modified content
        const step2 = yield {
          toolName: 'propose_str_replace',
          input: {
            path: 'src/utils.ts',
            replacements: [
              {
                oldString: 'return a - b;',
                newString: 'return a - b; // subtraction',
                allowMultiple: false,
              },
            ],
          },
        }
        toolResultsCapture.push({ step: 2, result: step2.toolResult })

        yield { toolName: 'end_turn', input: {} }
      })() as StepGenerator

      mockTemplate.handleSteps = () => mockGenerator

      await runProgrammaticStep(mockParams)

      expect(toolResultsCapture).toHaveLength(2)

      // Both replacements should succeed
      const result0 = toolResultsCapture[0].result[0] as {
        type: 'json'
        value: { unifiedDiff: string }
      }
      const result1 = toolResultsCapture[1].result[0] as {
        type: 'json'
        value: { unifiedDiff: string }
      }
      expect(result0.value.unifiedDiff).toContain('// addition')
      expect(result1.value.unifiedDiff).toContain('// subtraction')

      // Final file should have both changes
      expect(mockFiles['src/utils.ts']).toContain('// addition')
      expect(mockFiles['src/utils.ts']).toContain('// subtraction')
    })
  })
})
