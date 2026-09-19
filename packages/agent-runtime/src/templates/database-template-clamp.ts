/**
 * @module templates/database-template-clamp
 *
 * FID-2026-0919-013 (SEC-6): the capability gate reads
 * `agentTemplate.toolNames` — the template's OWN declaration. For
 * database-sourced (published) templates, that declaration is supplied by
 * an untrusted author, so "declared" must not equal "granted". This module
 * clamps database templates to a safe tool subset at load time; bundled
 * local templates are unaffected.
 *
 * Policy (expandable in code; a config surface is deliberately deferred
 * until an operator asks for per-deployment grants — YAGNI):
 *
 *   GRANTED unconditionally: read/search/output tools.
 *   STRIPPED: anything that mutates the filesystem, executes commands,
 *   reaches the network, or changes agent output flow.
 */

import type { AgentTemplate } from './types'
import type { Logger } from '@savant-code/common/types/contracts/logger'


/** Tools a database-sourced template is always granted. */
const DB_TEMPLATE_GRANTABLE_TOOLS = new Set([
  // Read/search
  'read_files',
  'list_directory',
  'glob',
  'code_search',
  'read_docs',
  'read_url',
  'web_search',
  // Agent plumbing / output
  'end_turn',
  'set_output',
  'lookup_agent_info',
])

/** Tools that are always stripped from database templates. */
const DB_TEMPLATE_ALWAYS_STRIPPED = new Set([
  // Filesystem mutation
  'write_file',
  'edit_file',
  'apply_patch',
  'propose_write_file',
  // Command execution
  'run_terminal_command',
  'run_readonly_command',
  // Network state-change surfaces
  'browser_*',
  'composio_manage_connections',
  'composio_multi_execute_tool',
  // Spawn / flow control
  'spawn_agents',
])

/**
 * Whether a template's `toolNames` were clamped (exposed for observability
 * and tests).
 */
export interface ClampedToolNames {
  toolNames: string[]
  stripped: string[]
}

/**
 * Clamp a database-sourced template's declared toolNames to the grantable
 * subset. Returns the granted list plus what was stripped (for a warning).
 * Order-preserving; deduplicates.
 */
export function clampDatabaseTemplateToolNames(
  template: AgentTemplate,
): ClampedToolNames {
  const declared = [...new Set(template.toolNames)]
  const granted: string[] = []
  const stripped: string[] = []
  for (const toolName of declared) {
    if (DB_TEMPLATE_ALWAYS_STRIPPED.has(toolName)) {
      stripped.push(toolName)
      continue
    }
    if (DB_TEMPLATE_GRANTABLE_TOOLS.has(toolName)) {
      granted.push(toolName)
      continue
    }
    // Unknown tools default to STRIPPED: an allowlist boundary fails
    // closed on names it does not recognize.
    stripped.push(toolName)
  }
  return { toolNames: granted, stripped }
}

/**
 * True when the template came from the agent database (published id form:
 * `publisher/agent` or `publisher/agent@version`).
 */
export function isDatabaseSourcedTemplateId(agentId: string): boolean {
  return agentId.includes('/')
}

/**
 * Clamp a freshly-fetched database template in place-of-return: grants only
 * the allowlisted tools and warns when anything was stripped (the published
 * definition asks for capabilities it will not receive).
 */
export function clampDatabaseTemplateCapabilities(
  template: AgentTemplate,
  logger: Logger,
): AgentTemplate {
  const { toolNames, stripped } = clampDatabaseTemplateToolNames(template)
  if (stripped.length > 0) {
    logger.warn(
      {
        agentId: template.id,
        stripped,
      },
      'Database-sourced agent template: capabilities clamped to policy allowlist (FID-2026-0919-013)',
    )
  }
  return { ...template, toolNames }
}
