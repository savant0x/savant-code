import { buildUserMessageContent } from '@savant-code/agent-runtime/util/messages'
import { cloneDeep } from 'lodash'

import type { CustomToolDefinition } from '../custom-tool'
import type { RunState } from '../run-state'
import type { OnFileWrittenCallback } from '../tools/change-file'
import type { FileFilter } from '../tools/read-files'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { PublishedClientToolName } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  ImagePart,
  TextPart,
  ToolResultOutput,
} from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { SessionState } from '@savant-code/common/types/session-state'
import type { Source } from '@savant-code/common/types/source'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'
import type { ProtocolVariant } from '@savant-code/common/util/boot-contract'

/**
 * Wraps content for user messages, ensuring text is wrapped in <user_message> tags.
 * Uses buildUserMessageContent from agent-runtime for consistency.
 */
export const wrapContentForUserMessage = (
  content?: (TextPart | ImagePart)[],
): (TextPart | ImagePart)[] | undefined => {
  if (!content || content.length === 0) {
    return content
  }
  // Delegate to the shared utility which handles wrapping correctly
  return buildUserMessageContent(undefined, undefined, content)
}

export type OverrideToolHandlers = {
  [K in PublishedClientToolName]?: (
    input: Record<string, JSONValue>,
  ) => Promise<ToolResultOutput[]>
} & {
  // Include read_files separately, since it has a different signature.
  read_files?: (input: {
    filePaths: string[]
  }) => Promise<Record<string, string | null>>
}

export function isRunPauseError<T>(error: T): error is T & { name?: string } {
  if (!error || typeof error !== 'object') return false
  const err = error as { name?: unknown }
  return err.name === 'SavantCodeRunPausedError'
}

export type SavantCodeClientOptions = {
  apiKey?: string

  cwd?: string
  /** Optional directory path to load skills from. Skills found here will be available to the `skill` tool. */
  skillsDir?: string
  projectFiles?: Record<string, string>
  knowledgeFiles?: Record<string, string>
  agentDefinitions?: AgentDefinition[]
  maxAgentSteps?: number
  env?: Record<string, string>

  handleEvent?: (event: PrintModeEvent) => void | Promise<void>
  handleStreamChunk?: (
    chunk:
      | string
      | {
          type: 'subagent_chunk'
          agentId: string
          agentType: string
          chunk: string
        }
      | {
          type: 'reasoning_chunk'
          agentId: string
          ancestorRunIds: string[]
          chunk: string
        },
  ) => void | Promise<void>

  /** Optional filter to classify files before reading (runs before gitignore check) */
  fileFilter?: FileFilter

  overrideTools?: OverrideToolHandlers
  customToolDefinitions?: CustomToolDefinition[]

  fsSource?: Source<SavantCodeFileSystem>
  spawnSource?: Source<SavantCodeSpawn>
  logger?: Logger
  /** Optional debug trace of agent message histories. Called with the full
   *  history at each agent step boundary; implementations should append each
   *  message once (see TraceWriter). */
  traceWriter?: TraceWriter
}

export type ImageContent = {
  type: 'image'
  image: string // base64 encoded
  mediaType: string
}

export type TextContent = {
  type: 'text'
  text: string
}

export type MessageContent = TextContent | ImageContent

