// Shared fixtures for the getAgentPrompt test family.
// Sibling of the Loop-339 decomposition (suite files all import these).
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { mock } from 'bun:test'

import type { AgentTemplate } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/** Create a mock logger using bun:test mock() for better test consistency */
export const createMockLogger = () => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
})

export const createMockFileContext = (): ProjectFileContext => ({
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
})

export const createMockAgentState = (agentType: string): AgentState => ({
  agentId: 'test-agent-id',
  agentType,
  runId: 'test-run-id',
  parentId: undefined,
  messageHistory: [],
  output: undefined,
  stepsRemaining: 10,
  creditsUsed: 0,
  directCreditsUsed: 0,
  childRunIds: [],
  ancestorRunIds: [],
  contextTokenCount: 0,
  agentContext: {},
  subagents: [],
  systemPrompt: '',
  toolDefinitions: {},
})

export const createMockAgentTemplate = (
  overrides: Partial<AgentTemplate> = {},
): AgentTemplate => ({
  id: 'test-agent',
  displayName: 'Test Agent',
  model: 'gpt-4o-mini',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: emptyMcpServers,
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: 'Test instructions',
  stepPrompt: '',
  ...overrides,
})
