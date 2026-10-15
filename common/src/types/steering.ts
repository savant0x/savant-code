/**
 * FID-2026-1006-002 WP1 — deterministic before-tool steering rules, adopted
 * from the pi harness `pi-steering-hooks` design (T149 idea 1).
 *
 * A rule is declarative data, never code: a tool matcher plus regexes over
 * the call's text surface. `requires`/`unless` are the pi conjunction
 * semantics — a rule fires only when EVERY `requires` pattern matches, and is
 * exempt when ANY `unless` pattern matches. A blocked call may be retried with
 * an audit marker (`# steering-override: <id> — <reason>`) unless the rule
 * sets `noOverride`.
 *
 * Declared in `protocol.config.yaml` under `steering:`. Shape validation
 * happens in `parseSteeringRuleConfigs` (fail-safe drop); regex compilation
 * happens in the agent-runtime engine, which reports errors instead of
 * throwing so a malformed rule can never brick a session.
 */
export interface SteeringRuleSpec {
  /** Stable identity, quoted in the blocking error and by the override marker. */
  id: string
  /** RegExp (unanchored) over the tool name, e.g. `^run_terminal_command$`. */
  tool: string
  /** RegExp (unanchored) over the call's text surface. */
  match: string
  /** Fire only when ALL of these also match the text surface. */
  requires?: string[]
  /** Exempt when ANY of these match the text surface. */
  unless?: string[]
  /** `true` = unconditional; no override marker can pass the block. */
  noOverride?: boolean
  /** Operator-facing reason, surfaced in the blocking error text. */
  reason: string
}
