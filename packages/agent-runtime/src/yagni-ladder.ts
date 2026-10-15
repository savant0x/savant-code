/**
 * P5a — YAGNI ladder (FID-2026-0806-003 Phase 5).
 *
 * The Ponytail decision ladder as a TYPED evaluator, not a prompt suggestion
 * (the research doc's core warning: unstructured "write one-liners" drops
 * path-traversal guards; YAGNI must be laddered AND exempted).
 *
 * Rungs (each mapped to an evidence source):
 *   1. Does this need to exist?          -> FID scope
 *   2. Already in this codebase?         -> code-map / code_search reuse
 *   3. Does the stdlib solve it?         -> language built-ins
 *   4. Does a native platform feature?   -> DB constraints, HTML/CSS
 *   5. Is an installed dependency available? -> package.json / Cargo.toml
 *   6. Can it be a one-liner?            -> minimal implementation
 *
 * SAFE-BY-CONSTRUCTION exemptions (never minimized — the research doc's own
 * guard): trust-boundary validation, error paths (Law 14), type safety
 * (Law 6). The Forge gate (pre-write-gates.ts) and the Verifier's YAGNI
 * Assessment consume this module; the Adversary guards against over-penalty.
 */

export interface YagniAssessment {
  /** True when the proposed code is speculative ("for later" scaffolding). */
  isSpeculative: boolean
  /** Entities (functions/types/patterns) reused from the existing codebase. */
  reusedEntities: string[]
  /** Standard-library alternatives that make a custom implementation unnecessary. */
  stdlibAlternatives: string[]
  /** New dependencies that were deliberately avoided. */
  dependenciesAvoided: string[]
  /** `ponytail:` debt markers the implementation inserted (ceiling + upgrade path). */
  debtMarkersInserted: string[]
  /** Which ladder rungs were actually evaluated. */
  rungsTraversed: number[]
  /** Exempted domains — trust boundary / error path / type safety. */
  exemptions: Array<'trust_boundary' | 'error_path' | 'type_safety'>
}

/**
 * Builds an empty assessment with the given exemptions. Exempted domains are
 * never speculative by construction: a rung that would cut a trust-boundary
 * check or a Law-14 error path must not be applied.
 */
export function createYagniAssessment(
  exemptions: YagniAssessment['exemptions'] = [],
): YagniAssessment {
  return {
    isSpeculative: false,
    reusedEntities: [],
    stdlibAlternatives: [],
    dependenciesAvoided: [],
    debtMarkersInserted: [],
    rungsTraversed: [],
    exemptions,
  }
}

/** Rung 1 — does this need to exist? Requires an explicit FID/scope justification. */
export function evaluateNeedToExist(params: {
  assessment: YagniAssessment
  /** True when the FID or user request explicitly demands the code. */
  requiredByScope: boolean
}): YagniAssessment {
  const { assessment, requiredByScope } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 1],
    isSpeculative: assessment.isSpeculative || !requiredByScope,
  }
}

/** Rung 2 — already in this codebase? Supply reused entity paths/names. */
export function evaluateCodebaseReuse(params: {
  assessment: YagniAssessment
  reusedEntities: string[]
}): YagniAssessment {
  const { assessment, reusedEntities } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 2],
    reusedEntities: [...assessment.reusedEntities, ...reusedEntities],
  }
}

/** Rung 3 — does the standard library solve it? */
export function evaluateStdlib(params: {
  assessment: YagniAssessment
  stdlibAlternatives: string[]
}): YagniAssessment {
  const { assessment, stdlibAlternatives } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 3],
    stdlibAlternatives: [
      ...assessment.stdlibAlternatives,
      ...stdlibAlternatives,
    ],
  }
}

/** Rung 4 — does a native platform feature cover it? */
export function evaluateNativePlatform(params: {
  assessment: YagniAssessment
  /** e.g. a DB CHECK constraint or an HTML <input> attribute replacing JS. */
  nativeAlternatives: string[]
}): YagniAssessment {
  const { assessment, nativeAlternatives } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 4],
    dependenciesAvoided: [
      ...assessment.dependenciesAvoided,
      ...nativeAlternatives,
    ],
  }
}

/** Rung 5 — is an installed dependency available before adding a new one? */
export function evaluateInstalledDependency(params: {
  assessment: YagniAssessment
  /** New dependencies avoided because an installed one suffices. */
  dependenciesAvoided: string[]
}): YagniAssessment {
  const { assessment, dependenciesAvoided } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 5],
    dependenciesAvoided: [
      ...assessment.dependenciesAvoided,
      ...dependenciesAvoided,
    ],
  }
}

