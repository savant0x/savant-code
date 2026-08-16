export type * from '@savant-code/common/types/json'
export type * from '@savant-code/common/types/messages/savant-code-message'
export type * from '@savant-code/common/types/messages/data-content'
export type * from '@savant-code/common/types/print-mode'
export type {
  TextPart,
  ImagePart,
} from '@savant-code/common/types/messages/content-part'
export { run, STATE_SNAPSHOT_INTERRUPTION_MESSAGE } from './run'
export { getFiles } from './tools/read-files'
export type { FileFilter, FileFilterResult } from './tools/read-files'
export type {
  SavantCodeClientOptions,
  RunOptions,
  MessageContent,
  TextContent,
  ImageContent,
} from './run'
export type { TraceWriter } from '@savant-code/common/types/contracts/trace'
export { buildUserMessageContent } from '@savant-code/agent-runtime/util/messages'
// FID-2026-0803-004: persistent per-turn file checkpoints (rewind). The CLI
// owns the turn lifecycle (openTurn before run, closeTurn after) and reads
// checkpoints back for /rewind; the runtime captures pre-write snapshots.
import {
  CHECKPOINT_RETENTION,
  captureSnapshot,
  clearOpenTurnsForTesting,
  closeTurn,
  forkFrom,
  getTurn,
  listTurns,
  openTurn,
  restoreTurn as restoreTurnImpl,
} from '@savant-code/agent-runtime/tools/handlers/tool/checkpoint-store'

export const restoreTurn = (...args: Parameters<typeof restoreTurnImpl>) =>
  restoreTurnImpl(...args)

void [
  openTurn,
  captureSnapshot,
  closeTurn,
  listTurns,
  getTurn,
  forkFrom,
  clearOpenTurnsForTesting,
  CHECKPOINT_RETENTION,
]

export {
  openTurn,
  captureSnapshot,
  closeTurn,
  listTurns,
  getTurn,
  forkFrom,
  clearOpenTurnsForTesting,
  CHECKPOINT_RETENTION,
}
export type {
  CheckpointFileEntry,
  TurnCheckpoint,
  TurnSummary,
} from '@savant-code/agent-runtime/tools/handlers/tool/checkpoint-store'
// Agent type exports
export type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
export type { ToolName } from '@savant-code/common/tools/constants'

export type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
export * from './client'
export * from './custom-tool'
export * from './native/ripgrep'
export * from './run-state'
export { ToolHelpers } from './tools'
export * from './constants'
export type { OnFileWrittenCallback } from './tools/change-file'

export { getUserInfoFromApiKey } from './impl/database'
export * from './credentials'
export { loadLocalAgents } from './agents/load-agents'
export { loadMCPConfig, loadMCPConfigSync } from './agents/load-mcp-config'
export { loadSkills, parseSkillFileContent } from './skills/load-skills'
export { formatAvailableSkillsXml } from '@savant-code/common/util/skills'
export type { LoadSkillsOptions } from './skills/load-skills'
export type {
  SkillDefinition,
  SkillsMap,
} from '@savant-code/common/types/skill'
export type {
  LoadedAgents,
  LoadedAgentDefinition,
  LoadLocalAgentsResult,
  AgentValidationError,
} from './agents/load-agents'
export type { MCPFileConfig, LoadedMCPConfig } from './agents/load-mcp-config'

export { validateAgents } from './validate-agents'
export type { ValidationResult, ValidateAgentsOptions } from './validate-agents'

// Error utilities
export {
  isRetryableStatusCode,
  getErrorStatusCode,
  sanitizeErrorMessage,
  RETRYABLE_STATUS_CODES,
  createHttpError,
  createAuthError,
  createForbiddenError,
  createPaymentRequiredError,
  createServerError,
  createNetworkError,
} from './error-utils'
export type { HttpError } from './error-utils'

// Retry configuration constants
export {
  MAX_RETRIES_PER_MESSAGE,
  RETRY_BACKOFF_BASE_DELAY_MS,
  RETRY_BACKOFF_MAX_DELAY_MS,
  RECONNECTION_MESSAGE_DURATION_MS,
  RECONNECTION_RETRY_DELAY_MS,
} from './retry-config'

export type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

// Tree-sitter / code-map exports
export {
  getFileTokenScores,
  setWasmDir,
  setTreeSitterWasmPath,
} from '@savant-code/code-map'
export type { FileTokenData, TokenCallerMap } from '@savant-code/code-map'

export {
  getActiveTerminalCommandProcesses,
  runTerminalCommand,
} from './tools/run-terminal-command'
export type { ActiveTerminalCommandProcess } from './tools/run-terminal-command'
export {
  getInferenceBaseUrlFromEnv,
  getInferenceApiKeyFromEnv,
  getTokenHarborApiKeyFromEnv,
} from './env'
export {
  resolveOpenRouterApiKey,
  resetOpenRouterApiKeyCache,
} from './impl/openrouter-key-resolver'
export {
  promptAiSdk,
  promptAiSdkStream,
  promptAiSdkStructured,
} from './impl/llm'
export {
  resetChatGptOAuthRateLimit,
  isCloudflareModel,
  isCommandCodeModel,
  isTokenHarborModel,
} from './impl/model-provider'
