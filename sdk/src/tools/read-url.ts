/**
 * read-url — Fetch a URL and extract readable text with SSRF protection.
 *
 * FID-2026-0809-016: Backward-compatible shim. The implementation was split
 * into `read-url/constants.ts`, `read-url/extract.ts`, and `read-url/fetch.ts`.
 * All public symbols are re-exported so existing imports continue to resolve
 * unchanged.
 */

export * from './read-url/constants'
export * from './read-url/extract'
export * from './read-url/fetch'
