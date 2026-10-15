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

  describe('propose_write_file', () => {
    it('should propose new file creation and return unified diff', async () => {
      const toolResultsCapture: any[] = []

      const mockGenerator = (function* () {
        const step = yield {
          toolName: 'propose_write_file',
          input: {
            path: 'src/multiply.ts',
            instructions: 'Create multiply function',
            content: `export function multiply(a: number, b: number): number {\n  return a * b;\n}\n`,
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
        value: { file: string; message: string; unifiedDiff: string }
      }
      expect(jsonResult.value.file).toBe('src/multiply.ts')
      expect(jsonResult.value.message).toContain('new file')
      expect(jsonResult.value.unifiedDiff).toContain(
        '+export function multiply',
      )
    })

    it('should propose file edit and return unified diff', async () => {
      const toolResultsCapture: any[] = []

      const mockGenerator = (function* () {
        const step = yield {
          toolName: 'propose_write_file',
          input: {
            path: 'src/utils.ts',
            instructions: 'Add multiply function',
            content: `export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport function subtract(a: number, b: number): number {\n  return a - b;\n}\n\nexport function multiply(a: number, b: number): number {\n  return a * b;\n}\n`,
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
        value: { file: string; message: string; unifiedDiff: string }
      }
      expect(jsonResult.value.file).toBe('src/utils.ts')
      expect(jsonResult.value.message).toContain('changes')
      expect(jsonResult.value.unifiedDiff).toContain(
        '+export function multiply',
      )
    })
  })
})
