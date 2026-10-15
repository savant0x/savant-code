/**
 * use-loop-scheduler — Cadence-based loop scheduling hook.
 *
 * FID-2026-0726-001: Backward-compatible shim. The implementation was split
 * into `use-loop-scheduler/types.ts`, `use-loop-scheduler/scheduler.ts`, and
 * `use-loop-scheduler/hooks.ts` (FID-2026-0809-016). All public symbols are
 * re-exported so existing imports continue to resolve unchanged.
 */

export * from './use-loop-scheduler/types'
export * from './use-loop-scheduler/scheduler'
export * from './use-loop-scheduler/hooks'
