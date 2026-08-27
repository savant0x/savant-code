import path from 'path'

import { MAX_AGENT_STEPS_DEFAULT } from '@savant-code/common/constants/agents'

import { loadFidInventory } from './fid-loader'
import {
  createEventHandler,
  createStreamChunkHandler,
} from './sdk-event-handlers'

import type { EventHandlerState } from './sdk-event-handlers'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type {
  AgentDefinition,
  FileFilter,
  MessageContent,
  OnFileWrittenCallback,
  RunState,
} from '@savant-code/sdk'

export type CreateRunConfigParams = {
  logger: Logger
  agent: AgentDefinition | string
  prompt: string
  content: MessageContent[] | undefined
  previousRunState: RunState | null
  agentDefinitions: AgentDefinition[]
  eventHandlerState: EventHandlerState
  signal: AbortSignal
  extraSavantCodeMetadata?: Record<string, string>
  /** Periodic in-flight RunState checkpoints (see RunOptions.onStateSnapshot). */
  onStateSnapshot?: (runState: RunState) => void
  /** Optional file write hook. Called after a file is successfully written. */
  onFileWritten?: OnFileWrittenCallback
  /** Explicit governance contract selected at CLI boot. */
  protocolVariant?: 'harness' | 'single-agent'
  /** Dev override flag — bypasses all FSM tool gating and agent tool restrictions. */
  devMode?: boolean
  /** Optional sandbox permission mode. */
  permissionMode?: 'safe' | 'prompt' | 'unsafe'
  /** Active visual design contract for grounding and write enforcement. */
  designContract?: DesignContract
  /** Optional pre-formatted model metadata block injected into the agent
   *  system prompt via the {SAVANT_CODE_MODEL_INFO} placeholder. */
  modelInfoText?: string
  /** FID-2026-0725-085 CTX-007: Resolved context window from OpenRouter catalog.
   *  Passed to agent runtime for accurate compaction thresholds. */
  contextWindow?: number
  /** FID-2026-0814-004 H-05/H-06/H-07: compression config from
   *  `protocol.config.yaml` — `microCompact`, `keepRecentTokens`,
   *  `autoCompactRatio`, `forceCompactOffset`, and the micro-compact
   *  keep-recent count. Threaded to the runtime so the config is honored. */
  compression?: {
    microCompact?: boolean
    keepRecentTokens?: number
    autoCompactRatio?: number
    forceCompactOffset?: number
    microCompactMaxKeepRecent?: number
    microCompactFloorTokens?: number
    /** FID-2026-0824-024 post-closure amendment: digest caps threaded to the
     *  context-pruner via AgentState.digestCaps. */
    digestHeadChars?: number
    digestTailChars?: number
  }
  /** FID-2026-0803-004: persistent per-turn file checkpoints (rewind). The
   *  CLI opens/closes the turn on the checkpoint store; the runtime captures
   *  pre-write snapshots into this directory. */
  checkpointDir?: string
  /** FID-2026-0803-004: turn identity for checkpoint grouping (the CLI's
   *  aiMessageId), so subagent writes land in the same turn's checkpoint. */
  checkpointTurnId?: string
  /** FID-2026-0804-009: harness ECHO compliance override. Defaults to `warn`;
   *  the CLI always passes active FID paths so FID-aware escalation is live. */
  echoCompliance?: { mode?: 'warn' | 'off'; fidPaths?: string[] }
  /** EHEL enforcement mode — drives which ECHO laws are blocking vs advisory.
   *  hybrid: Laws 1-4 blocking, 5-15 advisory. strict: all 15 blocking. */
  enforcementMode?: 'hybrid' | 'strict'
  /** FID-2026-0813-004: ZTAP provenance mode. Defaults to `record`; wired from
   *  `protocol.config.yaml` `provenance.mode` by the CLI. */
  provenanceMode?: 'off' | 'record' | 'enforce'
}

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
  '.crt',
  '.cer',
])
const SENSITIVE_BASENAMES = new Set([
  '.htpasswd',
  '.netrc',
  'credentials',
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',
  'auth.json',
  '.pypirc',
  'terraform.tfvars',
  '.terraformrc',
])

// Pattern matches (grouped by match type)
const SENSITIVE_PATTERNS = {
  prefix: ['id_rsa', 'id_ed25519', 'id_dsa', 'id_ecdsa'], // SSH private keys
  suffix: ['_credentials'],
  substring: ['kubeconfig', '.tfstate'],
}

const isEnvFile = (basename: string) =>
  (basename === '.env' || basename.startsWith('.env.')) &&
  !isEnvTemplateFile(basename)

