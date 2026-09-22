import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-028 — the spawn boundary is now self-enforcing.
 *
 * FID-2026-0919-027 fixed the fields that were being dropped, and left the
 * mechanism that dropped them: `createAgentState` copies a hand-written list, so
 * the NEXT field added to `AgentState` is silently absent on every child, and
 * nothing fails until someone notices a child behaving like a different run.
 * Reviewing for it is what FID-027 had to do.
 *
 * This module turns that review into a build error. Every key of `AgentState` is
 * classified exactly once:
 *
 * - {@link INHERITED_FROM_PARENT} — copied verbatim by the child-state
 *   constructor (through {@link inheritFromParent}, so the list IS the
 *   behavior — there is no second place to forget).
 * - {@link CHILD_OWN} — constructed for the child by the constructor itself.
 * - {@link NOT_INHERITED_BY_DESIGN} — deliberately absent, each with the reason
 *   it is safe.
 *
 * The compile-time gates at the bottom assert that the three lists are
 * exhaustive, disjoint, and that every governance field really is inherited.
 * Adding `AgentState.newField` without classifying it fails `tsc` (proven in
 * FID-2026-0919-028's negative leg by injecting one).
 *
 * Diagnostic note, measured: TS reports the failure as
 * `error TS2344: Type 'string' does not satisfy the constraint 'never'` at the
 * gate, because it renders the deferred `Exclude<keyof AgentState, …>` rather
 * than the resolved literal keys. So the READABLE entry point is the exported
 * {@link UnclassifiedAgentStateFields} alias: when the gate is red, that alias
 * holds the exact key(s) that need classifying. Stated here because "the build
 * broke and the message says string" is otherwise a confusing first encounter.
 */

/** Copied verbatim from the spawning parent. */
export const INHERITED_FROM_PARENT = [
  // ECHO/EHEL configuration resolved once per run (FID-2026-0919-027).
  'enforcementMode',
  'designContract',
  'protocolSource',
  'provenanceMode',
  // Protocol contract + FSM position.
  'protocolFile',
  'protocolStrictMode',
  'protocolVariant',
  'protocolVersion',
  'fsmPhase',
  'iterationCount',
  // Per-run instances that must be SHARED with the child, not recreated.
  'contextTokenCount',
  'echoCompliance',
  'provenance',
] as const satisfies readonly (keyof AgentState)[]

/** Constructed for the child by `createAgentState` (never copied). */
export const CHILD_OWN = [
  'agentId',
  'agentType',
  'agentContext',
  'ancestorRunIds',
  'childRunIds',
  'creditsUsed',
  'directCreditsUsed',
  'messageHistory',
  'output',
  'parentId',
  'stepsRemaining',
  'subagents',
  'systemPrompt',
  'toolDefinitions',
] as const satisfies readonly (keyof AgentState)[]

/**
 * Deliberately absent on a child, with the reason it is safe. A bare list would
 * not be auditable — each entry has to say WHY the child does not need it.
 */
export const NOT_INHERITED_BY_DESIGN = {
  relayDigest:
    'one-shot terminal-output excerpt, consumed by the run that produced it (basher); a child must not inherit a pending relay',
  runId: 'assigned per run at loop entry, never inherited',
  compactionStatus:
    "compaction telemetry of the run that compacted; the child's own run stamps its own",
  compactionMetrics: 'per-run compaction accounting of the owning run',
  lastCompactionReport: 'report of the owning run’s last prune',
  lastPrunerCompletionAt: 'prune-cooldown stamp of the owning run',
  autoCompactDue:
    'one-shot trigger stamp refreshed every step by the owning run’s loop-context',
  compactAndStop: 'one-shot /compact latch of the owning run',
  compactionBlock: 'blocked-compaction reason of the owning run',
  contextWarningIssuedAt: 'one-shot context-warning stamp of the owning run',
  fidBoundaryDue:
    'one-shot FID-boundary compaction checkpoint of the drive loop',
  lastProviderUsage: 'provider usage observed on the owning run’s stream',
  consecutiveToolErrorSteps: 'anti-runaway counter, reset per run',
  lastToolCallSignature: 'anti-runaway counter, reset per run',
  consecutiveIdenticalToolSignatures: 'anti-runaway counter, reset per run',
  consecutiveThinkOnlyResponses: 'anti-runaway counter, reset per run',
  postTerminalContinuations: 'anti-runaway counter, reset per run',
  turnEndBlockCount: 'anti-runaway counter, reset per run',
  activity:
    'per-agent UI activity — the child publishes its own via setActivity',
  activityIdleTimer: 'internal setTimeout handle of the child’s own activity',
  digestCaps:
    're-stamped for EVERY run by createLoopContext (loop-context.ts) from protocol.config compression',
  maxContextLength:
    're-stamped for EVERY run by createLoopContext from the run’s model window',
  goalCondition:
    'derived from message history by loop-context-goals.ts on each run; owned by the root goal driver',
  goal: 'owned by the root durable goal driver; children run under their spawn prompt',
  drive:
    'owned by the root Auto Drive loop; its presence is what strips interactive tools for the RUN',
  driveStatus: 'observable mirror of the ROOT drive loop',
  groundingCheckpoint:
    'children are exempt from the session-init gate (isAgentGrounded short-circuits on parentId); copying it would claim the root’s completed boot reads',
} as const satisfies Partial<Record<keyof AgentState, string>>

export type InheritedAgentStateField = (typeof INHERITED_FROM_PARENT)[number]
export type ChildOwnAgentStateField = (typeof CHILD_OWN)[number]
export type ByDesignAgentStateField = keyof typeof NOT_INHERITED_BY_DESIGN

/** Fields the governance contract in `execute-subagent.ts` proves. */
export const GOVERNANCE_FIELDS = [
  'enforcementMode',
  'designContract',
  'protocolSource',
  'provenanceMode',
] as const satisfies readonly InheritedAgentStateField[]

/**
 * The keys are REQUIRED and may hold `undefined` (a legacy session with no
 * configuration), so the value is assignable both to `AgentState` (optional
 * fields) and to `SubagentPropagationSnapshot` (required fields) without a
 * cast — the snapshot contract must be able to compare them directly.
 */
export type RunGovernance = {
  [K in (typeof GOVERNANCE_FIELDS)[number]]-?: AgentState[K]
}

export type InheritedFromParent = {
  [K in InheritedAgentStateField]-?: AgentState[K]
}

export type FieldClassification =
  'inherited' | 'child-own' | 'by-design' | 'unclassified'

/** How this module classifies one AgentState field (used by tests + the probe). */
export function classifyAgentStateField(field: string): FieldClassification {
  if ((INHERITED_FROM_PARENT as readonly string[]).includes(field)) {
    return 'inherited'
  }
  if ((CHILD_OWN as readonly string[]).includes(field)) return 'child-own'
  if (field in NOT_INHERITED_BY_DESIGN) return 'by-design'
  return 'unclassified'
}

function pickFields<K extends keyof AgentState>(
  source: AgentState,
  fields: readonly K[],
): { [P in K]-?: AgentState[P] } {
  const picked: Record<string, unknown> = {}
  for (const field of fields) {
    picked[field] = source[field]
  }
  return picked as { [P in K]-?: AgentState[P] }
}

/** The parent fields a child inherits, single-sourced from the list above. */
export function inheritFromParent(
  parentAgentState: AgentState,
): InheritedFromParent {
  return pickFields(parentAgentState, INHERITED_FROM_PARENT)
}

/** Governance subset — used at the construction point AND in the snapshot. */
export function inheritRunGovernance(
  parentAgentState: AgentState,
): RunGovernance {
  return pickFields(parentAgentState, GOVERNANCE_FIELDS)
}

/*
 * ---- Compile-time gates (FID-2026-0919-028) ------------------------------
 * `AssertNever<X>` fails to typecheck unless X is `never`, which is exactly the
 * condition each gate asserts. There is no runtime cost and no test that can
 * forget to run: the repo's `typecheck` gate is the enforcement.
 */

type AssertNever<T extends never> = T

/**
 * Empty only when every key of `AgentState` is classified above — the readable
 * form of the gate failure (see the diagnostic note in this block's header).
 */
export type UnclassifiedAgentStateFields = Exclude<
  keyof AgentState,
  InheritedAgentStateField | ChildOwnAgentStateField | ByDesignAgentStateField
>
export type _EveryAgentStateFieldIsClassified =
  AssertNever<UnclassifiedAgentStateFields>

/**
 * Empty only when every governance field is also on the inherited list — so the
 * contract in `execute-subagent.ts` can never demand something the constructor
 * does not transport.
 */
type GovernanceNotInherited = Exclude<
  (typeof GOVERNANCE_FIELDS)[number],
  InheritedAgentStateField
>
export type _GovernanceFieldsAreInherited = AssertNever<GovernanceNotInherited>

// Each gate is written at its instantiation (not behind a generic helper): TS
// resolves the concrete union first, so the `never` constraint is checked
// against real keys and the error names them.
export type _InheritedAndChildOwnDisjoint = AssertNever<
  Extract<InheritedAgentStateField, ChildOwnAgentStateField>
>
export type _InheritedAndByDesignDisjoint = AssertNever<
  Extract<InheritedAgentStateField, ByDesignAgentStateField>
>
export type _ChildOwnAndByDesignDisjoint = AssertNever<
  Extract<ChildOwnAgentStateField, ByDesignAgentStateField>
>
