/**
 * cli/src/utils/settings — Persisted user settings.
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `settings/types.ts`, `settings/constants.ts`, `settings/validation.ts`,
 * `settings/io.ts`, and `settings/preferences.ts`. All public symbols are
 * re-exported so existing imports continue to resolve unchanged.
 */

export * from './settings/types'
export * from './settings/constants'
export * from './settings/validation'
export * from './settings/io'
export * from './settings/preferences'
export * from './settings/model-selection'
