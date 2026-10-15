// Re-export shim — implementation lives in run-state/ modules (see
// FID-2026-0805-003). Public API surface is preserved exactly.
export {
  KNOWLEDGE_FILE_NAMES,
  PRIMARY_KNOWLEDGE_FILE_NAME,
  isKnowledgeFile,
} from '@savant-code/common/constants/knowledge'
export { childProcessToPromise } from './run-state/child-process'
export { buildFileTree } from './run-state/file-tree'
export { initialSessionState } from './run-state/initial-state'
export {
  loadUserKnowledgeFiles,
  selectHighestPriorityKnowledgeFile,
  selectKnowledgeFilePaths,
} from './run-state/knowledge-files'
export {
  applyOverridesToSessionState,
  generateInitialRunState,
  withAdditionalMessage,
  withMessageHistory,
} from './run-state/mutations'
export type { InitialSessionStateOptions, RunState } from './run-state/types'
export {
  deserializeRunState,
  RUN_STATE_SCHEMA_VERSION,
  serializeRunState,
} from './run-state/serialization'
export type { RunStateTransport } from './run-state/serialization'
