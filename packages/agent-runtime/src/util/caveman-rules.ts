import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import type { ProtocolCavemanConfig } from '@savant-code/common/util/protocol-config'

/**
 * P5f — Caveman telegraphic output rules (opt-in, FID-2026-0806-003).
 *
 * The `caveman.enabled` setting in protocol.config.yaml applies a telegraphic
 * output style to Orchestrator/Detective/Scribe responses. Auto-Clarity
 * bypasses keep code blocks, file paths, error messages, and security
 * warnings byte-exact (research doc: "Caveman Auto-Clarity overrides
 * compression for security warnings and error paths"). Language preservation
 * default from OpenClaw: never translate or reformat identifiers.
 *
 * FID-2026-0806-016: the ruleset is enhanced with three ADHD-friendly rules
 * (derived from the i-have-adhd skill idea, perfected into our own system —
 * not a port): number multi-step tasks, cap lists at 5 items, and end with
 * one concrete next step. The remaining i-have-adhd rules either overlap with
 * the telegraphic style already here (no preamble/closers, suppress tangents,
 * matter-of-fact errors) or do not fit an agent without wall-clock grounding
 * (specific time estimates — deliberately not adopted). The opt-in config
 * surface is unchanged: the same `caveman.enabled` flag drives all of it.
 */

/** Agents that carry the Caveman output rules when enabled. */
const CAVEMAN_TARGET_AGENT_IDS = new Set([
  'savant',
  'savant-free',
  'savant-analyze',
  'savant-scaffold',
  'savant-strict',
  'detective',
  'scribe',
])

const DEFAULT_CAVEMAN: ProtocolCavemanConfig = {
  enabled: false,
  autoClarity: true,
}

/** Per-cwd cache so the prompt assembler doesn't re-read the config per build. */
const cavemanConfigCache = new Map<string, ProtocolCavemanConfig>()

/** Clears the cache (test helper). */
export function __resetCavemanConfigCacheForTests(): void {
  cavemanConfigCache.clear()
}

function getCavemanConfig(cwd: string): ProtocolCavemanConfig {
  const cached = cavemanConfigCache.get(cwd)
  if (cached) return cached
  let config = DEFAULT_CAVEMAN
  try {
    config = readProtocolConfig(cwd).caveman
  } catch {
    // Unreadable config — defaults.
  }
  cavemanConfigCache.set(cwd, config)
  return config
}

/** Whether the given agent id is a Caveman output-rules target. */
export function isCavemanTargetAgent(agentId: string | undefined): boolean {
  if (!agentId) return false
  return CAVEMAN_TARGET_AGENT_IDS.has(agentId)
}

/** The telegraphic ruleset text, with Auto-Clarity bypasses. */
export function buildCavemanRulesBlock(config: ProtocolCavemanConfig): string {
  if (!config.enabled) return ''

  const autoClarity =
    'Auto-Clarity: code blocks, file paths, line numbers, API commands, ' +
    'variable/function names, error messages, and security warnings stay ' +
    'byte-for-byte exact — never compress, paraphrase, or translate them. ' +
    'Preserve the original language of all identifiers and code.'

  return [
    '',
    '## Caveman Output Rules (telegraphic style)',
    '',
    'Write in telegraphic style: drop articles, filler, pleasantries, ' +
      'hedging, and verbose transitions. Use sentence fragments. State ' +
      'findings and decisions as dense noun-verb pairs. No preamble, no ' +
      'closing pleasantries.',
    '',
    // FID-2026-0806-016: ADHD-friendly structure rules folded into the opt-in
    // Caveman block (idea perfected into our system, not a port).
    'Structure: number multi-step tasks (1, 2, 3…), cap lists at 5 items, ' +
      'and end with one concrete next step.',
    '',
    config.autoClarity ? autoClarity : '',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n')
    .trim()
}

/**
 * Returns the Caveman rules block for the given agent, or '' when disabled
 * or the agent is not a target. Config is read from protocol.config.yaml
 * relative to `projectRoot` and cached per project.
 */
export function getCavemanRulesBlockForAgent(
  agentId: string | undefined,
  projectRoot: string,
): string {
  if (!isCavemanTargetAgent(agentId)) return ''
  return buildCavemanRulesBlock(getCavemanConfig(projectRoot))
}

/**
 * Test isolation: clears the per-cwd Caveman config cache — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002). Same clear as
 * `__resetCavemanConfigCacheForTests`, under the conventional reset name.
 */
export function resetCavemanConfigCache(): void {
  cavemanConfigCache.clear()
}
