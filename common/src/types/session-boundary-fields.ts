import type { SessionState } from './session-state'
import type { ProjectFileContext } from '../util/file-context'

/**
 * FID-2026-0919-029 — the same self-enforcing partition as
 * `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`
 * (FID-2026-0919-028), applied to the two types that cross the session/child
 * boundary rather than the child-state constructor.
 *
 * `AgentState` is classified by *what the constructor does with it*. These two
 * types are classified by *what the boundary does with them*:
 *
 * - {@link SessionState} crosses the snapshot boundary: a captured session is
 *   written to disk and fed back as the next run's input.
 * - {@link ProjectFileContext} crosses the run boundary: every run (and every
 *   child agent) reads it, and run start rewrites part of it.
 *
 * Both were previously described only in prose comments at the writer
 * (`sdk/src/run/types.ts`, `sdk/src/run/execution/session-state.ts`), which is
 * exactly the arrangement FID-027 had to audit by hand: the doc says what the
 * code does *today*, and nothing fails when the code changes. Here each field is
 * classified exactly once, each with the reason it is safe, and the
 * compile-time gates at the bottom fail the build when a new field is added
 * without a classification.
 *
 * Diagnostic note (same as the AgentState gate, measured): TS renders the
 * deferred `Exclude<keyof T, …>` as `'string'`, so the READABLE entry point when
 * a gate is red is the exported `Unclassified…Fields` alias, which holds the
 * exact key(s) needing classification.
 */

/* ------------------------------------------------------------------ *
 * SessionState — the snapshot boundary
 * ------------------------------------------------------------------ */

/**
 * Deep-copied when a snapshot is captured. These are the places in-place
 * mutation happens during a run, so a captured snapshot must not share them
 * (`cloneSessionState`, `sdk/src/run/types.ts:263` — JSON round-trip, chosen for
 * byte-parity with the persisted snapshot and to tolerate URL/Buffer message
 * content).
 */
export const SESSION_DEEP_COPIED = [
  'mainAgentState',
] as const satisfies readonly (keyof SessionState)[]

/**
 * Shared by reference into every snapshot, with the reason that is safe.
 * A record (not an array) because an unlisted field here has to justify itself:
 * "we didn't copy it" is only acceptable when the field cannot be mutated in
 * place by the run that owns it.
 */
export const SESSION_SHARED_BY_REFERENCE = {
  fileContext:
    'large, effectively read-only during a run, and already persisted as-is; cloning it means a cloneDeep of the whole session (~230ms on ~8MB) on the CLI render thread at every in-flight snapshot (sdk/src/run/types.ts:252). Sharing is safe only while nothing mutates it in place — which is what FILE_CONTEXT_REFRESHED_AT_RUN_START below makes auditable.',
} as const satisfies Partial<Record<keyof SessionState, string>>

/* ------------------------------------------------------------------ *
 * ProjectFileContext — the run boundary
 * ------------------------------------------------------------------ */

/**
 * Rewritten at run start. Each citation is the write site that makes the field
 * refresh; a field here with no live writer means the partition has drifted.
 */
export const FILE_CONTEXT_REFRESHED_AT_RUN_START = [
  // Armed from run options (sdk/src/run/execution/session-state.ts).
  'devMode', // :177
  'permissionMode', // :185
  'designContract', // :181
  'designSystemContext', // :182
  // Derived from project inputs by applyOverridesToSessionState
  // (sdk/src/run-state/mutations.ts).
  'fileTree', // :134 (reset to [] at :140 when projectFiles given without cwd)
  'fileTokenScores', // :135 (reset at :141)
  'tokenCallers', // :136 (reset at :142)
  'knowledgeFiles', // :155, or derived from projectFiles at :147
  'agentTemplates', // :163 (merged by id, last-in wins)
  'customToolDefinitions', // :174 (merged), then pruned of composio meta-tools by session-state.ts:189
] as const satisfies readonly (keyof ProjectFileContext)[]

/**
 * Carried verbatim from the previous run's snapshot (or from session init), with
 * the reason that is correct rather than merely unimplemented.
 */
