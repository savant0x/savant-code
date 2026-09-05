import type { RosterEntry } from './roster'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// FID-2026-0819-005 Loop 298: transcript state types, moved verbatim from
// transcript-store.ts (the store file re-exports this module's public
// surface, so consumer imports are unchanged).

export type FidQueueStatus =
  'created' | 'analyzed' | 'fixed' | 'verified' | 'converged' | 'closed'

export type AutoDriveHaltState = 'idle' | 'requested' | 'confirmed' | 'failed'

export interface FidQueueEntry {
  fidId: string
  projectId: string
  status: FidQueueStatus
  parentId?: string
}

export type CompactionStatus = Extract<
  PrintModeEvent,
  { type: 'compaction_status' }
>

export type PersistedTranscriptMessage = {
  id: string
  role: string
  content: string
  createdAt: string
}

export type WorkspaceThread = {
  sessionId: string
  chatId: string
  agentId: string
  unread: boolean
  pinned: boolean
  messages: PersistedTranscriptMessage[]
}

export type CurrentActivity =
  | { kind: 'thinking'; startedAt: number; model?: string }
  | { kind: 'tool'; toolName: string; startedAt: number; target?: string }
  | { kind: 'subagent'; agentType: string; startedAt: number; prompt?: string }
  | { kind: 'researching'; query: string; startedAt: number }

export type ChatBlock =
  | { kind: 'text'; id: number; agentId?: string; text: string; ts: number }
  | { kind: 'user'; id: number; text: string; ts: number }
  | { kind: 'reasoning'; id: number; agentId: string; text: string }
  | {
      kind: 'tool'
      id: number
      toolCallId: string
      toolName: string
      inputJson: string | null
      outputText: string | null
      done: boolean
    }
  | { kind: 'error'; id: number; message: string }
  | {
      kind: 'ehel'
      id: number
      law: string
      severity: string
      message: string
    }
  | { kind: 'notice'; id: number; message: string }
  | {
      kind: 'compaction_summary'
      id: number
      summary: string
      removedMessages: number
      tokensSaved?: number
      percentUsed?: number
    }
  | {
      kind: 'approval'
      id: number
      approvalId: string
      requestType: string
      summary: string
    }

export type TranscriptState = {
  blocks: ChatBlock[]
  workspaceThreads: WorkspaceThread[]
  fidQueue: FidQueueEntry[]
  compactionStatus: CompactionStatus | null
  roster: RosterEntry[]
  /** True while an agent run is streaming (start seen, finish pending). */
  running: boolean
  /** After finish, the next text delta always opens a fresh block. */
  turnClosed: boolean
  /** Current Perfection Loop phase — derived ONLY from transition_phase
   * tool_result payloads (the G2 interim rule; never scraped or guessed). */
  fsmPhase: string | null
  /** FID-2026-0901-006 P2: latest runtime `activity` event — the CLI-parity
   * running-status source. Null when the agent is idle. */
  currentActivity: CurrentActivity | null
  /** FID-2026-0901-006 P17: the active model, captured from the runtime
   * `activity.thinking.model` event. Null until the first thinking event. */
  model: string | null
}
