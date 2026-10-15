// Re-export shim (FID-2026-0805-003 methodology). The implementation moved to
// `code-search/{schema,flags,format,executor}.ts`; this path keeps exporting
// the same public surface so no consumer changes.
export { codeSearch } from './code-search/executor'
