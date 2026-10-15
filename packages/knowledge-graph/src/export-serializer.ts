/**
 * Backward-compatible barrel for the Code Universe serializer
 * (FID-2026-0809-011 Phase A). The implementation was split by cohesion into
 * `export/types.ts` (payload types), `export/helpers.ts` (constants, private
 * helpers, readFilePreview), and `export/serialize.ts` (serializeGraphForExport).
 *
 * Only the *original* public surface is re-exported — the payload types,
 * `readFilePreview`, and `serializeGraphForExport` — so the
 * `@savant-code/knowledge-graph` package API is byte-for-byte identical to the
 * pre-split module (Law 4 reachability preserved; no new public symbols leak
 * from the internal helpers module).
 */
export * from './export/types'
export { readFilePreview } from './export/helpers'
export { serializeGraphForExport } from './export/serialize'
