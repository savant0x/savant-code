/**
 * Skill-management surface types and tuning constants
 * (FID-2026-0819-005 Loop 304: extracted verbatim from
 * `common/src/util/skill-management.ts`).
 */

export const SKILL_VERSIONS_DIR_NAME = 'versions'
export const SKILL_VERSIONS_LEDGER_NAME = 'VERSIONS.jsonl'
/** Perfection-Loop circuit breaker applied to skill patches (S2-B). */
export const PATCH_MAX_CHANGE_RATIO = 0.1
/** Default version for freshly created skills. */
export const SKILL_INITIAL_VERSION = '0.1.0'

export const SKILL_MANAGE_ACTIONS = [
  'create',
  'patch',
  'edit',
  'delete',
  'write_file',
  'remove_file',
  'rollback',
] as const
export type SkillManageAction = (typeof SKILL_MANAGE_ACTIONS)[number]

export const SEMVER_BUMP_KINDS = ['patch', 'minor', 'major'] as const
export type SemverBumpKind = (typeof SEMVER_BUMP_KINDS)[number]

export type SkillLedgerEntry = {
  seq: number
  /** Semver AFTER the mutation. */
  version: string
  action: SkillManageAction
  ts: string
  sessionId: string
  reason: string
  prevSha: string | null
  nextSha: string
  /** Source lesson / session evidence (FID-2026-0824-012 provenance). */
  provenanceRef: string
  /** True when the change passed the semantic-preservation check. */
  semanticPreservation: boolean
}

export type SkillManageResult =
  | {
      ok: true
      name: string
      version: string
      action: SkillManageAction
      nextSha: string
      /** True when the change is pending operator trust (quarantine). */
      pendingTrust: boolean
      message?: string
    }
  | { ok: false; error: string }
