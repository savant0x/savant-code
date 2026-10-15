/**
 * util/messages — Message construction, trimming, and history helpers.
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `util/messages/framing.ts`, `util/messages/trimming.ts`, and
 * `util/messages/history.ts`. All public symbols are re-exported so existing
 * imports continue to resolve unchanged.
 */

export * from './messages/framing'
export * from './messages/trimming'
export * from './messages/history'
