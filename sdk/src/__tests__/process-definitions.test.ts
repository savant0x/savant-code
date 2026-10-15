import { describe, expect, test } from 'bun:test'

import { processAgentDefinitions } from '../run-state/process-definitions'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

// FID-2026-0823-004 regression net. Bundled agents serialize handleSteps as
// source text and the SDK loader stringifies local agents before ingestion,
// so every production definition reaches processAgentDefinitions with a
// STRING handleSteps. The processor must preserve that string verbatim; live
// functions keep their existing fn+string dual-form behavior.

const asDefinition = (value: unknown): AgentDefinition =>
  value as AgentDefinition

describe('processAgentDefinitions', () => {
  test('preserves string-valued handleSteps verbatim', () => {
    const source = 'function* ({ params }) { yield "STEP" }'
    const [processed] = Object.values(
      processAgentDefinitions([
        asDefinition({ id: 'fixture-string', handleSteps: source }),
      ]),
    )
    expect(processed?.id).toBe('fixture-string')
    expect(processed?.handleSteps).toBe(source)
  })

  test('keeps live fns as handleStepsFn plus stringified handleSteps', () => {
    const live = function* (): Generator<'STEP'> {
      yield 'STEP'
    }
    const [processed] = Object.values(
      processAgentDefinitions([
        asDefinition({ id: 'fixture-fn', handleSteps: live }),
      ]),
    )
    expect(processed?.handleStepsFn).toBe(live)
    expect(typeof processed?.handleSteps).toBe('string')
  })

  test('passes through definitions without handleSteps untouched', () => {
    const [processed] = Object.values(
      processAgentDefinitions([asDefinition({ id: 'fixture-plain' })]),
    )
    expect(processed?.id).toBe('fixture-plain')
    expect(processed?.handleSteps).toBeUndefined()
    expect(processed?.handleStepsFn).toBeUndefined()
  })
})
