/**
 * Equivalence grader — FID-2026-0813-016.
 *
 * Behavior first, anti-cheat second. The hidden behavioral tests (already run
 * by the sandbox) are the correctness oracle; source inspection is only a
 * diagnostic signal and can never reject a valid alternate implementation by
 * itself. A hardcoded shortcut that reproduces the visible examples without
 * general logic is flagged, but a different valid algorithm always passes.
 */
import type {
  EquivalenceGradeInput,
  EquivalenceGrader,
} from '../exercise/grader'
import type { EquivalenceResult } from '@savant-code/common/teacher'

export const EQUIVALENCE_GRADER_VERSION = 'equivalence-v1'

/**
 * Deterministic hardcoding heuristic: many literal equality comparisons against
 * numeric constants, with no general relational/aggregate logic. This is a
 * signal only — the hidden tests remain the primary oracle.
 */
export function detectHardcoding(source: string): boolean {
  const literalComparisons = (
    source.match(/(?:===|==)\s*-?\d+(?:\.\d+)?/g) ?? []
  ).length
  const hasGeneralLogic = /(>|<|>=|<=|Math\.max|Math\.min)/.test(source)
  return literalComparisons >= 3 && !hasGeneralLogic
}

export class BehaviorFirstEquivalenceGrader implements EquivalenceGrader {
  readonly graderVersion = EQUIVALENCE_GRADER_VERSION

  async grade(input: EquivalenceGradeInput): Promise<EquivalenceResult> {
    const { solutionSource, sandboxResult } = input
    const findings: string[] = []

    const behaviorPassed = sandboxResult.status === 'passed'
    if (!behaviorPassed) {
      findings.push(`hidden tests not passed: ${sandboxResult.status}`)
    }

    const hardcoded = detectHardcoding(solutionSource)
    if (hardcoded) {
      findings.push('test-specific hardcoding suspected')
    }

    if (sandboxResult.status === 'timed_out') {
      findings.push('resource limit exceeded')
    }

    return {
      passed: behaviorPassed && !hardcoded,
      testSummary: sandboxResult.testSummary,
      antiCheat: { passed: !hardcoded, findings },
      graderVersion: this.graderVersion,
    }
  }
}

export const behaviorFirstEquivalenceGrader: EquivalenceGrader =
  new BehaviorFirstEquivalenceGrader()
