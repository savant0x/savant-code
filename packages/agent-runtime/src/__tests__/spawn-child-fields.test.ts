import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { describe, expect, it } from 'bun:test'

import { createAgentState } from '../tools/handlers/tool/spawn-agent-utils'
import {
  CHILD_OWN,
  classifyAgentStateField,
  GOVERNANCE_FIELDS,
  inheritFromParent,
  inheritRunGovernance,
  INHERITED_FROM_PARENT,
  NOT_INHERITED_BY_DESIGN,
} from '../tools/handlers/tool/spawn-child-fields'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'

const template: AgentTemplate = {
  id: 'forge',
  displayName: 'Forge',
  spawnerPrompt: '',
  model: 'test/model',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: '',
  stepPrompt: '',
}

/**
 * The partition's whole purpose is that its lists describe REALITY. The
 * compile-time gate in `spawn-child-fields.ts` catches an unclassified field;
 * these pins catch the other half — a list that stopped matching what
 * `createAgentState` does (e.g. someone re-adds an explicit assignment and
 * removes the field from the list, so the docs and the behavior diverge).
 */
function markerParent() {
  const parent = getInitialAgentState()
  parent.agentId = 'parent-agent'
  parent.runId = 'parent-run'
  parent.protocolVariant = 'harness'
  parent.protocolFile = 'ECHO.md'
  parent.protocolVersion = '0.2.0'
  parent.protocolStrictMode = true
  parent.protocolSource = 'embedded'
  parent.enforcementMode = 'strict'
  parent.provenanceMode = 'off'
  parent.designContract = {
    id: 'contract-1',
    version: 1,
    tokens: {},
  } as unknown as NonNullable<typeof parent.designContract>
  parent.fsmPhase = 'green'
  parent.iterationCount = 7
  parent.contextTokenCount = 1234
  // Distinct references, so identity proves the value was threaded and not
  // recreated (`provenance`/`echoCompliance` must be SHARED with the child).
  parent.provenance = undefined
  parent.echoCompliance = undefined
  return parent
}

describe('spawn-child field partition (FID-2026-0919-028)', () => {
  it('copies every field classified as inherited onto the child', () => {
    const parent = markerParent()
    const child = createAgentState('forge', template, parent, {})
    const childRecord = child as unknown as Record<string, unknown>

    for (const field of INHERITED_FROM_PARENT) {
      expect(childRecord[field]).toEqual(
        (parent as unknown as Record<string, unknown>)[field],
      )
    }
  })

  it('shares per-run instances instead of recreating them', () => {
    const tracker = { mode: 'warn' } as never
    const provenance = { mode: 'off' } as never
    const parent = markerParent()
    parent.echoCompliance = tracker
    parent.provenance = provenance

    const child = createAgentState('forge', template, parent, {})

    expect(child.echoCompliance).toBe(tracker)
    expect(child.provenance).toBe(provenance)
  })

  it('leaves every by-design field unset on a freshly constructed child', () => {
    const parent = markerParent()
    const child = createAgentState('forge', template, parent, {})
    const childRecord = child as unknown as Record<string, unknown>

    for (const field of Object.keys(NOT_INHERITED_BY_DESIGN)) {
      expect(childRecord[field]).toBeUndefined()
    }
  })

  it('classifies every field the probe categories cover, and nothing twice', () => {
    const probed = [
      ...INHERITED_FROM_PARENT,
      ...CHILD_OWN,
      ...Object.keys(NOT_INHERITED_BY_DESIGN),
    ]
    expect(new Set(probed).size).toBe(probed.length)
    for (const field of probed) {
      expect(classifyAgentStateField(field)).not.toBe('unclassified')
    }
  })

  it('reports an unknown field as unclassified rather than guessing', () => {
    expect(classifyAgentStateField('notARealField')).toBe('unclassified')
    expect(classifyAgentStateField('enforcementMode')).toBe('inherited')
    expect(classifyAgentStateField('agentId')).toBe('child-own')
    expect(classifyAgentStateField('groundingCheckpoint')).toBe('by-design')
  })

  it('keeps every governance field on the inherited list (contract precondition)', () => {
    for (const field of GOVERNANCE_FIELDS) {
      expect(INHERITED_FROM_PARENT).toContain(field)
      expect(classifyAgentStateField(field)).toBe('inherited')
    }
  })

  it('inherits and governs through the same list', () => {
    const parent = markerParent()
    const inherited = inheritFromParent(parent)
    const governance = inheritRunGovernance(parent)

    expect(governance.enforcementMode).toBe(inherited.enforcementMode)
    expect(governance.enforcementMode).toBe('strict')
    expect(governance.designContract).toBe(parent.designContract)
    expect(governance.protocolSource).toBe('embedded')
    expect(governance.provenanceMode).toBe('off')
  })
})
