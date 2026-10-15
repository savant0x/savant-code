// Re-export shim — implementation lives in tools/tool-executor/ modules (see
// FID-2026-0805-003). Public API surface is preserved exactly.

// FID-2026-0805-003 (file-length deconstruction, Phase 1): the tool-call
// parse / repair / transform helpers (CustomToolCall, ToolCallError,
// isJSONObject, countWriteLines, parseRawToolCall, parseRawCustomToolCall,
// tryTransformAgentToolCall + the bare-string repair internals) live in
// ./tool-call-parse. Re-exported here so every existing consumer
// (namespace imports in tests, stream-parser, run-programmatic-step) resolves
// unchanged. Zero behavior change — pure module move.
export {
  countWriteLines,
  isJSONObject,
  parseRawCustomToolCall,
  parseRawToolCall,
  tryTransformAgentToolCall,
} from './tool-call-parse'
export type { CustomToolCall, ToolCallError } from './tool-call-parse'
export { executeCustomToolCall } from './tool-executor/custom'
export { executeToolCall } from './tool-executor/native'
export type { ExecuteToolCallParams } from './tool-executor/types'