export type RunOptions = {
  agent: string | AgentDefinition
  prompt: string
  /** Content array for multimodal messages (text + images) */
  content?: MessageContent[]
  params?: Record<string, JSONValue>
  previousRun?: RunState
  extraToolResults?: ToolMessage[]
  signal?: AbortSignal
  /** Optional steering hook. Drained at each agent step boundary during the run;
   * any returned texts are appended to the conversation as user prompts (and keep
   * the turn going) before the next LLM call. Lets a host inject messages into a
   * running agent without aborting — i.e. "steer" it, as opposed to queuing a new
   * prompt for after the turn finishes. */
  drainSteeringMessages?: () => string[]
  /** Extra key/values merged into each LLM request's `savant_code_metadata`.
   *  Used by hosts (e.g. the CLI) to forward client-scoped identifiers like
   *  `savant_free_instance_id` that server-side gates read from the request body. */
  extraSavantCodeMetadata?: Record<string, string>
  /** Optional checkpoint hook. Called once when the run starts and then
   *  periodically while it is in flight, with a RunState snapshot that
   *  preserves all progress so far (the user's prompt plus any completed
   *  agent steps, ending with an interruption note). Hosts can persist these
   *  snapshots so that a killed process (closed terminal, crash) does not
   *  lose the in-flight turn. The final resolved RunState supersedes any
   *  snapshot; no snapshots are emitted after the run settles. */
  onStateSnapshot?: (runState: RunState) => void
  /** Optional file write hook. Called after a file is successfully written
   *  (created or modified). Useful for tracking file changes, syncing to
   *  databases, or triggering side effects. */
  onFileWritten?: OnFileWrittenCallback
  /** Explicit governance contract selected at boot. */
  protocolVariant?: ProtocolVariant
  /** Dev override flag — bypasses all FSM tool gating and agent tool restrictions. */
  devMode?: boolean
  /** Active visual design contract for prompt grounding and write enforcement. */
  designContract?: DesignContract
  /** Optional sandbox permission mode. */
  permissionMode?:
    | 'safe'
    | 'prompt'
    | 'unsafe' /** Optional pre-formatted model metadata block injected into the agent
   *   system prompt via the {SAVANT_CODE_MODEL_INFO} placeholder. */
  modelInfoText?: string
  /** FID-2026-0803-004: directory for persistent per-turn file checkpoints
   *   (rewind). When set, the runtime captures pre-write snapshots of every
   *   write_file/str_replace/apply_patch in each turn. Hosts own the turn
   *   lifecycle via the checkpoint store (openTurn before run, closeTurn
   *   after) and pass the same directory here. */
  checkpointDir?: string
  /** FID-2026-0803-004: turn identity used to group this run's checkpoint
   *   captures. Defaults to the run's clientSessionId; hosts (e.g. the CLI)
   *   pass their own id so they can open/close the matching turn. */
  checkpointTurnId?: string
  /** FID-2026-0804-009: harness ECHO compliance. Defaults to `warn` — the
   *   runtime deterministically enforces Law 1 (read-before-write), Law 3
   *   (verify-before-proceed), and the mechanical Verifier-criteria flag,
   *   emitting non-blocking `compliance_warning` events + corrective steering.
   *   Set mode `off` to disable. `fidPaths` (absolute paths of active FIDs in
   *   `dev/fids/`) enables FID-aware escalation: writes touching active FIDs
   *   always flag for independent review. */
  echoCompliance?: {
    mode?: 'warn' | 'off'
    fidPaths?: string[]
  }
  /** FID-2026-0813-004: ZTAP provenance mode — `off | record | enforce`.
   *   Defaults to `record`. `enforce` fails closed: a write that cannot be
   *   signed is blocked. `off` disables receipts entirely. */
  provenanceMode?: 'off' | 'record' | 'enforce'
  /** FID-2026-0725-085 CTX-007: resolved context window (tokens) for the
   *   model in use. Threaded to the runtime so the ContextCompactor thresholds,
   *   the display percent, and the pruner trigger all reference the same
   *   window. Absent → the runtime falls back with a loud warning, never a
   *   silent 200k default. */
  contextWindow?: number
  /** FID-2026-0814-004 H-05/H-06/H-07: compression config threaded from
   *   `protocol.config.yaml` `compression` — `microCompact` (on/off),
   *   `keepRecentTokens` (pruner fold floor), `autoCompactRatio` /
   *   `forceCompactOffset` (pruner trigger). Absent → runtime defaults. */
  compression?: {
    microCompact?: boolean
    keepRecentTokens?: number
    autoCompactRatio?: number
    forceCompactOffset?: number
    microCompactMaxKeepRecent?: number
    microCompactFloorTokens?: number
    /** FID-2026-0824-024 post-closure amendment: result-digest caps for the
     *  context-pruner preservation contract. Absent → pruner defaults. */
    digestHeadChars?: number
    digestTailChars?: number
  }
}

/** How often onStateSnapshot fires while a run is in flight. */
export const STATE_SNAPSHOT_INTERVAL_MS = 5_000

export const STATE_SNAPSHOT_INTERRUPTION_MESSAGE =
  'The session ended before this response completed. Partial progress has been preserved.'

/**
 * Copy a SessionState for a checkpoint / cancellation snapshot: the caller
 * appends an interruption message and must not disturb the live session.
 *
 * lodash cloneDeep of the whole session is expensive — ~230ms on an ~8 MB
 * session — and this runs on the CLI's render/input thread every ~5s at each
 * in-flight snapshot, a major source of long-session freezes.
 *
 * Only mainAgentState needs an independent copy: the mutations that would
 * otherwise bleed into an already-captured snapshot all live there —
 * messageHistory (.push), agentContext subgoals (update_subgoal). We copy it
 * with a JSON round-trip, which is ~50x faster than cloneDeep (~4ms). The
 * snapshot is only ever consumed as JSON — persisted to disk, and re-serialized
 * when fed back as previousRunState — so a JSON round-trip is byte-for-byte
 * parity with the prior cloneDeep→JSON.stringify path. It also can't choke on
 * the URL / Buffer / Uint8Array instances the message schema permits in
 * image/file content (structuredClone throws on URL and rewrites
 * Buffer→Uint8Array; both change the persisted bytes or fall back).
 *
 * fileContext is large, effectively read-only during a run, and already
 * persisted as-is, so we share it by reference rather than copy it.
 *
 * Falls back to cloneDeep only if JSON.stringify throws (circular refs /
 * BigInt — which AgentState isn't expected to contain, as it uses IDs rather
 * than object back-refs) so a snapshot — or the final error state, which shares
 * this path — can never fail to build.
 */
export function cloneSessionState(
  state: SessionState,
  logger?: Logger,
): SessionState {
  let mainAgentState: SessionState['mainAgentState']
  try {
    mainAgentState = JSON.parse(JSON.stringify(state.mainAgentState))
  } catch (error) {
    logger?.debug?.(
      { error: error instanceof Error ? error.message : String(error) },
      'JSON clone of mainAgentState failed; falling back to cloneDeep',
    )
    mainAgentState = cloneDeep(state.mainAgentState)
  }
  return { fileContext: state.fileContext, mainAgentState }
}

export const createAbortError = (signal?: AbortSignal) => {
  if (signal?.reason instanceof Error) {
    return signal.reason
  }
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

export type RunExecutionOptions = RunOptions &
  SavantCodeClientOptions & {
    apiKey: string
    fingerprintId: string
  }
export type RunReturnType = RunState
