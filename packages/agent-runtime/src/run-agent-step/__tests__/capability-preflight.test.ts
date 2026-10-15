import { createTestAgentRuntimeParams } from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { userMessage } from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { extractSubagentContextParams } from '../../tools/handlers/tool/spawn-agent-utils'
import { withCapabilityPreflight } from '../capability-preflight'
import { createLoopContext } from '../loop-context'

describe('FID-019 preflight reaches the planning context', () => {
  test('client availability is delivered before planning and refreshed on resume', async () => {
    const runtime = createTestAgentRuntimeParams()
    const agentTemplate = {
      ...runtime.agentTemplate,
      toolNames: ['code_search', 'end_turn'],
    }
    let calls = 0
    const agentState = getInitialAgentState()
    const params = {
      ...runtime,
      agentTemplate,
      agentState,
      agentType: agentTemplate.id,
      clientSessionId: 'preflight-session',
      userInputId: 'preflight-input',
      userId: undefined,
      fingerprintId: 'fixture',
      repoId: undefined,
      repoUrl: undefined,
      ancestorRunIds: [],
      prompt: 'Find the implementation',
      spawnParams: undefined,
      signal: new AbortController().signal,
      probeClientCapabilities: async (tools: readonly string[]) => {
        expect(tools).toEqual(['code_search'])
        calls += 1
        return [
          {
            capability: 'code_search',
            state: 'unavailable' as const,
            reason: calls === 1 ? 'binary missing' : 'binary changed',
            action: 'Repair the configured binary.',
          },
        ]
      },
    }
    const first = await createLoopContext({
      params,
      agentState,
      agentType: agentTemplate.id,
    })
    expect(first.ok).toBe(true)
    const notices = () =>
      agentState.messageHistory.filter((message) =>
        message.tags?.includes('CAPABILITY_PREFLIGHT'),
      )
    expect(notices()).toHaveLength(1)
    expect(JSON.stringify(notices())).toContain('binary missing')
    const firstSystem = agentState.systemPrompt
    await createLoopContext({ params, agentState, agentType: agentTemplate.id })
    expect(calls).toBe(2)
    expect(notices()).toHaveLength(1)
    expect(JSON.stringify(notices())).toContain('binary changed')
    expect(JSON.stringify(notices())).not.toContain('binary missing')
    expect(agentState.systemPrompt).toBe(firstSystem)
  })

  test('unused tools are not probed, and stale inherited notices are removed', async () => {
    const result = await withCapabilityPreflight({
      messages: [
        userMessage({ content: 'stale', tags: ['CAPABILITY_PREFLIGHT'] }),
      ],
      tools: ['read_files'],
      probeClientCapabilities: async () => {
        throw new Error('must not probe')
      },
    })
    expect(result).toEqual([])
  })

  test('offline research reports policy and never claims network availability', async () => {
    const result = await withCapabilityPreflight({
      messages: [],
      tools: ['web_search', 'read_docs'],
      permissionMode: 'safe',
    })
    const text = JSON.stringify(result)
    expect(text).toContain('Offline permission mode')
    expect(text).not.toContain('Configured providers')
    expect(result).toHaveLength(1)
  })

  test('research inventory exposes key names, never keys or successful searches', async () => {
    const previous = process.env.SERPER_API_KEY
    process.env.SERPER_API_KEY = 'secret-fixture-value'
    try {
      const result = await withCapabilityPreflight({
        messages: [],
        tools: ['web_search'],
      })
      const text = JSON.stringify(result)
      expect(text).toContain('SERPER_API_KEY')
      expect(text).toContain('keyless fallback configured')
      expect(text).toContain('unverified until a request completes')
      expect(text).not.toContain('secret-fixture-value')
    } finally {
      if (previous === undefined) delete process.env.SERPER_API_KEY
      else process.env.SERPER_API_KEY = previous
    }
  })

  test('a failed client probe is advisory and its raw error stays private', async () => {
    const result = await withCapabilityPreflight({
      messages: [],
      tools: ['code_search'],
      probeClientCapabilities: async () => {
        throw new Error('secret-fixture-value')
      },
    })
    expect(JSON.stringify(result)).toContain('code_search: unverified')
    expect(JSON.stringify(result)).not.toContain('secret-fixture-value')
  })

  test('a client that never completes cannot block planning indefinitely', async () => {
    const result = await withCapabilityPreflight({
      messages: [],
      tools: ['code_search'],
      probeClientCapabilities: () => new Promise(() => {}),
    })
    expect(JSON.stringify(result)).toContain('code_search: unverified')
  })

  test('both spawn paths receive the same client callback', () => {
    const runtime = createTestAgentRuntimeParams()
    const probeClientCapabilities = async () => []
    const child = extractSubagentContextParams({
      ...runtime,
      probeClientCapabilities,
      clientSessionId: 'fixture',
      repoId: undefined,
      repoUrl: undefined,
      userId: undefined,
      signal: new AbortController().signal,
    })
    expect(child.probeClientCapabilities).toBe(probeClientCapabilities)
  })
})
