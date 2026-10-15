import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  loadLocalAgents as sdkLoadLocalAgents,
  loadMCPConfigSync,
} from '@savant-code/sdk'

import { AGENTS_DIR_NAME, agentRegistryState } from './state'
import * as bundledAgentsModule from '../../agents/bundled-agents.generated'
import { getProjectRoot } from '../../project-files'
import { logger } from '../logger'

import type { LocalAgentInfo } from './state'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

/**
 * Initialize the agent registry by loading user agents via the SDK.
 * This must be called at CLI startup before any sync agent loading functions.
 *
 * Agents are loaded from:
 * - {cwd}/.agents (project)
 * - {cwd}/../.agents (parent, e.g. monorepo root)
 * - ~/.agents (global, user's home directory)
 *
 * Later directories take precedence, so project agents override global ones.
 */
export async function initializeAgentRegistry(): Promise<void> {
  try {
    // Let SDK load from all default directories (cwd, parent, home)
    agentRegistryState.userAgentsCache = await sdkLoadLocalAgents({
      verbose: false,
    })
    // Build ID-to-filepath map by scanning all agent directories
    agentRegistryState.userAgentFilePaths = buildAgentFilePathMap(
      getDefaultAgentDirs(),
    )
  } catch (error) {
    // Fall back to empty cache if SDK loading fails, but log a warning
    logger.warn(
      { error },
      'Failed to load user agents from .agents directories',
    )
    agentRegistryState.userAgentsCache = {}
    agentRegistryState.userAgentFilePaths = new Map()
  }

  // Load MCP config from mcp.json files in .agents directories
  try {
    const mcpConfig = loadMCPConfigSync({ verbose: false })
    agentRegistryState.mcpServersCache = mcpConfig.mcpServers
    if (Object.keys(agentRegistryState.mcpServersCache).length > 0) {
      logger.debug(
        {
          mcpServers: Object.keys(agentRegistryState.mcpServersCache),
          source: mcpConfig._sourceFilePath,
        },
        '[agents] Loaded MCP servers from mcp.json',
      )
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to load MCP config from .agents directories')
    agentRegistryState.mcpServersCache = {}
  }

  // Fallback: if the generated bundled-agents file is missing OR any known
  // critical agent is absent from it, load agent definitions directly from
  // the agents/ directory at runtime. This ensures all built-in agents
  // (detective, scout, forge, etc.) are always available, even in dev mode
  // before prebuild:agents has run, or when a specific agent's import failed
  // during the prebuild step (silently skipping that agent).
  const REQUIRED_AGENT_IDS = [
    'detective',
    'scout',
    'forge',
    'thinker',
    'verifier',
    'recorder',
    'basher',
    'researcher-web',
    'researcher-docs',
    'context-pruner',
    'scribe',
    'tmux-cli',
    'browser-use',
  ]
  const currentBundledAgents = getBundledAgents()
  const currentBundledIds = new Set(Object.keys(currentBundledAgents))
  const missingRequiredAgents = REQUIRED_AGENT_IDS.some(
    (id) => !currentBundledIds.has(id),
  )
  if (Object.keys(currentBundledAgents).length === 0 || missingRequiredAgents) {
    try {
      const projectRoot = getProjectRoot() || process.cwd()
      const agentsDir = path.join(projectRoot, 'agents')
      if (fs.existsSync(agentsDir) && fs.statSync(agentsDir).isDirectory()) {
        const fallbackAgents = await sdkLoadLocalAgents({
          agentsPath: agentsDir,
          verbose: false,
        })
        if (Object.keys(fallbackAgents).length > 0) {
          agentRegistryState.bundledAgentsFallbackCache = fallbackAgents
          logger.debug(
            {
              count: Object.keys(agentRegistryState.bundledAgentsFallbackCache)
                .length,
            },
            '[agents] Loaded bundled agents from agents/ directory (runtime fallback)',
          )
        }
      }
    } catch (error) {
      logger.warn(
        { error },
        'Failed to load bundled agents from agents/ directory (runtime fallback)',
      )
      agentRegistryState.bundledAgentsFallbackCache = {}
    }
  }
}

/**
 * Get default agent directories to scan.
 * Matches the SDK's getDefaultAgentDirs() to ensure consistency.
 */
const getDefaultAgentDirs = (): string[] => {
  const cwdAgents = path.join(process.cwd(), AGENTS_DIR_NAME)
  const parentAgents = path.join(process.cwd(), '..', AGENTS_DIR_NAME)
  const homeAgents = path.join(os.homedir(), AGENTS_DIR_NAME)
  return [cwdAgents, parentAgents, homeAgents]
}

/**
 * Scan agent directories and build a map from agent ID to source file path.
 * Uses regex to extract IDs from files without requiring module loading.
 * Later directories in the list take precedence (can override earlier ones).
 */
const buildAgentFilePathMap = (agentsDirs: string[]): Map<string, string> => {
  const idToPath = new Map<string, string>()
  const idRegex = /id\s*:\s*['"`]([^'"`]+)['"`]/i

  const scanDirectory = (dir: string): void => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanDirectory(fullPath)
          continue
        }
        if (
          !entry.isFile() ||
          !entry.name.endsWith('.ts') ||
          entry.name.endsWith('.d.ts') ||
          entry.name.endsWith('.test.ts')
        ) {
          continue
        }
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          const match = content.match(idRegex)
          if (match?.[1]) {
            idToPath.set(match[1], fullPath)
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  // Scan all directories - later directories override earlier ones
  for (const agentsDir of agentsDirs) {
    scanDirectory(agentsDir)
  }
  return idToPath
}

/**
 * Get user agents from the cache as LocalAgentInfo[]
 */
export const getUserAgentsAsLocalInfo = (): LocalAgentInfo[] => {
  return Object.values(agentRegistryState.userAgentsCache).map((def) => ({
    id: def.id,
    displayName: def.displayName || def.id,
    filePath: agentRegistryState.userAgentFilePaths.get(def.id) || '',
  }))
}

/**
 * Get user agents from the cache as AgentDefinition[]
 */
export const getUserAgentDefinitions = (): AgentDefinition[] => {
  return Object.values(agentRegistryState.userAgentsCache) as AgentDefinition[]
}

// ============================================================================
// Bundled agents loading (generated at build time by prebuild-agents.ts)
// ============================================================================

export const getBundledAgents = (): Record<string, AgentDefinition> => {
  // Merge generated bundled agents with runtime fallback cache.
  // Generated agents take precedence; fallback fills in any gaps
  // (e.g., when the generated file is missing in dev mode).
  const generated = bundledAgentsModule.bundledAgents ?? {}
  if (Object.keys(agentRegistryState.bundledAgentsFallbackCache).length === 0) {
    return generated
  }
  const merged: Record<string, AgentDefinition> = {
    ...agentRegistryState.bundledAgentsFallbackCache,
  }
  for (const [id, def] of Object.entries(generated)) {
    merged[id] = def
  }
  return merged
}

export const getBundledAgentsAsLocalInfo = (): LocalAgentInfo[] => {
  const fromGenerated =
    bundledAgentsModule.getBundledAgentsAsLocalInfo?.() ?? []
  const fromFallback = Object.values(
    agentRegistryState.bundledAgentsFallbackCache,
  ).map((def) => ({
    id: def.id,
    displayName: def.displayName || def.id,
    filePath: '[agents/]',
    isBundled: true,
  }))
  // Merge: generated takes precedence, fallback fills gaps
  const generatedIds = new Set(fromGenerated.map((a) => a.id))
  return [
    ...fromGenerated,
    ...fromFallback.filter((a) => !generatedIds.has(a.id)),
  ]
}
