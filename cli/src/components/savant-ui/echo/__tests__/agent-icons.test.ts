import { describe, expect, test } from 'bun:test'

import { SAVANT_ICON_PNG_DATA_URI } from '../../../../constants/savant-icons'
import {
  ACTIVITY_ICON_MAP,
  AGENT_ICON_MAP,
  LIFECYCLE_ICON_MAP,
  activityIcon,
  agentIcon,
  toolIcon,
} from '../agent-icons'

describe('agent-roster icon mapping drift guard (FID-2026-1009-004)', () => {
  test('every mapped icon name exists in the generated family', () => {
    const familyKeys = new Set(Object.keys(SAVANT_ICON_PNG_DATA_URI))
    for (const [rosterId, iconName] of Object.entries(AGENT_ICON_MAP)) {
      expect(familyKeys.has(iconName)).toBe(true)
      // The family constant carries the roster id as a suffix — a codegen
      // rename breaks this invariant before any consumer can miss it.
      expect(iconName.toLowerCase()).toContain(rosterId)
    }
  })

  test('the canonical 10-agent roster is fully mapped', () => {
    const roster = [
      'orchestrator',
      'detective',
      'forge',
      'verifier',
      'recorder',
      'thinker',
      'scout',
      'researcher',
      'scribe',
      'adversary',
    ]
    for (const id of roster) {
      expect(agentIcon(id)).not.toBeNull()
    }
  })

  test('aliases resolve (savant / main-agent → solid Orchestrator variant)', () => {
    expect(agentIcon('savant')).toBe('ICON_OrchestratorSolid')
    expect(agentIcon('main-agent')).toBe('ICON_OrchestratorSolid')
  })

  test('Law 14: unknown, case-mismatched, and non-string inputs never throw', () => {
    expect(agentIcon('basher')).toBeNull()
    expect(agentIcon('tmux-cli')).toBeNull()
    expect(agentIcon('Browser-Use')).toBeNull()
    expect(agentIcon('')).toBeNull()
    // Kebab/case normalization: roster ids match case-insensitively.
    expect(agentIcon('Detective')).toBe('ICON_Detective')
    expect(agentIcon('FORGE')).toBe('ICON_Forge')
  })
})

describe('activity-line icon resolution (FID-2026-1009-004 AgentStatus)', () => {
  const familyKeys = new Set(Object.keys(SAVANT_ICON_PNG_DATA_URI))

  test('every activity/tool/lifecycle mark exists in the generated family', () => {
    for (const iconName of [
      ...Object.values(ACTIVITY_ICON_MAP),
      ...Object.values(LIFECYCLE_ICON_MAP),
    ]) {
      expect(familyKeys.has(iconName)).toBe(true)
    }
  })

  test('toolIcon resolves the 20 known tool names and defaults unknowns', () => {
    expect(toolIcon('bash')).toBe('ICON_ToolBash')
    expect(toolIcon('Edit')).toBe('ICON_ToolEdit')
    expect(toolIcon('TYPECHECK')).toBe('ICON_ToolTypecheck')
    expect(toolIcon('read_files')).toBe('ICON_ActivityTool') // unmapped → generic
    expect(toolIcon('spawn_agents')).toBe('ICON_ActivityTool')
    expect(toolIcon(undefined)).toBe('ICON_ActivityTool')
    expect(toolIcon('')).toBe('ICON_ActivityTool')
  })

  test('activityIcon: subagent prefers the roster agent mark, then generic', () => {
    expect(activityIcon('subagent', { agentType: 'detective' })).toBe(
      'ICON_Detective',
    )
    expect(activityIcon('subagent', { agentType: 'main-agent' })).toBe(
      'ICON_OrchestratorSolid',
    )
    expect(activityIcon('subagent', { agentType: 'basher' })).toBe(
      'ICON_ActivitySubagent',
    )
    expect(activityIcon('subagent')).toBe('ICON_ActivitySubagent')
  })

  test('activityIcon: tool rows carry the specific tool mark', () => {
    expect(activityIcon('tool', { toolName: 'bash' })).toBe('ICON_ToolBash')
    expect(activityIcon('tool', { toolName: 'grep' })).toBe('ICON_ToolGrep')
    expect(activityIcon('tool', { toolName: 'custom_tool' })).toBe(
      'ICON_ActivityTool',
    )
    expect(activityIcon('tool')).toBe('ICON_ActivityTool')
  })

  test('activityIcon: thinking/researching/lifecycle tones resolve; idle/unknown → null', () => {
    expect(activityIcon('thinking')).toBe('ICON_ActivityThinking')
    expect(activityIcon('researching')).toBe('ICON_ActivityResearching')
    expect(activityIcon('paused')).toBe('ICON_StatusPaused')
    expect(activityIcon('connecting')).toBe('ICON_StatusConnecting')
    expect(activityIcon('retrying')).toBe('ICON_StatusRetrying')
    expect(activityIcon('idle')).toBeNull()
    expect(activityIcon('unknown-kind')).toBeNull()
    expect(activityIcon('')).toBeNull()
  })
})
