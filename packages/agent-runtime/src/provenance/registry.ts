import { generateCompactId } from '@savant-code/common/util/string'

import { ProvenanceSession } from './session'

import type { ProvenanceMode } from '@savant-code/common/types/provenance'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Options for constructing a per-session provenance engine. */
export type ProvenanceSessionOptions = {
  sessionId: string
  mode: ProvenanceMode
  projectRoot: string
}

let sessionInstances = new WeakMap<object, ProvenanceSession>()

/** Resolve the operating mode: AgentState field, default `record`. */
export function resolveProvenanceMode(agentState: AgentState): ProvenanceMode {
  const mode = agentState.provenanceMode
  if (mode === undefined) return 'record'
  if (mode === 'off' || mode === 'record' || mode === 'enforce') return mode
  return 'record'
}

/**
 * Get (or create) the provenance session for an agent state. Subagents inherit
 * the parent's session via `AgentState.provenance` (threaded in
 * createAgentState); the root session is created lazily on first use and kept
 * in a WeakMap so it is never serialized or leaked.
 */
export function getOrCreateProvenance(
  agentState: AgentState,
  deps: { projectRoot: string },
): ProvenanceSession {
  const inherited = agentState.provenance
  if (inherited && inherited instanceof ProvenanceSession) {
    return inherited
  }
  const existing = sessionInstances.get(agentState)
  if (existing) {
    agentState.provenance = existing
    return existing
  }
  const mode = resolveProvenanceMode(agentState)
  const session = new ProvenanceSession({
    sessionId: `sess_${generateCompactId()}`,
    mode,
    projectRoot: deps.projectRoot,
  })
  sessionInstances.set(agentState, session)
  agentState.provenance = session
  return session
}

/** Create a minimal off-mode session (no ledger, no keys). */
export function createOffSession(): ProvenanceSession {
  return new ProvenanceSession({
    sessionId: `sess_${generateCompactId()}`,
    mode: 'off',
    projectRoot: '.',
  })
}

/**
 * Test isolation: drops every cached provenance session — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002).
 */
export function resetSessionInstances(): void {
  sessionInstances = new WeakMap<object, ProvenanceSession>()
}
