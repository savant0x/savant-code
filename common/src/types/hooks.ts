/**
 * FID-2026-0814-003: Extensible Hook System at EHEL enforcement points.
 *
 * Project-scoped lifecycle hooks declared in `protocol.config.yaml` under a
 * `hooks:` block. The runtime fires matching hooks at the documented lifecycle
 * points; `PreToolUse` can BLOCK a tool (additional gate — never a bypass of
 * EHEL), everything else is observation-only. Hooks are fail-open by default:
 * a missing binary, timeout, or malformed output ALLOWS execution; only the
 * documented block protocol (exit code 2, or JSON `permissionDecision:
 * "deny"`) blocks.
 */

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SessionStart',
  'SessionEnd',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'Stop',
  'Interrupt',
  'Notification',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/**
 * FID-2026-0919-030 — the event vocabulary and the event WIRING are one
 * enforced thing.
 *
 * `HOOK_EVENTS` is the parse-time vocabulary, so an event listed here validates
 * and loads. Before this split, five of the twelve entries had no firing site
 * anywhere in the runtime while `docs/design/hook-system.md` documented all of
 * them as active: a hook declared for one of those five was **silently inert** —
 * no parse error (the name is valid) and no warning (it never runs), which is the
 * one failure mode an operator cannot observe. Those five are wired as of
 * FID-2026-0919-031; the split remains because it is what makes the next such
 * omission impossible.
 *
 * So every event is classified exactly once: either the runtime fires it
 * ({@link FIRED_HOOK_EVENTS}) or it is deliberately inert with the reason why
 * ({@link NEVER_FIRED_HOOK_EVENTS}). The compile-time gates at the bottom make an
 * unclassified event a build failure, and the census in
 * `scripts/hook-events-check.ts` proves the fired list against the runtime source
 * — so adding an event to the vocabulary cannot advertise a capability nothing
 * delivers.
 */

/**
 * Events the runtime actually fires, with the module that fires each. Verified
 * against the source by the census (not by this comment):
 * `scripts/hook-events-check.ts` scans the non-test runtime sources for
 * `event: '<Name>'` and fails if the two disagree in either direction.
 */
export const FIRED_HOOK_EVENTS = [
  'PreToolUse', // tool-executor/hook-gate.ts (native) + tool-executor/custom.ts (custom/MCP)
  'PostToolUse', // tool-executor/result-lifecycle.ts + tool-executor/custom-result.ts
  'PostToolUseFailure', // the two above, plus tools/stream-parser.ts (native-incomplete)
  'SessionStart', // main-prompt-run.ts
  'SessionEnd', // main-prompt-run.ts
  'SubagentStart', // tools/handlers/tool/execute-subagent.ts
  'SubagentStop', // tools/handlers/tool/execute-subagent.ts
  // FID-2026-0919-031 — the five that had no firing site, now wired. The
  // semantics each one had to be given before it could fire at all are written
  // where the wiring lives (packages/agent-runtime/src/hooks/lifecycle-hooks.ts):
  'Stop', // run-agent-step/loop.ts — the turn FINISHED on its own terms
  'Interrupt', // loop.ts (setup-cancel) + run-agent-step/loop/exit-paths.ts — CANCELLED
  'PreCompact', // tools/handlers/tool/spawn-agent-inline.ts — a compaction ATTEMPT begins
  'PostCompact', // tools/handlers/tool/spawn-agent-inline-pruner-outcome.ts — it had an EFFECT
  'Notification', // tools/handlers/tool/ask-user.ts — the runtime needs the operator
] as const satisfies readonly HookEvent[]

/**
 * Declared events with NO firing site, each with the reason it is inert rather
 * than wired. Empty since FID-2026-0919-031 wired the last five — and it stays in
 * the vocabulary as the extension point, because the rule it encodes is the
 * useful part: an event added to `HOOK_EVENTS` must either be listed as fired
 * (and then the census in `scripts/hook-events-check.ts` requires a real call
 * site) or be listed here with the blocker that keeps it inert. "We forgot to
 * wire it" is not an expressible state.
 */
export const NEVER_FIRED_HOOK_EVENTS = {} as const satisfies Partial<
  Record<HookEvent, string>
>

export type FiredHookEvent = (typeof FIRED_HOOK_EVENTS)[number]
export type NeverFiredHookEvent = keyof typeof NEVER_FIRED_HOOK_EVENTS
export type HookEventDelivery = 'fired' | 'never-fired' | 'unknown'

/** How this module classifies an event string (used by tests + the census). */
export function classifyHookEvent(event: string): HookEventDelivery {
  if ((FIRED_HOOK_EVENTS as readonly string[]).includes(event)) return 'fired'
  if (event in NEVER_FIRED_HOOK_EVENTS) return 'never-fired'
  return 'unknown'
}

/*
 * ---- Compile-time gates (FID-2026-0919-030) ------------------------------
 * Same idiom as `spawn-child-fields.ts` / `session-boundary-fields.ts`:
 * `AssertNever<X>` fails to typecheck unless X is `never`, which is exactly what
 * each gate asserts. No runtime cost, and no test that can be forgotten.
 */

type AssertNever<T extends never> = T

/**
 * Empty only when every event in the vocabulary is classified above — the
 * readable form of a gate failure (TS renders the deferred `Exclude` as
 * `'string'`, see the note in `session-boundary-fields.ts`).
 */
export type UnclassifiedHookEvents = Exclude<
  HookEvent,
  FiredHookEvent | NeverFiredHookEvent
>
export type _EveryHookEventIsClassified = AssertNever<UnclassifiedHookEvents>

export type _HookEventClassesDisjoint = AssertNever<
  Extract<FiredHookEvent, NeverFiredHookEvent>
>

/**
 * FID-2026-0824-012 — builtin in-process hook actions. A hook declares EITHER
 * `command` (external, spawned per event) OR `action` (in-process sink, no
 * spawn). Actions are allowlisted: an unknown action is dropped fail-safe at
 * parse time, never executed.
 */
export const HOOK_BUILTIN_ACTIONS = ['experience-capture'] as const

export type HookBuiltinAction = (typeof HOOK_BUILTIN_ACTIONS)[number]

/**
 * One declared hook. `event` selects the lifecycle point; `matcher` (optional)
 * is a RegExp tested against the tool name for tool events; `command` is the
 * external command (tokenized; args are fine); `action` selects a builtin
 * in-process sink (no process spawn — required for high-frequency events like
 * PostToolUseFailure, where spawning per event would be prohibitive); `timeout`
 * is seconds (default 30); `cwd` overrides the working directory (default:
 * project root); `env` adds environment variables.
 */
export type HookConfig = {
  event: HookEvent
  /** RegExp tested against the tool name for tool events. */
  matcher?: string
  /** External command to run (tokenized, no shell). */
  command?: string
  /** Builtin in-process sink (mutually exclusive with `command`). */
  action?: HookBuiltinAction
  /** Timeout in seconds (default 30). */
  timeout?: number
  /** Working directory (default: project root). */
  cwd?: string
  /** Extra environment variables. */
  env?: Record<string, string>
}
