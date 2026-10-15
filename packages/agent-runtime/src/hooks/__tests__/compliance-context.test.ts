import { describe, expect, test } from 'bun:test'

import { createEnforcementState } from '../../echo/enforcement-state'
import { buildComplianceEvent } from '../compliance-capture'
import { seedComplianceContext } from '../compliance-context'

describe('resolved compliance identity', () => {
  test('records route, requested model, run and template role without payloads', () => {
    const state = createEnforcementState()
    seedComplianceContext(
      state,
      '/project',
      {
        id: 'forge',
        model: 'hcnsec/glm-5.3',
        modelRoute: { providerId: 'hcnsec', authMode: 'provider' },
      },
      { agentId: 'child', runId: 'run-1' },
    )
    expect(state.telemetryRootDir).toBe('/project')
    const event = buildComplianceEvent(
      {
        lawId: 3,
        violationClass: 'rejected',
        gateLayer: 'escalation',
        agentId: 'child',
      },
      () => 'now',
      state.telemetryIdentity,
    )
    expect(event).toMatchObject({
      model: 'hcnsec/glm-5.3',
      provider: 'hcnsec',
      sessionId: 'run-1',
      agentRole: 'forge',
      contextHash: '',
    })
  })

  test('a replacement clears old provider and project identity', () => {
    const state = createEnforcementState()
    seedComplianceContext(
      state,
      '/old',
      {
        id: 'forge',
        model: 'a',
        modelRoute: { providerId: 'old', authMode: 'provider' },
      },
      { agentId: 'old' },
    )
    seedComplianceContext(
      state,
      undefined,
      { id: 'verifier', model: 'b' },
      { agentId: 'new' },
    )
    expect(state.telemetryRootDir).toBeUndefined()
    expect(state.telemetryIdentity).toEqual({
      model: 'b',
      provider: '',
      sessionId: 'new',
      agentRole: 'verifier',
    })
  })
})
