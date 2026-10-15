/**
 * `/learn progress` rendering — FID-2026-0813-019.
 *
 * Pure line rendering of the read-only competency summary. No store access, no
 * side effects; separated from the command so the command file stays under the
 * project's file-length baseline.
 */
import type { TeacherProgressSummary } from '../teacher/progress'

/** Render the local store's versioned competency record (read-only). */
export function progressLines(
  summary: TeacherProgressSummary | null,
): string[] {
  if (!summary) {
    return [
      '📊 **Teacher progress**',
      '',
      'No local progression store is available for this project yet, or it',
      'could not be opened (no project, or a newer on-disk schema). Complete',
      'a `/learn start` + `/learn critique` attempt to create one.',
    ]
  }
  if (summary.entries.length === 0) {
    return [
      '📊 **Teacher progress**',
      '',
      'No competency records yet.',
      'Complete a `/learn start` + `/learn critique` attempt to record one.',
    ]
  }
  const lines = [
    '📊 **Teacher progress**',
    `Attempts recorded: ${summary.totalAttempts}`,
    '',
  ]
  for (const entry of summary.entries) {
    lines.push(`Skill: ${entry.skill} — ${entry.state}`)
    lines.push(
      `  attempts ${entry.attemptCount} · evidence ${entry.evidenceAttempts}`,
    )
    if (entry.latest) {
      lines.push(
        `  latest: ${entry.latest.completionState} (${entry.latest.receiptStatus}) at ${entry.latest.timestamp}`,
      )
      lines.push(
        `  versions: corpus ${entry.latest.versions.corpus} · sandbox ${entry.latest.versions.sandboxPolicy} · grader ${entry.latest.versions.grader} · mutation ${entry.latest.versions.mutation}`,
      )
    }
    lines.push('')
  }
  return lines
}
