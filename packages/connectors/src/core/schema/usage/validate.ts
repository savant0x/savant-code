import type { UsageModel } from './model/mod.ts'
import type { Usage } from './usage.ts'

/** The evidence line id for a LEAF PER_CALL model's flat draw (design
 *  D24/D26). Deliberately NOT in the `Unit` vocabulary — units are
 *  countable quantities; CALL is the reserved flat LINE id. Composite
 *  flat lines key by their own component id instead. */
export const CALL_KEY = 'CALL'

/**
 * The model's FLAT line 1s (design D24/D26): every PER_CALL line draws
 * exactly once per successful run — a constant the model already states,
 * so the ENGINE appends it to the fn quantities before the credits fold.
 * Fns never write flat line ids (`countsMismatch` + the type layer keep
 * rejecting them); error settles stay `zeroUsage()`.
 */
export function flatLines(model: UsageModel): Record<string, number> {
  switch (model.kind) {
    case 'PER_CALL':
      return { [CALL_KEY]: 1 }
    case 'COMPOSITE':
      return Object.fromEntries(
        Object.entries(model.components)
          .filter(([, component]) => component.kind === 'PER_CALL')
          .map(([id]) => [id, 1]),
      )
    case 'PER_UNIT':
    case 'FREE':
      return {}
    default:
      model satisfies never
      return {}
  }
}

/**
 * THE CREDITS FOLD (design D26): quantities → the consumed-credits vector
 * through the doc's OWN rate card. One shared implementation for the
 * engine, the tests and the broker: for each line,
 * `ceil(quantity / every) × consumes.amount` (whole increments — a
 * PER_CALL line has no `every`, its quantity is the engine-appended 1),
 * summed per credit id. FREE folds to `{}`. Anyone holding the doc can
 * re-derive the result from the evidence alone.
 */
export function creditsOf(
  model: UsageModel,
  quantities: Record<string, number>,
): Record<string, number> {
  const credits: Record<string, number> = {}
  const draw = (creditId: string, amount: number) => {
    if (amount <= 0) return
    credits[creditId] = (credits[creditId] ?? 0) + amount
  }
  switch (model.kind) {
    case 'FREE':
      return {}
    case 'PER_CALL':
      draw(
        model.consumes.credit,
        (quantities[CALL_KEY] ?? 0) > 0 ? model.consumes.amount : 0,
      )
      return credits
    case 'PER_UNIT':
      draw(
        model.consumes.credit,
        Math.ceil((quantities[model.unit] ?? 0) / model.every) *
          model.consumes.amount,
      )
      return credits
    case 'COMPOSITE': {
      for (const [id, component] of Object.entries(model.components)) {
        const quantity = quantities[id] ?? 0
        if (component.kind === 'PER_CALL') {
          draw(
            component.consumes.credit,
            quantity > 0 ? component.consumes.amount : 0,
          )
        } else {
          draw(
            component.consumes.credit,
            Math.ceil(quantity / component.every) * component.consumes.amount,
          )
        }
      }
      return credits
    }
    default:
      model satisfies never
      return {}
  }
}

/** The full engine-side assembly (estimate + success settle): fn
 *  quantities + the model's flat 1s → `{credits, evidence}`. */
export function assembleUsage(
  model: UsageModel,
  fnCounts: Record<string, number>,
): Usage {
  const evidence = { ...fnCounts, ...flatLines(model) }
  return { credits: creditsOf(model, evidence), evidence }
}

/** Whether the model has any METERED (PER_UNIT) line — the D27 rule for
 *  when usage.estimate/usage.evidence must resolve vs when the compiler
 *  synthesizes the one lawful `() => ({counts: {}})`: with no metered
 *  lines, nothing depends on input or response. */
export function hasMeteredLines(model: UsageModel): boolean {
  switch (model.kind) {
    case 'PER_UNIT':
      return true
    case 'COMPOSITE':
      return Object.values(model.components).some(
        (component) => component.kind === 'PER_UNIT',
      )
    case 'FREE':
    case 'PER_CALL':
      return false
    default:
      model satisfies never
      return false
  }
}

/** Float-dust tolerance for the vendor-claim vs derived-fold comparison
 *  (design D27) — anything larger is a REAL billing discrepancy. */
export const CREDITS_EPSILON = 1e-9

/** Zero entries mean "nothing consumed" — pruned before the claim is
 *  compared or settled (an all-zero vendor claim = an empty claim). */
export function pruneZeroCredits(
  credits: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(credits).filter(([, amount]) => amount > 0),
  )
}

/** The D27 cross-check: does the vendor's (pruned) claim disagree with
 *  our derived fold anywhere, beyond float dust? */
export function creditsDisagree(
  claim: Record<string, number>,
  derived: Record<string, number>,
): boolean {
  const pools = new Set([...Object.keys(claim), ...Object.keys(derived)])
  for (const pool of pools) {
    const delta = Math.abs((claim[pool] ?? 0) - (derived[pool] ?? 0))
    if (delta > CREDITS_EPSILON) return true
  }
  return false
}

/**
 * Counts ↔ model discipline (design D19/D26) — ONE exhaustive switch,
 * placed beside the schema it interprets so every consumer shares it:
 * the engine (wrapping violations in FN_CONTRACT at settle AND estimate),
 * the test suites' card-invariant helpers, and the services broker.
 * These rules govern what FNS return (QUANTITIES per metered line); the
 * engine then appends flat 1s and folds to credits. Rules, one per kind:
 *   - FREE      → fn counts must be {} (free bills nothing);
 *   - PER_CALL  → fn counts must be {} (the flat 1 is engine-appended);
 *   - PER_UNIT  → the single implied key is the model's unit;
 *   - COMPOSITE → every key names a PER_UNIT line (flat lines are
 *     engine-appended, never fn-written).
 * `{counts: {}}` passes everywhere. Returns the problem as a message
 * (undefined = ok) — the CALLER owns the error type.
 */
export function countsMismatch(
  model: UsageModel,
  counts: Record<string, number>,
): string | undefined {
  const keys = Object.keys(counts)
  switch (model.kind) {
    case 'FREE':
      return keys.length > 0
        ? `counts on a FREE doc (${keys.join(', ')}) — free bills nothing`
        : undefined
    case 'PER_CALL':
      return keys.length > 0
        ? `counts on a flat doc (${keys.join(', ')})`
        : undefined
    case 'PER_UNIT': {
      const bad = keys.find((key) => key !== model.unit)
      return bad !== undefined
        ? `leaf counts key "${bad}" ≠ the model's unit "${model.unit}"`
        : undefined
    }
    case 'COMPOSITE': {
      const bad = keys.find((key) => model.components[key]?.kind !== 'PER_UNIT')
      return bad !== undefined
        ? `counts key "${bad}" names no metered line ` +
            `(lines: ${Object.keys(model.components).join(', ')})`
        : undefined
    }
    default:
      // EXHAUSTIVENESS: adding a model kind fails `deno task check`
      // right here, before anything runs
      model satisfies never
      return 'unknown model kind'
  }
}
