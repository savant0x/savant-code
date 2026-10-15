import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { MCPConfig } from '@savant-code/common/types/mcp'

// ============================================================================
// Constants and types
// ============================================================================

export const AGENTS_DIR_NAME = '.agents'

/** Known orchestrator agent IDs that receive auto-injected user agents and MCP servers. */
export const ORCHESTRATOR_IDS = new Set([
  'savant',
  'savant-free',
  'savant-analyze',
])

export interface LocalAgentInfo {
  id: string
  displayName: string
  filePath: string
  /** True if this is a bundled SavantCode agent (not user-created) */
  isBundled?: boolean
}

// ============================================================================

// ============================================================================
// Shared mutable state (all modules read/write through this object)
// ============================================================================

export const agentRegistryState = {
  userAgentsCache: {} as Record<string, AgentDefinition>,
  userAgentFilePaths: new Map<string, string>(),
  mcpServersCache: {} as Record<string, MCPConfig>,
  bundledAgentsFallbackCache: {} as Record<string, AgentDefinition>,
  cachedAgentsDir: null as string | null,
  cachedAgentsByMode: new Map<string, LocalAgentInfo[]>(),
}

// ============================================================================
// Testing utilities
// ============================================================================

/**
 * Clear cached agent listings. Intended for test scenarios that need to
 * re-evaluate the filesystem state between cases.
 */
export const __resetLocalAgentRegistryForTests = (): void => {
  agentRegistryState.cachedAgentsByMode.clear()
  agentRegistryState.cachedAgentsDir = null
  agentRegistryState.userAgentsCache = {}
  agentRegistryState.userAgentFilePaths = new Map()
  agentRegistryState.mcpServersCache = {}
  agentRegistryState.bundledAgentsFallbackCache = {}
}

/**
 * Get the currently loaded MCP servers from mcp.json.
 * Useful for debugging and displaying loaded MCP configuration.
 */
export const getLoadedMCPServers = (): Record<string, MCPConfig> => {
  return { ...agentRegistryState.mcpServersCache }
}
