/**
 * `/learn` result rendering — FID-2026-0813-018.
 *
 * Pure line rendering of a terminal exercise attempt: equivalence, detection,
 * the ZTAP receipt line, and the progression status. No store access, no side
 * effects; separated from the command so the command file stays under the
 * project's file-length baseline. The completion/receipt/progression lines are
 * shared with the sidebar overlay via `../teacher/render` (FID-2026-0813-022).
 */
import {
  completionLabel,
  progressionLine,
  receiptLine,
} from '../teacher/render'

import type {
  AttemptResult,
  CompetencyState,
  TeacherAttemptReceipt,
} from '@savant-code/common/teacher'

/** Render a terminal attempt result (equivalence + detection + receipt). */
export function resultLines(
  result: AttemptResult,
  receipt: TeacherAttemptReceipt | null,
  persisted: boolean,
  competencyState: CompetencyState | null,
): string[] {
  const eq = result.equivalenceResult
  const det = result.detectionResult
  const lines = [
    '📋 **Exercise result**',
    `Attempt: ${result.attemptId}`,
    `Outcome: ${completionLabel(result.completionState)}`,
    `Equivalence: ${eq.passed ? 'passed' : 'failed'} (${eq.testSummary.passed}/${eq.testSummary.total} hidden tests)`,
  ]
  if (eq.antiCheat.findings.length > 0) {
    lines.push(`Anti-cheat: ${eq.antiCheat.findings.join('; ')}`)
  }
  if (
    result.completionState === 'failed' &&
    eq.testSummary.failedNames.length
  ) {
    lines.push(`Failing cases: ${eq.testSummary.failedNames.join(', ')}`)
  }
  if (det.mutationId) {
    lines.push(
      `Detection: ${det.grade.identified ? 'flaw identified' : 'not identified'} (${det.grade.reasonCode}, confidence ${det.grade.confidence})`,
    )
  }
  lines.push(receiptLine(receipt))
  lines.push(progressionLine(persisted, competencyState))
  return lines
}
