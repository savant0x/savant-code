import type { JSONValue } from '@savant-code/common/types/json'
import type { SteeringRuleSpec } from '@savant-code/common/types/steering'

/**
 * Deterministic before-tool steering rules — engine (FID-2026-1006-002 WP1).
 *
 * Adopted from the pi harness `pi-steering-hooks` design (T149 idea 1): a
 * rule is a regex over the tool name plus a regex over the call's text
 * surface, evaluated BEFORE dispatch, so a violation is blocked with zero
 * token cost rather than nudged by prompt text the model may drift from.
 *
 * Pure logic, no I/O — the same shape the ralph orchestration uses for its
 * decision functions (T149 idea 8). `compileSteeringRules` never throws:
 * an invalid regex is dropped and REPORTED, because a typo in project config
 * must not brick a session, and must not silently disable a guard either.
 */
export type CompiledSteeringRule = {
  id: string
  tool: RegExp
  match: RegExp
  requires: readonly RegExp[]
  unless: readonly RegExp[]
  noOverride: boolean
  reason: string
}

export type SteeringOverride = { ruleId: string; reason: string }

export type SteeringDecision =
  | { kind: 'allow' }
  | { kind: 'override'; rule: CompiledSteeringRule; override: SteeringOverride }
  | { kind: 'block'; rule: CompiledSteeringRule }

/**
 * The audited escape hatch marker: `# steering-override: <id> — <reason>`.
 * The dash may be em/en/hyphen (the pi marker uses an em dash; operators
 * type hyphens), and the reason must be non-empty — an override without a
 * stated reason is not an audited override.
 */
const OVERRIDE_PATTERN =
  /#\s*steering-override:\s*([A-Za-z0-9._-]+)\s*[—–-]\s*(\S.*)/

/** Parse the override marker out of a call's text surface. */
export function parseSteeringOverride(
  text: string,
): SteeringOverride | undefined {
  const match = text.match(OVERRIDE_PATTERN)
  if (!match) return undefined
  const reason = match[2].trim()
  if (reason === '') return undefined
  return { ruleId: match[1], reason }
}

/**
 * The text a rule matches against: every string value of the tool input
 * (command, path, content, instructions…), newline-joined. Universal by
 * construction — a tool that gains a field needs no engine change.
 */
export function steeringTextSurface(
  input: Record<string, JSONValue> | null | undefined,
): string {
  if (!input) return ''
  const parts: string[] = []
  for (const value of Object.values(input)) {
    if (typeof value === 'string') parts.push(value)
  }
  return parts.join('\n')
}

function compile(
  pattern: string,
): { ok: true; value: RegExp } | { ok: false; error: string } {
  try {
    return { ok: true, value: new RegExp(pattern) }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

/** Compile specs into evaluable rules. Invalid entries are dropped + reported. */
export function compileSteeringRules(specs: readonly SteeringRuleSpec[]): {
  rules: CompiledSteeringRule[]
  errors: string[]
} {
  const rules: CompiledSteeringRule[] = []
  const errors: string[] = []
  for (const spec of specs) {
    const tool = compile(spec.tool)
    const match = compile(spec.match)
    if (!tool.ok || !match.ok) {
      errors.push(
        `steering rule "${spec.id}" dropped: invalid regex (${[tool, match]
          .filter((result) => !result.ok)
          .map((result) => (result.ok ? '' : result.error))
          .join('; ')})`,
      )
      continue
    }
    const conjunctions = compileAll(spec.requires ?? [], spec.id, 'requires')
    const exemptions = compileAll(spec.unless ?? [], spec.id, 'unless')
    if (conjunctions.errors.length > 0 || exemptions.errors.length > 0) {
      errors.push(...conjunctions.errors, ...exemptions.errors)
      continue
    }
    rules.push({
      id: spec.id,
      tool: tool.value,
      match: match.value,
      requires: conjunctions.rules,
      unless: exemptions.rules,
      noOverride: spec.noOverride === true,
      reason: spec.reason,
    })
  }
  return { rules, errors }
}

function compileAll(
  patterns: readonly string[],
  ruleId: string,
  field: 'requires' | 'unless',
): { rules: RegExp[]; errors: string[] } {
  const rules: RegExp[] = []
  const errors: string[] = []
  for (const pattern of patterns) {
    const compiled = compile(pattern)
    if (compiled.ok) rules.push(compiled.value)
    else {
      errors.push(
        `steering rule "${ruleId}" dropped: invalid ${field} regex (${compiled.error})`,
      )
    }
  }
  return { rules, errors }
}

/** True when the rule's conjunctions/exemptions permit it to fire. */
function ruleApplies(rule: CompiledSteeringRule, text: string): boolean {
  if (rule.unless.some((pattern) => pattern.test(text))) return false
  return rule.requires.every((pattern) => pattern.test(text))
}

/**
 * Evaluate the rules in declaration order. The FIRST matching rule decides,
 * so an `noOverride` guard can be declared ahead of a narrower one and a
 * matching rule can never be shadowed by a later override-friendly rule.
 */
export function evaluateSteeringRules(
  rules: readonly CompiledSteeringRule[],
  params: { toolName: string; text: string },
): SteeringDecision {
  for (const rule of rules) {
    if (!rule.tool.test(params.toolName)) continue
    if (!rule.match.test(params.text)) continue
    if (!ruleApplies(rule, params.text)) continue
    if (rule.noOverride) return { kind: 'block', rule }
    const override = parseSteeringOverride(params.text)
    if (override && override.ruleId === rule.id) {
      return { kind: 'override', rule, override }
    }
    return { kind: 'block', rule }
  }
  return { kind: 'allow' }
}

/** The operator-facing blocking text for a rule the call violated. */
export function formatSteeringBlock(
  rule: CompiledSteeringRule,
  toolName: string,
): string {
  const escape = rule.noOverride
    ? 'This rule cannot be overridden.'
    : `Retry with \`# steering-override: ${rule.id} — <reason>\` to override it.`
  return `[Steering] BLOCKED ${toolName} by rule "${rule.id}": ${rule.reason} ${escape}`
}