/** Rung 6 — can it be a one-liner? Records the rung; minimalism is judged
 *  at finalization, never on exempted domains. */
export function evaluateOneLiner(params: {
  assessment: YagniAssessment
  /** True when the implementation can be a single expression/statement. */
  canBeOneLiner: boolean
}): YagniAssessment {
  const { assessment, canBeOneLiner } = params
  return {
    ...assessment,
    rungsTraversed: [...assessment.rungsTraversed, 6],
    // A need that the FID demands is not made speculative by being
    // implementable in one line — the rung records the minimal form.
    ...(canBeOneLiner && !assessment.isSpeculative
      ? { stdlibAlternatives: [...assessment.stdlibAlternatives] }
      : {}),
  }
}

/**
 * Records a permitted shortcut as a `ponytail:` debt marker. The marker names
 * the ceiling (what was not built) and the upgrade path (when to build it).
 */
export function recordDebtMarker(params: {
  assessment: YagniAssessment
  ceiling: string
  upgradePath: string
}): YagniAssessment {
  const { assessment, ceiling, upgradePath } = params
  return {
    ...assessment,
    debtMarkersInserted: [
      ...assessment.debtMarkersInserted,
      `ponytail: ceiling=${ceiling}; upgrade=${upgradePath}`,
    ],
  }
}

/**
 * Finalizes the assessment. The gate rule (consumed by pre-write-gates and the
 * Verifier): a write that declares `isSpeculative: true` WITHOUT a documented
 * debt marker is rejected; with a marker it is Debt-Incurred (accepted but
 * ledgered). Exempted domains never trip the gate even when minimally written.
 */
export function assessWrite(params: { assessment: YagniAssessment }): {
  verdict: 'verified' | 'debt_incurred' | 'rejected'
  reason?: string
} {
  const { assessment } = params
  if (!assessment.isSpeculative) {
    return { verdict: 'verified' }
  }
  if (assessment.debtMarkersInserted.length > 0) {
    return { verdict: 'debt_incurred' }
  }
  return {
    verdict: 'rejected',
    reason:
      'YAGNI: write declares speculative scope without a ponytail: debt marker — either cut the code or document the ceiling + upgrade path',
  }
}

/**
 * Extracts `ponytail:` debt markers from a text blob (inline comments, FID
 * sections). P5c's harvest path uses this; the regex matches the marker
 * convention emitted by recordDebtMarker and the research doc's inline form.
 */
export function harvestPonytailMarkers(text: string): string[] {
  const markers: string[] = []
  const regex =
    /ponytail:\s*(?:ceiling=([^;]*);\s*upgrade=([^;\n]*)|(?:[^\n]*))/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      markers.push(
        `ponytail: ceiling=${match[1].trim()}; upgrade=${match[2].trim()}`,
      )
    } else {
      markers.push(match[0].trim())
    }
  }
  return markers
}

/**
 * Validates a Forge-emitted `yagni_check` JSON block shape. Returns the parsed
 * assessment when valid, or null with a reason when malformed.
 */
export function parseYagniCheckBlock(json: string): {
  assessment: YagniAssessment
  reason?: string
} {
  try {
    const raw = JSON.parse(json) as Partial<YagniAssessment>
    const assessment: YagniAssessment = {
      isSpeculative: raw.isSpeculative === true,
      reusedEntities: Array.isArray(raw.reusedEntities)
        ? raw.reusedEntities.filter((e): e is string => typeof e === 'string')
        : [],
      stdlibAlternatives: Array.isArray(raw.stdlibAlternatives)
        ? raw.stdlibAlternatives.filter(
            (e): e is string => typeof e === 'string',
          )
        : [],
      dependenciesAvoided: Array.isArray(raw.dependenciesAvoided)
        ? raw.dependenciesAvoided.filter(
            (e): e is string => typeof e === 'string',
          )
        : [],
      debtMarkersInserted: Array.isArray(raw.debtMarkersInserted)
        ? raw.debtMarkersInserted.filter(
            (e): e is string => typeof e === 'string',
          )
        : [],
      rungsTraversed: Array.isArray(raw.rungsTraversed)
        ? raw.rungsTraversed.filter((r): r is number => typeof r === 'number')
        : [],
      exemptions: Array.isArray(raw.exemptions)
        ? raw.exemptions.filter(
            (e): e is YagniAssessment['exemptions'][number] =>
              e === 'trust_boundary' ||
              e === 'error_path' ||
              e === 'type_safety',
          )
        : [],
    }
    return { assessment }
  } catch {
    return {
      assessment: createYagniAssessment(),
      reason: 'yagni_check block is not valid JSON',
    }
  }
}
