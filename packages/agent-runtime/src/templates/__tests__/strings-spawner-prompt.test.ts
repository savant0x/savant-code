// getAgentPrompt test family — spawnerPrompt inclusion in instructionsPrompt.
// Sibling of the Loop-339 decomposition (shared fixtures in
// ./strings-test-harness). The nested describe titles mirror the original
// monolith's structure verbatim.
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { describe, test, expect } from 'bun:test'

import { getAgentPrompt } from '../strings'
import {
  createMockAgentState,
  createMockAgentTemplate,
  createMockFileContext,
  createMockLogger,
} from './strings-test-harness'

import type { AgentTemplate } from '../types'

describe('getAgentPrompt', () => {
  describe('spawnerPrompt inclusion in instructionsPrompt', () => {
    test('includes spawnerPrompt for each spawnable agent with spawnerPrompt defined', async () => {
      const filePickerTemplate = createMockAgentTemplate({
        id: 'scout',
        displayName: 'File Picker',
        spawnerPrompt: 'Spawn to find relevant files in a codebase',
      })

      const codeSearcherTemplate = createMockAgentTemplate({
        id: 'code-searcher',
        displayName: 'Code Searcher',
        spawnerPrompt: 'Mechanically runs multiple code search queries',
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['scout', 'code-searcher'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        scout: filePickerTemplate,
        'code-searcher': codeSearcherTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('You can spawn the following agents:')
      expect(result).toContain(
        '- scout: Spawn to find relevant files in a codebase',
      )
      expect(result).toContain(
        '- code-searcher: Mechanically runs multiple code search queries',
      )
    })

    test('includes only agent name when spawnerPrompt is not defined', async () => {
      const agentWithoutSpawnerPrompt = createMockAgentTemplate({
        id: 'no-prompt-agent',
        displayName: 'No Prompt Agent',
        // spawnerPrompt is not defined
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['no-prompt-agent'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        'no-prompt-agent': agentWithoutSpawnerPrompt,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('You can spawn the following agents:')
      expect(result).toContain('- no-prompt-agent')
      // Should not have a colon after the agent name when there's no spawnerPrompt
      expect(result).not.toContain('- no-prompt-agent:')
    })

    test('handles mix of agents with and without spawnerPrompt', async () => {
      const agentWithPrompt = createMockAgentTemplate({
        id: 'with-prompt',
        displayName: 'Agent With Prompt',
        spawnerPrompt: 'This agent has a description',
      })

      const agentWithoutPrompt = createMockAgentTemplate({
        id: 'without-prompt',
        displayName: 'Agent Without Prompt',
        // spawnerPrompt is not defined
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['with-prompt', 'without-prompt'],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        'with-prompt': agentWithPrompt,
        'without-prompt': agentWithoutPrompt,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).toContain('- with-prompt: This agent has a description')
      expect(result).toContain('- without-prompt')
      expect(result).not.toContain('- without-prompt:')
    })

    test('does not include spawnable agents section when no spawnable agents defined', async () => {
      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: [],
        instructionsPrompt: 'Main agent instructions.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
      }

      const result = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'instructionsPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(result).toBeDefined()
      expect(result).not.toContain('You can spawn the following agents:')
    })

    test('does not include spawnable agents for non-instructionsPrompt types', async () => {
      const filePickerTemplate = createMockAgentTemplate({
        id: 'scout',
        displayName: 'File Picker',
        spawnerPrompt: 'Spawn to find relevant files in a codebase',
      })

      const mainAgentTemplate = createMockAgentTemplate({
        id: 'main-agent',
        displayName: 'Main Agent',
        spawnableAgents: ['scout'],
        systemPrompt: 'System prompt content.',
        stepPrompt: 'Step prompt content.',
      })

      const agentTemplates: Record<string, AgentTemplate> = {
        'main-agent': mainAgentTemplate,
        scout: filePickerTemplate,
      }

      // Test systemPrompt - should not include spawnable agents
      const systemResult = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'systemPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(systemResult).toBeDefined()
      expect(systemResult).not.toContain('You can spawn the following agents:')

      // Test stepPrompt - should not include spawnable agents
      const stepResult = await getAgentPrompt({
        agentTemplate: mainAgentTemplate,
        promptType: { type: 'stepPrompt' },
        fileContext: createMockFileContext(),
        agentState: createMockAgentState('main-agent'),
        agentTemplates,
        additionalToolDefinitions: async () => ({}),
        logger: createMockLogger(),
        apiKey: TEST_AGENT_RUNTIME_IMPL.apiKey,
        databaseAgentCache: TEST_AGENT_RUNTIME_IMPL.databaseAgentCache,
        fetchAgentFromDatabase: TEST_AGENT_RUNTIME_IMPL.fetchAgentFromDatabase,
      })

      expect(stepResult).toBeDefined()
      expect(stepResult).not.toContain('You can spawn the following agents:')
    })
  })
})
