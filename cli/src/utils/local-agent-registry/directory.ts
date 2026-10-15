import fs from 'fs'
import path from 'path'

import { getProjectRoot } from '../../project-files'
import { getSelectedSavantFreeModel } from '../../state/savant-free-model-store'
import { IS_SAVANT_FREE, type AgentMode } from '../constants'
import { getAgentIdForMode } from '../savant-free-agent-selection'
import {
  getBundledAgents,
  getBundledAgentsAsLocalInfo,
  getUserAgentsAsLocalInfo,
} from './init'
import { AGENTS_DIR_NAME, agentRegistryState } from './state'

import type { LocalAgentInfo } from './state'

// ============================================================================
// Directory finding
// ============================================================================

export const findAgentsDirectory = (): string | null => {
  if (
    agentRegistryState.cachedAgentsDir &&
    fs.existsSync(agentRegistryState.cachedAgentsDir)
  ) {
    return agentRegistryState.cachedAgentsDir
  }

  const projectRoot = getProjectRoot() || process.cwd()
  if (projectRoot) {
    const rootCandidate = path.join(projectRoot, AGENTS_DIR_NAME)
    if (
      fs.existsSync(rootCandidate) &&
      fs.statSync(rootCandidate).isDirectory()
    ) {
      agentRegistryState.cachedAgentsDir = rootCandidate
      return agentRegistryState.cachedAgentsDir
    }
  }

  let currentDir = process.cwd()
  const filesystemRoot = path.parse(currentDir).root

  while (true) {
    const candidate = path.join(currentDir, AGENTS_DIR_NAME)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      agentRegistryState.cachedAgentsDir = candidate
      return agentRegistryState.cachedAgentsDir
    }

    if (currentDir === filesystemRoot) {
      break
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  agentRegistryState.cachedAgentsDir = null
  return null
}

// ============================================================================
// Agent loading - LocalAgentInfo (lightweight, for UI/listing)
// ============================================================================

// Cache keyed by agent mode (or 'all' for no filtering)
/**
 * Load local agents for display in the '@' menu.
 *
 * @param currentAgentMode - If provided, filters bundled agents to only include
 *   subagents of the current mode's agent (e.g., savant's spawnableAgents for DEFAULT mode).
 *   User's local agents from .agents/ are always included regardless of mode.
 */
export const loadLocalAgents = (
  currentAgentMode?: AgentMode,
): LocalAgentInfo[] => {
  const selectedSavantFreeModel = IS_SAVANT_FREE
    ? getSelectedSavantFreeModel()
    : null
  const cacheKey = selectedSavantFreeModel
    ? `${currentAgentMode ?? 'all'}:${selectedSavantFreeModel}`
    : (currentAgentMode ?? 'all')
  const cached = agentRegistryState.cachedAgentsByMode.get(cacheKey)
  if (cached) {
    return cached
  }

  // Get bundled agents - these are the default SavantCode agents
  // compiled into the CLI binary at build time
  const bundledAgentsInfo = getBundledAgentsAsLocalInfo()
  const bundledAgents = getBundledAgents()

  // Filter bundled agents to only include subagents of the current mode's agent
  let filteredBundledAgents: LocalAgentInfo[]
  if (currentAgentMode) {
    const currentAgentId = getAgentIdForMode(currentAgentMode)
    const currentAgentDef = bundledAgents[currentAgentId]
      ? bundledAgents[currentAgentId]
      : undefined
    const spawnableAgentIds = new Set(currentAgentDef?.spawnableAgents ?? [])

    // Only include bundled agents that are in the spawnableAgents list
    filteredBundledAgents = bundledAgentsInfo.filter((agent) =>
      spawnableAgentIds.has(agent.id),
    )
  } else {
    filteredBundledAgents = bundledAgentsInfo
  }

  const results: LocalAgentInfo[] = [...filteredBundledAgents]
  const includedIds = new Set(filteredBundledAgents.map((a) => a.id))

  // Get user agents from the SDK-loaded cache
  // User agents are always included (not filtered by mode) and can override bundled agents
  const userAgents = getUserAgentsAsLocalInfo()

  // Merge user agents - they override bundled agents with same ID
  // and are always included regardless of mode filtering
  for (const userAgent of userAgents) {
    if (includedIds.has(userAgent.id)) {
      // Replace bundled agent with user's version
      const idx = results.findIndex((a) => a.id === userAgent.id)
      if (idx !== -1) {
        results[idx] = userAgent
      }
    } else {
      results.push(userAgent)
      includedIds.add(userAgent.id)
    }
  }

  const sorted = results.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'en'),
  )

  agentRegistryState.cachedAgentsByMode.set(cacheKey, sorted)
  return sorted
}
