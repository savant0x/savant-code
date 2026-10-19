import { describe, expect, test } from 'bun:test'

import detective from '../detective/detective'
import { createFilePicker } from '../scout/scout'

import type { AgentStepContext } from '../types/agent-definition'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONValue } from '../types/util-types'

function context(): AgentStepContext {
  return {
    agentState: {
      agentId: 'research-child',
      messageHistory: [],
      systemPrompt: '',
      toolDefinitions: {},
      contextTokenCount: 0,
    },
    prompt: 'agents',
    params: { searchQueries: [{ pattern: 'MAX_SUBAGENT_FAN_OUT' }] },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  }
}

describe('FID-2026-1019-003: discovery child artifacts', () => {
  const definitions: Array<
    [string, Pick<SecretAgentDefinition, 'handleSteps' | 'outputMode'>]
  > = [
    ['Scout default', createFilePicker('default')],
    ['Scout max', createFilePicker('max')],
    ['Detective', detective],
  ]
  for (const [name, definition] of definitions) {
    for (const authored of [false, true]) {
      test(`${name} ${authored ? 'preserves the authored report' : 'returns real discovery evidence as fallback'}`, () => {
        expect(definition.outputMode).toBe('structured_output')
        const handle = definition.handleSteps
        if (typeof handle !== 'function') throw new Error('Missing generator')
        const ctx = context()
        const generator = handle(ctx)
        const evidence: JSONValue = {
          paths: ['common/src/constants/agents.ts'],
        }
        const response = {
          agentState: ctx.agentState,
          toolResult: [{ type: 'json' as const, value: evidence }],
          stepsComplete: true,
        }
        let next = generator.next()
        while (!next.done && next.value !== 'STEP') {
          const call = next.value
          if (typeof call !== 'object' || !('toolName' in call)) {
            throw new Error('Expected a discovery tool')
          }
          expect(call.toolName).toBe(
            name === 'Detective' ? 'code_search' : 'glob',
          )
          next = generator.next(response)
        }
        expect(next.value).toBe('STEP')
        const report = {
          message: 'Evidence-backed findings',
          files: ['common/src/constants/agents.ts'],
        }
        if (authored) ctx.agentState.output = report
        const afterStep = generator.next(response)
        if (authored) {
          expect(afterStep.done).toBe(true)
          expect(ctx.agentState.output).toBe(report)
        } else {
          expect(afterStep.done).toBe(false)
          const call = afterStep.value
          if (typeof call !== 'object' || !('toolName' in call)) {
            throw new Error('Missing fallback tool')
          }
          expect(call.toolName).toBe('set_output')
          expect(call.input).toMatchObject({ results: [evidence] })
          expect(generator.next(response).done).toBe(true)
        }
      })
    }
  }
})
