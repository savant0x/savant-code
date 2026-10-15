// Re-export shim — implementation lives in run/ modules (see run/README note
// in FID-2026-0805-003). Public API surface is preserved exactly.
export { run } from './run/execution'
export {
  STATE_SNAPSHOT_INTERRUPTION_MESSAGE,
  cloneSessionState,
} from './run/types'
export {
  deserializeRunState,
  RUN_STATE_SCHEMA_VERSION,
  serializeRunState,
} from './run-state/serialization'
export { extractStatusCodeFromMessage } from './run/status-code'
export type {
  ImageContent,
  MessageContent,
  RunOptions,
  SavantCodeClientOptions,
  TextContent,
} from './run/types'
