import { testLogger } from '@savant-code/common/testing/fixtures/agent-runtime'
import { describe, expect, it, mock, spyOn } from 'bun:test'

import * as agentRegistry from '../templates/agent-registry'
import { validateSpawnAgentsInput } from '../tools/tool-executor/spawn-validation'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

function template(id: string): AgentTemplate {
  return {
    id,
    displayName: id,
    model: 'test/model',
    inputSchema: {},
    outputMode: 'last_message',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: [],
    spawnableAgents: [],
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  }
}

const plan: JSONValue = {
  objective: 'Answer the question',
  cancellation_id: 'turn-1',
  snapshot_sha256: '0'.repeat(64),
  sources: [{ path: 'src/a.ts', sha256: '0'.repeat(64) }],
}

function errorsOf(chunks: (string | PrintModeEvent)[]): string[] {
  return chunks.flatMap((chunk) =>
    typeof chunk === 'object' && chunk.type === 'error' ? [chunk.message] : [],
  )
}

describe('research plan pre-validation (FID-2026-1017-004)', () => {
  it('rejects the whole plan-carrying call instead of filtering invalid agents', async () => {
    spyOn(agentRegistry, 'getAgentTemplate').mockImplementation(
      async ({ agentId }) => (agentId === 'scout' ? template('scout') : null),
    )
    const chunks: (string | PrintModeEvent)[] = []

    const result = await validateSpawnAgentsInput({
      toolName: 'spawn_agents',
      effectiveInput: {
        agents: [{ agent_type: 'scout' }, { agent_type: 'missing' }],
        plan,
      },
      agentTemplate: template('base'),
      localAgentTemplates: {},
      logger: testLogger,
      onResponseChunk: (chunk) => chunks.push(chunk),
    })

    expect(result.rejected).toBe(true)
    const messages = errorsOf(chunks)
    expect(messages[0]).toContain('whole call was rejected')
    expect(messages[0]).toContain('missing')
    mock.restore()
  })

  it('keeps the existing filter behavior for a spawn without a plan', async () => {
    spyOn(agentRegistry, 'getAgentTemplate').mockImplementation(
      async ({ agentId }) => (agentId === 'scout' ? template('scout') : null),
    )
    const chunks: (string | PrintModeEvent)[] = []

    const result = await validateSpawnAgentsInput({
      toolName: 'spawn_agents',
      effectiveInput: {
        agents: [{ agent_type: 'scout' }, { agent_type: 'missing' }],
      },
      agentTemplate: template('base'),
      localAgentTemplates: {},
      logger: testLogger,
      onResponseChunk: (chunk) => chunks.push(chunk),
    })

    expect(result.rejected).toBe(false)
    const agents = result.input.agents
    expect(Array.isArray(agents)).toBe(true)
    if (!Array.isArray(agents)) return
    expect(agents).toEqual([{ agent_type: 'scout' }])
    expect(errorsOf(chunks)[0]).toContain('Proceeding with valid agents only')
    mock.restore()
  })
})