export const FILE_CONTEXT_CARRIED_ACROSS_RUNS = {
  projectRoot:
    'host environment root, resolved at session init; a run cannot re-derive it and every consumer treats it as invariant',
  cwd: 'host working directory of the session, likewise fixed at init',
  userKnowledgeFiles:
    'user-authored knowledge supplied by the host; no run option carries it, so refreshing is not possible and not wanted',
  skills:
    'operator-trusted skill map loaded at session init; re-deriving it mid-session would change what the trust/quarantine boundary exposes to a running agent',
  gitChanges:
    'captured once at session init (sdk/src/run-state/initial-state.ts:121) and NOT refreshed on resume — a resumed session reports the diff as of its init. Declared explicitly because this is a real behaviour with a real consequence, not an oversight to be discovered later',
  changesSinceLastChat:
    'per-session change ledger accumulated as the session progresses; refreshing it would discard the session’s own history',
  shellConfigFiles: 'host shell config read at session init',
  systemInfo: 'platform facts of the host process; constant for the session',
} as const satisfies Partial<Record<keyof ProjectFileContext, string>>

/* ------------------------------------------------------------------ *
 * Classification API (shared authority for tests and probes)
 * ------------------------------------------------------------------ */

export type SessionStateFieldClass =
  'deep-copied' | 'shared-by-reference' | 'unclassified'

export type FileContextFieldClass =
  'refreshed-at-run-start' | 'carried-across-runs' | 'unclassified'

export function classifySessionStateField(
  field: string,
): SessionStateFieldClass {
  if ((SESSION_DEEP_COPIED as readonly string[]).includes(field)) {
    return 'deep-copied'
  }
  if (field in SESSION_SHARED_BY_REFERENCE) return 'shared-by-reference'
  return 'unclassified'
}

export function classifyFileContextField(field: string): FileContextFieldClass {
  if (
    (FILE_CONTEXT_REFRESHED_AT_RUN_START as readonly string[]).includes(field)
  ) {
    return 'refreshed-at-run-start'
  }
  if (field in FILE_CONTEXT_CARRIED_ACROSS_RUNS) return 'carried-across-runs'
  return 'unclassified'
}

/** The fields a snapshot must copy; the rest are shared (see the record). */
export type DeepCopiedSessionStateField = (typeof SESSION_DEEP_COPIED)[number]
export type SharedSessionStateField = keyof typeof SESSION_SHARED_BY_REFERENCE
export type RefreshedFileContextField =
  (typeof FILE_CONTEXT_REFRESHED_AT_RUN_START)[number]
export type CarriedFileContextField =
  keyof typeof FILE_CONTEXT_CARRIED_ACROSS_RUNS

/* ------------------------------------------------------------------ *
 * Compile-time gates — exhaustiveness and disjointness
 * ------------------------------------------------------------------ */

type AssertNever<T extends never> = T

/** Empty only when every key of `SessionState` is classified above. */
export type UnclassifiedSessionStateFields = Exclude<
  keyof SessionState,
  DeepCopiedSessionStateField | SharedSessionStateField
>
export type _EverySessionStateFieldIsClassified =
  AssertNever<UnclassifiedSessionStateFields>

/** Empty only when every key of `ProjectFileContext` is classified above. */
export type UnclassifiedFileContextFields = Exclude<
  keyof ProjectFileContext,
  RefreshedFileContextField | CarriedFileContextField
>
export type _EveryFileContextFieldIsClassified =
  AssertNever<UnclassifiedFileContextFields>

// Written at their instantiation (not behind a generic helper) so TS resolves
// the concrete unions and checks `never` against real keys — same reason as the
// AgentState gates in FID-2026-0919-028.
export type _SessionStateClassesDisjoint = AssertNever<
  Extract<DeepCopiedSessionStateField, SharedSessionStateField>
>
export type _FileContextClassesDisjoint = AssertNever<
  Extract<RefreshedFileContextField, CarriedFileContextField>
>
