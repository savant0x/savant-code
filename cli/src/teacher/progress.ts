/**
 * Teacher progression read — FID-2026-0813-019.
 *
 * Pure read of the versioned competency record from an already-open store. It
 * never opens, creates, or closes storage — the session manager owns store
 * lifecycle (so the read runs against the DI test override or the project
 * store). Extracted from `runtime.ts` to stay under the file-length baseline.
 */
import type { ProgressionStore } from '@savant-code/agent-runtime/teacher/index'
import type {
  CompetencyState,
  CompletionState,
  ProgressionRecord,
  SkillId,
} from '@savant-code/common/teacher'

/** One skill's versioned competency record, read from the local store. */
export type TeacherProgressEntry = {
  skill: SkillId
  state: CompetencyState
  /** Recorded attempts for this skill (terminal pass/fail only). */
  attemptCount: number
  /** Attempt ids backing the current competency edge. */
  evidenceAttempts: number
  /** Latest recorded attempt's versioned metadata, or null when none. */
  latest: {
    attemptId: string
    completionState: CompletionState
    timestamp: string
    receiptStatus: ProgressionRecord['receiptStatus']
    versions: ProgressionRecord['versions']
  } | null
}

export type TeacherProgressSummary = {
  entries: TeacherProgressEntry[]
  totalAttempts: number
}

/**
 * Build the competency summary from an open store: competency edges joined
 * with their backing attempts, plus the latest attempt's versioned metadata.
 */
export function readProgressFromStore(
  store: ProgressionStore,
): TeacherProgressSummary {
  const attempts = store.listAttempts()
  const edges = store.listCompetencies()
  const attemptsBySkill = new Map<string, ProgressionRecord[]>()
  for (const attempt of attempts) {
    const list = attemptsBySkill.get(attempt.skill) ?? []
    list.push(attempt)
    attemptsBySkill.set(attempt.skill, list)
  }
  const entries: TeacherProgressEntry[] = edges.map((edge) => {
    const skillAttempts = attemptsBySkill.get(edge.skill) ?? []
    const latest = skillAttempts[skillAttempts.length - 1] ?? null
    return {
      skill: edge.skill,
      state: edge.state,
      attemptCount: skillAttempts.length,
      evidenceAttempts: edge.evidence.length,
      latest: latest
        ? {
            attemptId: latest.attemptId,
            completionState: latest.completionState,
            timestamp: latest.timestamp,
            receiptStatus: latest.receiptStatus,
            versions: latest.versions,
          }
        : null,
    }
  })
  return { entries, totalAttempts: attempts.length }
}
