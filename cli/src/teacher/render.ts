/**
 * Shared teacher rendering helpers — FID-2026-0813-022.
 *
 * Single source of truth for the completion, ZTAP-receipt, and progression
 * lines rendered by both the `/learn` chat result (`learn-result.ts`) and the
 * read-only sidebar overlay (`learn-overlay.tsx`). Pure string functions; no
 * store, filesystem, or runtime access.
 */
import type {
  CompetencyState,
  CompletionState,
  TeacherAttemptReceipt,
} from '@savant-code/common/teacher'

export function completionLabel(state: CompletionState): string {
  switch (state) {
    case 'passed':
      return '✓ PASSED'
    case 'failed':
      return '✗ FAILED'
    case 'unavailable':
      return '⚠ UNAVAILABLE — the sandbox/Forge could not provide its guarantees'
    case 'cancelled':
      return '· CANCELLED'
  }
}

export function receiptLine(receipt: TeacherAttemptReceipt | null): string {
  return receipt
    ? `ZTAP receipt: signed by ${receipt.role} over ${receipt.over}`
    : 'ZTAP receipt: local-unverified (no session key)'
}

export function progressionLine(
  persisted: boolean,
  competencyState: CompetencyState | null,
): string {
  if (!persisted) return 'Progression: not recorded'
  return `Progression: recorded (competency ${competencyState ?? 'attempted'})`
}
