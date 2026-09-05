// Shared fixtures for the Agent Registry test family.
// Sibling of the Loop-341 decomposition (suite files all import these).
// Holds the per-test `agentRuntimeImpl` / `mockFileContext` state and the
// validation-module spies; suites access the impl via getImpl()/setImpl()
// so tests that override `fetchAgentFromDatabase` keep their semantics.
import * as validationModule from '@savant-code/common/templates/agent-validation'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { afterEach, beforeEach, spyOn, mock } from 'bun:test'

import type { AgentTemplate } from '../types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { DynamicAgentTemplate } from '@savant-code/common/types/dynamic-agent-template'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export type AgentRuntimeImpl = AgentRuntimeDeps & AgentRuntimeScopedDeps

// Create mock static templates that will be used by the agent registry
export const mockStaticTemplates: Record<string, AgentTemplate> = {
  base: {
    id: 'base',
    displayName: 'Base Agent',
    systemPrompt: 'Test',
    instructionsPrompt: 'Test',
    stepPrompt: 'Test',
    mcpServers: emptyMcpServers,
    toolNames: ['end_turn'],
    spawnableAgents: [],
    outputMode: 'last_message',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    model: 'anthropic/claude-4-sonnet-20250522',
    spawnerPrompt: 'Test',
    inputSchema: {},
  },
  file_picker: {
    id: 'scout',
    displayName: 'File Picker',
    systemPrompt: 'Test',
    instructionsPrompt: 'Test',
    stepPrompt: 'Test',
    mcpServers: emptyMcpServers,
    toolNames: ['find_files'],
    spawnableAgents: [],
    outputMode: 'last_message',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    model: 'google/gemini-2.5-flash',
    spawnerPrompt: 'Test',
    inputSchema: {},
  },
}

const state: { impl: AgentRuntimeImpl; fileContext: ProjectFileContext } = {
  impl: undefined as unknown as AgentRuntimeImpl,
  fileContext: undefined as unknown as ProjectFileContext,
}

export function getImpl(): AgentRuntimeImpl {
  return state.impl
}

export function setImpl(next: AgentRuntimeImpl): void {
  state.impl = next
}

export function getFileContext(): ProjectFileContext {
  return state.fileContext
}

/** Register the family's per-test lifecycle at the caller's describe scope. */
export function registerAgentRegistryLifecycle(): void {
  beforeEach(async () => {
    state.impl = {
      ...TEST_AGENT_RUNTIME_IMPL,
    }

    state.impl.databaseAgentCache.clear()

    state.fileContext = getStubProjectFileContext()

    // Spy on validation functions
    spyOn(validationModule, 'validateAgents').mockImplementation(
      ({
        agentTemplates = {},
        logger,
      }: {
        agentTemplates?: Record<string, object>
        logger: Logger
      }) => {
        // Start with static templates (simulating the real behavior)
        const templates: Record<string, AgentTemplate> = {
          ...mockStaticTemplates,
        }
        const validationErrors: any[] = []

        for (const key in agentTemplates) {
          const template = agentTemplates[key] as DynamicAgentTemplate
          if (template.id === 'invalid-agent') {
            validationErrors.push({
              filePath: key,
              message: 'Invalid agent configuration',
            })
            // Don't add invalid agents to templates (this simulates validation failure)
          } else {
            templates[template.id] = template as AgentTemplate
          }
        }

        return {
          templates,
          dynamicTemplates: agentTemplates as Record<
            string,
            DynamicAgentTemplate
          >,
          validationErrors,
        }
      },
    )

    spyOn(validationModule, 'validateSingleAgent').mockImplementation(
      ({ template }: { template: object; filePath?: string }) => {
        const typedTemplate = template as DynamicAgentTemplate
        // Check for malformed agents (missing required fields)
        if (
          typedTemplate.id === 'malformed-agent' ||
          !typedTemplate.systemPrompt ||
          !typedTemplate.instructionsPrompt ||
          !typedTemplate.stepPrompt
        ) {
          return {
            success: false,
            error: 'Invalid agent configuration - missing required fields',
          }
        }
        return {
          success: true,
          agentTemplate: typedTemplate as AgentTemplate,
        }
      },
    )
  })

  afterEach(() => {
    mock.restore()
  })
}
