/**
 * templates/agent-validation — Dynamic agent template validation.
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `agent-validation/rules.ts` and `agent-validation/validate.ts`. All
 * public symbols are re-exported so existing imports continue to resolve
 * unchanged.
 */

export * from './agent-validation/rules'
export * from './agent-validation/validate'