const matchesPattern = (str: string) =>
  SENSITIVE_PATTERNS.prefix.some(
    (p) => str.startsWith(p) && !str.endsWith('.pub'),
  ) ||
  SENSITIVE_PATTERNS.suffix.some((s) => str.endsWith(s)) ||
  SENSITIVE_PATTERNS.substring.some((sub) => str.includes(sub))

const ENV_TEMPLATE_SUFFIXES = ['.env.example', '.env.sample', '.env.template']

// FID-2026-0804-009 (code-review finding): `loadFidInventory()` does synchronous
// readdir + per-FID readFile, and `createRunConfig` runs on every message send.
// Cache the active-FID path list with a short TTL — FIDs change rarely
// mid-session, and the sidebar / fid-watcher own live freshness separately.
const FID_PATHS_CACHE_TTL_MS = 30_000
let fidPathsCache: { at: number; paths: string[] } | undefined

function getActiveFidPaths(): string[] {
  const now = Date.now()
  if (fidPathsCache && now - fidPathsCache.at < FID_PATHS_CACHE_TTL_MS) {
    return fidPathsCache.paths
  }
  const paths = loadFidInventory()
    .active.map((fid) => fid.path)
    .filter((p): p is string => typeof p === 'string')
  fidPathsCache = { at: now, paths }
  return paths
}

export const isEnvTemplateFile = (filePath: string) =>
  ENV_TEMPLATE_SUFFIXES.some((suffix) =>
    path.basename(filePath).endsWith(suffix),
  )

/**
 * Check if a file is a sensitive file that should be blocked from reading.
 */
export function isSensitiveFile(filePath: string): boolean {
  const basename = path.basename(filePath)
  const basenameLower = basename.toLowerCase()
  const ext = path.extname(filePath).toLowerCase()

  return (
    isEnvFile(basename) ||
    SENSITIVE_EXTENSIONS.has(ext) ||
    SENSITIVE_BASENAMES.has(basename) ||
    matchesPattern(basenameLower)
  )
}

export const createRunConfig = (params: CreateRunConfigParams) => {
  const {
    logger,
    agent,
    prompt,
    content,
    previousRunState,
    agentDefinitions,
    eventHandlerState,
    extraSavantCodeMetadata,
    onStateSnapshot,
    onFileWritten,
    devMode,
    permissionMode,
    modelInfoText,
    protocolVariant,
    designContract,
  } = params
  // FID-2026-0804-009: hoisted so the mode const drives both the runtime
  // option and the fidPaths load-skip decision.
  const echoComplianceMode = params.echoCompliance?.mode ?? 'warn'

  return {
    logger,
    agent,
    prompt,
    content,
    previousRun: previousRunState ?? undefined,
    agentDefinitions,
    maxAgentSteps: MAX_AGENT_STEPS_DEFAULT,
    handleStreamChunk: createStreamChunkHandler(eventHandlerState),
    handleEvent: createEventHandler(eventHandlerState),
    signal: params.signal,
    extraSavantCodeMetadata,
    onStateSnapshot,
    onFileWritten,
    devMode,
    permissionMode,
    modelInfoText,
    protocolVariant,
    designContract,
    contextWindow: params.contextWindow,
    checkpointDir: params.checkpointDir,
    checkpointTurnId: params.checkpointTurnId,
    // FID-2026-0804-009: harness ECHO compliance is ON by default in the CLI.
    // Active (non-archived) FID file paths are loaded from `dev/fids/` so the
    // runtime can escalate writes that touch open FIDs. Archived FIDs are
    // intentionally excluded — closed work doesn't need review receipts. When
    // the mode is `off`, the inventory load is skipped entirely (zero sync fs
    // IO on that path; cached otherwise — see getActiveFidPaths above). The
    // cache is process-local TTL state: FIDs created mid-session are picked up
    // within 30s, and the sidebar/fid-watcher own live freshness separately.
    echoCompliance: {
      mode: echoComplianceMode,
      fidPaths: echoComplianceMode === 'off' ? [] : getActiveFidPaths(),
    },
    // EHEL: enforcement mode drives which laws are blocking vs advisory
    enforcementMode: params.enforcementMode ?? 'hybrid',
    // FID-2026-0813-004: ZTAP provenance mode (defaults to `record`)
    provenanceMode: params.provenanceMode ?? 'record',
    // FID-2026-0814-004 H-05/H-06/H-07: compression config (defaults to the
    // runtime's built-ins when absent — see ContextCompactor).
    compression: params.compression,
    fileFilter: ((filePath: string) => {
      if (isSensitiveFile(filePath)) return { status: 'blocked' }
      if (isEnvTemplateFile(filePath)) return { status: 'allow-example' }
      return { status: 'allow' }
    }) satisfies FileFilter,
  }
}
