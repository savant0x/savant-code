import type {
  PresencePayload,
  SanitizedPresenceState,
} from './presence-privacy'

/**
 * FID-2026-0818-009: presence payload mapper — sanitized state → SET_ACTIVITY.
 *
 * Synthesizes the flat Discord Rich Presence profile from the redacted state.
 * Discord exposes exactly two visible text lines (`details` + `state`, both
 * single-line — newlines are not supported): `details` carries the project
 * basename + model (both short, provider-trimmed) and `state` carries the
 * live Perfection Loop phase / activity so presence reflects what the harness
 * is doing in real time. The execution mode is a hover detail on the
 * `small_image` tooltip; `large_image` = the active agent's asset. Asset keys
 * are resolved from a validated constants map (charset `^[a-z0-9_]+$`), never
 * scattered strings; unknown keys are skipped.
 */

/** Phase → Discord `state` narrative (the full Perfection Loop + idle). */
export const PHASE_STATE_MAP: Record<string, string> = {
  idle: 'Awaiting Operator Input',
  red: 'RED Phase: Investigating Codebase',
  green: 'GREEN Phase: Implementing Fixes',
  audit: 'AUDIT Phase: Double-Checking',
  adversarial: 'ADVERSARIAL Phase: Refuting',
  self_correct: 'SELF-CORRECT: Revising Approach',
  complete: 'COMPLETE: Archiving FID',
}

/** Canonical ECHO agent → large-image asset key + tooltip. */
export const AGENT_ASSET_MAP: Record<string, { key: string; text: string }> = {
  orchestrator: {
    key: 'agent_orchestrator',
    text: 'Orchestrator (Protocol Enforcement)',
  },
  detective: { key: 'agent_detective', text: 'Detective (Codebase Analysis)' },
  forge: { key: 'agent_forge', text: 'Forge (Code Implementation)' },
  verifier: {
    key: 'agent_verifier',
    text: 'Verifier (Double-Audit Validation)',
  },
  recorder: {
    key: 'agent_recorder',
    text: 'Recorder (FID Lifecycle Management)',
  },
  thinker: { key: 'agent_thinker', text: 'Thinker (Sequential Logic Engine)' },
  scout: { key: 'agent_scout', text: 'Scout (Contextual Exploration)' },
  researcher: {
    key: 'agent_researcher',
    text: 'Researcher (External Verification)',
  },
  scribe: { key: 'agent_scribe', text: 'Scribe (Documentation Synthesis)' },
  adversary: {
    key: 'agent_adversary',
    text: 'Adversary (Meta-Verification Override)',
  },
}

const DEFAULT_AGENT = AGENT_ASSET_MAP.orchestrator

/**
 * Execution mode → small-image overlay asset key + tooltip. The mode is a
 * distinct axis from the model (`details` carries the model); HYBRID/STRICT/
 * SCAFFOLD/ANALYZE map here so the operator's execution scope is visible
 * without ever being mislabeled as a model.
 */
export const MODE_ASSET_MAP: Record<string, { key: string; text: string }> = {
  HYBRID: { key: 'mode_hybrid', text: 'Hybrid Mode' },
  SCAFFOLD: { key: 'mode_scaffold', text: 'Scaffold Mode' },
  STRICT: { key: 'mode_strict', text: 'STRICT Mode' },
  ANALYZE: { key: 'mode_analyze', text: 'Analyze Mode' },
}

const DEFAULT_MODE = MODE_ASSET_MAP.HYBRID

export function resolvePhaseState(phase: string): string {
  return PHASE_STATE_MAP[phase] ?? PHASE_STATE_MAP.idle
}

export function resolveAgentAsset(agentId: string | null): {
  key: string
  text: string
} {
  if (agentId && AGENT_ASSET_MAP[agentId]) return AGENT_ASSET_MAP[agentId]
  return DEFAULT_AGENT
}

export function resolveModeAsset(mode: string | undefined): {
  key: string
  text: string
} {
  if (mode && MODE_ASSET_MAP[mode]) return MODE_ASSET_MAP[mode]
  return DEFAULT_MODE
}

/**
 * The `state` narrative is phase-first but activity-aware: during STRICT
 * ceremony the Perfection Loop phase (RED/GREEN/AUDIT/…) wins; during normal
 * HYBRID work the phase stays `idle`, so the live activity (tool/thinking/
 * subagent/researching) is surfaced instead — the presence always reflects
 * what the harness is doing *now*, never a frozen "Awaiting Operator Input".
 * The FID numeric id is appended when a drive is active.
 */
export function resolveStateLine(
  phase: string,
  activity: string | null,
  fidId: string | null,
): string {
  const phaseNarrative = resolvePhaseState(phase)
  const narrative =
    phaseNarrative === PHASE_STATE_MAP.idle
      ? (activity ?? phaseNarrative)
      : phaseNarrative
  return fidId ? `${narrative} | FID: ${fidId}` : narrative
}

/**
 * Map a sanitized state snapshot to the outbound payload. `startTimestamp` is
 * the service boot time (passed in) so Discord renders a continuous session
 * timer across phase transitions.
 */
export function mapSanitizedState(
  state: SanitizedPresenceState,
  startTimestamp: number,
): PresencePayload {
  const agent = resolveAgentAsset(state.agentId)
  const mode = resolveModeAsset(state.mode)

  const payload: PresencePayload = {
    details: `Project: ${state.project} · Model: ${state.model}`,
    state: resolveStateLine(state.phase, state.activity, state.fidId),
    largeImageKey: agent.key,
    largeImageText: agent.text,
    // The mode is the small-image overlay; its tooltip carries the mode text.
    // The live phase/activity stays on the visible `state` line so presence
    // reflects what the harness is doing in real time.
    smallImageKey: mode.key,
    smallImageText: mode.text,
    startTimestamp,
  }

  return payload
}
