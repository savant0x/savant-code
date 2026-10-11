import type { SavantIconName } from '../icons.generated'

/**
 * Surface mappings for the desktop adoption (FID-2026-1009-004 Phase 3).
 *
 * Both tables key into the SAME codegen-emitted family the CLI uses; a
 * manifest rename fails the CLI drift tests before any desktop surface can
 * miss. Unknown keys resolve null and every consumer degrades to its
 * existing rendering (Law 14).
 */

/** FSM phase (matches PhaseStepper's PHASES + manifest phaseMarkMapping). */
export const PHASE_ICON_MAP: Record<string, SavantIconName> = {
  idle: 'ICON_PhaseIdle',
  red: 'ICON_PhaseRed',
  green: 'ICON_PhaseGreen',
  audit: 'ICON_PhaseAudit',
  adversarial: 'ICON_PhaseAudit', // ADVERSARIAL shares the audit scanner mark
  self_correct: 'ICON_PhaseSelfCorrect',
  complete: 'ICON_PhaseComplete',
}

/** Roster role id (matches DECK_ROLE_IDS in floor/roles.ts) → agent mark.
 *  'savant' (the center-piece orchestrator) uses the identity logo mark.
 *  The map is pinned 1:1 against DECK_ROLE_IDS by the Phase 3 drift guard —
 *  the deck cast is closed, so no key may exist without a roster row. */
export const ROSTER_ICON_MAP: Record<string, SavantIconName> = {
  savant: 'ICON_Logo',
  detective: 'ICON_Detective',
  forge: 'ICON_Forge',
  verifier: 'ICON_Verifier',
  recorder: 'ICON_Recorder',
  thinker: 'ICON_Thinker',
  scout: 'ICON_Scout',
  researcher: 'ICON_Researcher',
  scribe: 'ICON_Scribe',
  adversary: 'ICON_Adversary',
}

export function phaseIcon(phase: string | null): SavantIconName | null {
  if (phase === null) return PHASE_ICON_MAP.idle
  return PHASE_ICON_MAP[phase] ?? null
}

export function rosterIcon(roleId: string): SavantIconName | null {
  return ROSTER_ICON_MAP[roleId] ?? null
}
