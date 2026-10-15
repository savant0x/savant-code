/**
 * Re-export shim (FID-2026-0805-003 methodology; FID-2026-0809-015 Batch A).
 * Implementation moved to `export/{constants,read-preview,universe-builder}.ts`;
 * this path keeps exporting the same public surface (the two document-budget
 * defaults, positiveLimit, buildUniverse, readFilePreview) so no consumer
 * changes. Call chain stays one-directional (universe-builder → read-preview →
 * constants) — no helpers ↔ serialize cycle (FID-2026-0809-011 Loop 2).
 */
export {
  DEFAULT_DOCUMENT_IMAGE_BYTES,
  DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES,
} from './constants'

export { positiveLimit, readFilePreview } from './read-preview'

export { buildUniverse } from './universe-builder'
