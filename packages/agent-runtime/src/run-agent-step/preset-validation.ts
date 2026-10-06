/**
 * FID-2026-1006-003 WP4: the preset contract and its static validator moved to
 * `common/src/util/orchestration-preset.ts` — the single owner in `common`,
 * where `readProtocolConfig` now parses and validates the declared
 * `orchestration:` preset.
 *
 * This module stays as the import surface the existing suite uses
 * (`packages/agent-runtime/src/__tests__/preset-validation.test.ts`), so the
 * path, the exported names, and the behavior are unchanged.
 */
export {
  LOOP_BACK_ROLE_THRESHOLD,
  resolveStartEvent,
  validatePreset,
} from '@savant-code/common/util/orchestration-preset'

export type {
  PresetShape,
  PresetValidationIssue,
  RolePreset,
} from '@savant-code/common/util/orchestration-preset'
