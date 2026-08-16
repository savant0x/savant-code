import {
  MAX_SUBAGENT_DEPTH,
  MAX_SUBAGENT_FAN_OUT,
} from '@savant-code/common/constants/agents'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { describe, expect, it } from 'bun:test'

import {
  createAgentState,
  extractSubagentContextParams,
  withParentModel,
} from '../tools/handlers/tool/spawn-agent-utils'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'

const template: AgentTemplate = {
  id: 'child',
  displayName: 'Child',
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

describe('subagent propagation contract', () => {
  it('copies identity, ancestry, protocol, and runtime-only propagation context', () => {
    const parent = getInitialAgentState()
    parent.agentId = 'parent-agent'
    parent.runId = 'parent-run'
    parent.ancestorRunIds = ['root-run']
    parent.protocolVariant = 'single-agent'
    parent.protocolFile = 'dev/echo.md'
    parent.protocolVersion = 'test-single-agent'
    parent.protocolStrictMode = true

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

    expect(context.propagation).toEqual({
      parentAgentId: 'parent-agent',
      parentRunId: 'parent-run',
      ancestorRunIds: ['root-run'],
      protocolVariant: 'single-agent',
      protocolFile: 'dev/echo.md',
      protocolVersion: 'test-single-agent',
      protocolStrictMode: true,
      checkpointTurnId: 'turn-1',
      hasTraceWriter: true,
    })

    const child = createAgentState('child', template, parent, {})
    expect(child.parentId).toBe('parent-agent')
    expect(child.ancestorRunIds).toEqual(['root-run', 'parent-run'])
    expect(child.protocolVariant).toBe('single-agent')
    expect(child.protocolFile).toBe('dev/echo.md')
  })

  it('rejects excessive ancestry before creating a child state', () => {
    const parent = getInitialAgentState()
    parent.ancestorRunIds = Array.from(
      { length: MAX_SUBAGENT_DEPTH },
      (_, index) => `ancestor-${index}`,
    )

    expect(() => createAgentState('child', template, parent, {})).toThrow(
      `Subagent depth limit exceeded (maximum ${MAX_SUBAGENT_DEPTH} ancestors).`,
    )
  })

  it('publishes bounded fan-out constants for handler enforcement', () => {
    expect(MAX_SUBAGENT_FAN_OUT).toBe(32)
    expect(MAX_SUBAGENT_DEPTH).toBe(8)
  })

  it('withParentModel inherits the parent model and preserves the child data_collection deny flag (B-06)', () => {
    const parent: AgentTemplate = {
      ...template,
      id: 'parent',
      model: 'parent/model',
      providerOptions: {},
    }
    const child: AgentTemplate = {
      ...template,
      id: 'child',
      model: 'child/hardcoded',
      providerOptions: { data_collection: 'deny' },
    }

    const merged = withParentModel(child, parent)
    expect(merged.model).toBe('parent/model')
    expect(merged.providerOptions).toEqual({ data_collection: 'deny' })
  })

  it('withParentModel keeps parent providerOptions when the child sets none', () => {
    const parent: AgentTemplate = {
      ...template,
      id: 'parent',
      model: 'parent/model',
      providerOptions: { data_collection: 'deny' },
    }
    const child: AgentTemplate = {
      ...template,
      id: 'child',
      model: 'child/hardcoded',
    }

    const merged = withParentModel(child, parent)
    expect(merged.model).toBe('parent/model')
    expect(merged.providerOptions).toEqual({ data_collection: 'deny' })
  })
})
