import type { AgentTemplateTypes } from '../types/session-state'

// Define agent personas with their shared characteristics
export const AGENT_PERSONAS = {
  // ECHO agents
  thinker: {
    displayName: 'Savant the Thinker',
    purpose:
      'Does deep thinking given the current messages and a specific prompt to focus on. Use this to help you solve a specific problem.',
  } as const,
  scout: {
    displayName: 'Savant the Scout',
    purpose: 'Expert at exploring a codebase and finding relevant files.',
  } as const,
  verifier: {
    displayName: 'Savant the Verifier',
    purpose:
      'Reviews file changes and responds with critical feedback. Use this after making any significant change to the codebase; otherwise, no need to use this agent for minor changes since it takes a second.',
  } as const,
  adversary: {
    displayName: 'Savant the Adversary',
    purpose:
      'Meta-verification after AUDIT: refutes the Verifier\u2019s FAILs, re-audits unevidenced PASSes, resolves citations, and overrides verdicts. Read-only \u2014 never edits code.',
  } as const,
  researcher: {
    displayName: 'Savant the Researcher',
    purpose: 'Expert at researching topics using web search and documentation.',
  } as const,

  // Personas
  ask: {
    displayName: 'Ask Mode Agent',
    purpose: 'Base ask-mode agent that orchestrates the full response.',
  } as const,
  planner: {
    displayName: 'Peter Plan',
    purpose: 'Agent that formulates a comprehensive plan to a prompt.',
    hidden: true,
  } as const,

  // Infrastructure
  'file-explorer': {
    displayName: 'Dora The File Explorer',
    purpose: 'Expert at exploring a codebase and finding relevant files.',
  } as const,
} as const satisfies Partial<
  Record<
    (typeof AgentTemplateTypes)[keyof typeof AgentTemplateTypes],
    { displayName: string; purpose: string; hidden?: boolean }
  >
>

// Agent IDs list from AGENT_PERSONAS keys
export const AGENT_IDS = Object.keys(
  AGENT_PERSONAS,
) as (keyof typeof AGENT_PERSONAS)[]

// Agent ID prefix constant
export const AGENT_ID_PREFIX = 'SavantCode/'

// Agent names for client-side reference
export const AGENT_NAMES = Object.fromEntries(
  Object.entries(AGENT_PERSONAS).map(([agentType, persona]) => [
    agentType,
    persona.displayName,
  ]),
) as Record<keyof typeof AGENT_PERSONAS, string>

export type AgentName =
  (typeof AGENT_PERSONAS)[keyof typeof AGENT_PERSONAS]['displayName']

// Get unique agent names for UI display
export const UNIQUE_AGENT_NAMES = Array.from(
  new Set(
    Object.values(AGENT_PERSONAS)
      .filter((persona) => !('hidden' in persona) || !persona.hidden)
      .map((persona) => persona.displayName),
  ),
)

// Map from display name back to agent types (for parsing user input)
export const AGENT_NAME_TO_TYPES = Object.entries(AGENT_NAMES).reduce(
  (acc, [type, name]) => {
    if (!acc[name]) acc[name] = []
    acc[name].push(type)
    return acc
  },
  {} as Record<string, string[]>,
)

export const MAX_AGENT_STEPS_DEFAULT = 200

/** FID-2026-0809-007: fail-closed child fan-out and ancestry limits. */
export const MAX_SUBAGENT_FAN_OUT = 32
export const MAX_SUBAGENT_DEPTH = 8

/**
 * Base agents that may spawn ANY agent by raw ID, bypassing the
 * spawnableAgents allowlist. Single source of truth (FID-2026-0802-005 L6) —
 * previously duplicated in tool-executor.ts and spawn-agent-utils.ts.
 */
export const BASE_AGENTS: readonly string[] = [
  'base',
  'base-free',
  'base-max',
  'base-experimental',
]

/**
 * Condensed ECHO protocol instructions (FID-2026-0810-003) — generated from
 * ECHO.md facts + generator-hosted framing by scripts/generate-protocol-bundle.ts
 * (see scripts/protocol-copies.ts). Do not edit by hand.
 */
export { ECHO_PROTOCOL_INSTRUCTIONS } from './echo-protocol-instructions.generated'
