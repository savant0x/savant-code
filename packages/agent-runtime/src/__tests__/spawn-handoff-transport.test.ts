import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { describe, expect, it } from 'bun:test'

import {
  createAgentState,
  extractSubagentContextParams,
  executeSubagent,
} from '../tools/handlers/tool/spawn-agent-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'
import {
  batchSpawnRejectionMessage,
  buildInlineSpawnRelay,
  INLINE_ONLY_AGENT_TYPES,
} from '../tools/handlers/tool/spawn-inline-only'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'

const template: AgentTemplate = {
  id: 'verifier',
  displayName: 'Verifier',
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

function governedParent() {
  const parent = getInitialAgentState()
  parent.agentId = 'parent-agent'
  parent.runId = 'parent-run'
  parent.enforcementMode = 'strict'
  parent.protocolSource = 'embedded'
  parent.provenanceMode = 'off'
  parent.designContract = {
    id: 'contract-1',
    version: 1,
    tokens: {},
  } as unknown as NonNullable<typeof parent.designContract>
  return parent
}

function executionParams(parent: ReturnType<typeof governedParent>) {
  const context = extractSubagentContextParams({
    agentState: parent,
    clientEnv: {} as never,
    ciEnv: {} as never,
    getUserInfoFromApiKey: (() => {}) as never,
    fetchAgentFromDatabase: (() => {}) as never,
    startAgentRun: (() => {}) as never,
    finishAgentRun: (() => {}) as never,
    addAgentStep: (() => {}) as never,
    consumeCreditsWithFallback: (() => {}) as never,
    promptAiSdkStream: (() => {}) as never,
    promptAiSdk: (() => {}) as never,
    promptAiSdkStructured: (() => {}) as never,
    databaseAgentCache: {} as never,
    trackEvent: (() => {}) as never,
    logger: {} as never,
    fetch: fetch,
    handleStepsLogChunk: (() => {}) as never,
    requestToolCall: (() => {}) as never,
    requestMcpToolData: (() => {}) as never,
    requestFiles: (() => {}) as never,
    requestOptionalFile: (() => {}) as never,
    sendAction: (() => {}) as never,
    sendSubagentChunk: (() => {}) as never,
    apiKey: 'test-key',
    clientSessionId: 'session',
    fileContext: {} as never,
    localAgentTemplates: {},
    repoId: undefined,
    repoUrl: undefined,
    signal: new AbortController().signal,
    userId: undefined,
    checkpointTurnId: 'turn-1',
    traceWriter: { recordStep: () => {} },
  })
  return context
}

describe('spawn handoff transport (FID-2026-0919-027)', () => {
  describe('child states inherit the run governance configuration', () => {
    it('carries enforcement mode, design contract, protocol source, and provenance mode', () => {
      const parent = governedParent()
      const child = createAgentState('verifier', template, parent, {})

      expect(child.enforcementMode).toBe('strict')
      expect(child.designContract).toBe(parent.designContract)
      expect(child.protocolSource).toBe('embedded')
      expect(child.provenanceMode).toBe('off')
    })

    it('leaves governance undefined when the parent has none (legacy SDK host)', () => {
      const parent = getInitialAgentState()
      const child = createAgentState('verifier', template, parent, {})

      expect(child.enforcementMode).toBeUndefined()
      expect(child.designContract).toBeUndefined()
      expect(child.protocolSource).toBeUndefined()
      expect(child.provenanceMode).toBeUndefined()
    })

    it('rejects a propagation snapshot that drops the parent governance configuration', () => {
      const parent = governedParent()
      const context = executionParams(parent)

      expect(() =>
        executeSubagent({
          ...context,
          propagation: { ...context.propagation, enforcementMode: 'hybrid' },
          agentTemplate: template,
          parentAgentState: parent,
          prompt: '',
          spawnParams: {},
          agentState: createAgentState('verifier', template, parent, {}),
          parentSystemPrompt: '',
          onResponseChunk: () => {},
          ancestorRunIds: [],
          userInputId: 'ui-1',
        } as never),
      ).toThrow('Subagent propagation context does not match parent state.')
    })

    it('rejects a child state constructed without the parent governance configuration', () => {
      const parent = governedParent()
      const context = executionParams(parent)
      const child = createAgentState('verifier', template, parent, {})
      // Simulate the pre-FID child (what the spawn boundary produced before the
      // fix): identity/protocol threaded, governance dropped.
      child.protocolSource = undefined
      child.provenanceMode = undefined
      child.designContract = undefined

      expect(() =>
        executeSubagent({
          ...context,
          agentTemplate: template,
          parentAgentState: parent,
          prompt: '',
          spawnParams: {},
          agentState: child,
          parentSystemPrompt: '',
          onResponseChunk: () => {},
          ancestorRunIds: [],
          userInputId: 'ui-1',
        } as never),
      ).toThrow('Constructed child state does not match propagation context.')
    })
  })

  describe('harness-owned inline agents are not batch-spawnable', () => {
    it('keeps the context-pruner as the only inline-only agent', () => {
      expect([...INLINE_ONLY_AGENT_TYPES]).toEqual(['context-pruner'])
    })

    it('rejects the context-pruner with a reason that names the mechanism', () => {
      const message = batchSpawnRejectionMessage('context-pruner')
      expect(message).toContain('cannot be spawned with spawn_agents')
      expect(message).toContain('change nothing')
      expect(batchSpawnRejectionMessage('verifier')).toBeNull()
    })

    it('refuses the spawn in the handler before any child starts', async () => {
      await expect(
        handleSpawnAgents({
          previousToolCallFinished: Promise.resolve(),
          toolCall: {
            input: { agents: [{ agent_type: 'context-pruner' }] },
          },
          agentState: getInitialAgentState(),
          agentTemplate: template,
        } as never),
      ).rejects.toThrow('cannot be spawned with spawn_agents')
    })

    it('still accepts a normal agent at the same boundary', async () => {
      // Same call shape with a batch-safe agent must get PAST the inline-only
      // gate (it then fails later for the missing test runtime, which is the
      // point: the gate is specific, not a blanket rejection).
      const error = await handleSpawnAgents({
        previousToolCallFinished: Promise.resolve(),
        toolCall: { input: { agents: [{ agent_type: 'scout' }] } },
        agentState: getInitialAgentState(),
        agentTemplate: template,
      } as never).then(
        () => null,
        (thrown: unknown) => thrown as Error,
      )

      expect(error?.message ?? '').not.toContain(
        'cannot be spawned with spawn_agents',
      )
    })
  })

  describe('inline spawn relay', () => {
    it('relays the constant for a harness-owned inline agent', () => {
      expect(
        buildInlineSpawnRelay({
          agentType: 'context-pruner',
          outputMode: 'last_message',
          output: { type: 'lastMessage', value: ['summary'] },
        }),
      ).toEqual({ message: 'Agent spawned.' })
    })

    it('relays a structured_output child artifact across the boundary', () => {
      expect(
        buildInlineSpawnRelay({
          agentType: 'thinker',
          outputMode: 'structured_output',
          output: { type: 'structuredOutput', value: { answer: 42 } },
        }),
      ).toEqual({
        message: 'Agent spawned.',
        output: { type: 'structuredOutput', value: { answer: 42 } },
      })
    })

    it('keeps the constant for a last_message child (its turn is already in the swapped history)', () => {
      expect(
        buildInlineSpawnRelay({
          agentType: 'verifier',
          outputMode: 'last_message',
          output: { type: 'lastMessage', value: ['verdict'] },
        }),
      ).toEqual({ message: 'Agent spawned.' })
    })
  })
})
