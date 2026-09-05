import type { MCPConfig } from '../../types/mcp'
import type { ProjectFileContext } from '../../util/file'

// FID-2026-0819-005 Loop 154 (SELF-CORRECT): shared test primitives moved
// verbatim out of agent-runtime.ts so agent-runtime.ts and
// agent-runtime-deps.ts can both import them without a runtime import
// cycle (TEST_AGENT_RUNTIME_IMPL reads these at module-init).

export const emptyMcpServers: Record<string, MCPConfig> = {}

export const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}

/** @deprecated Use mockFileContext */
export const testFileContext: ProjectFileContext = mockFileContext

export const testLogger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

export const testFetch = Object.assign(
  async () => {
    throw new Error('fetch not implemented in test runtime')
  },
  {
    preconnect: async () => {
      throw new Error('fetch.preconnect not implemented in test runtime')
    },
  },
)

export const testClientEnv = {
  NEXT_PUBLIC_CB_ENVIRONMENT: 'test' as const,
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://test.savantcode.com',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.test',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'test-posthog-key',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://test.posthog.com',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://test.stripe.com/portal',
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: undefined,
  NEXT_PUBLIC_WEB_PORT: 3000,
}

export const testCiEnv = {
  CI: undefined,
  GITHUB_ACTIONS: undefined,
  RENDER: undefined,
  IS_PULL_REQUEST: undefined,
  SAVANT_CODE_GITHUB_TOKEN: undefined,
  SAVANT_CODE_API_KEY: 'test-api-key',
}
