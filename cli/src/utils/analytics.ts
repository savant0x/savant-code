// Re-export types from core for backwards compatibility
export type { AnalyticsClientWithIdentify as AnalyticsClient } from '@savant-code/common/analytics-core'

/**
 * cli/src/utils/analytics — PostHog analytics client facade.
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `analytics/state.ts` (module state + public API). All public symbols
 * are re-exported so existing imports continue to resolve unchanged.
 */

export * from './analytics/state'
