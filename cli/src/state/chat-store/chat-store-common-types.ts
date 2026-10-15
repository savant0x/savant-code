/**
 * FID-2026-0814-006: one terminal compaction lifecycle event for the bounded
 * in-stream transcript signal (kimi pattern). `pruned` = successful full
 * pruner run; `ineffective` = a pruner run that removed nothing (the runtime
 * writes phase `warning` at that boundary); `compacted` = a Layer-2
 * micro-compact pass cleared stale tool results (FID-2026-0824-023 — data
 * destruction is never silent). Display-only; never a control channel.
 */
export type CompactionLifecycleEvent = {
  outcome: 'pruned' | 'ineffective' | 'compacted'
  tokensSaved?: number
  percentUsed?: number
  at: number
}

/**
 * FID-2026-0824-023 stream-routing: WHAT was compacted — bounded summary
 * excerpt + removed-region counts, mirrored from the runtime's
 * `AgentState.lastCompactionReport` for the transcript signal.
 */
export type LastCompactionReport = {
  summaryExcerpt: string
  removedMessages: number
  tokensSaved?: number
  percentUsed?: number
}

export type ToolHistoryEntry = {
  name: string
  timestamp: number
}

export type FilesChanged = {
  modified: number
  created: number
  added: number
  deleted: number
}

export type AgentStackEntry = {
  id: string
  displayName?: string
  isActive: boolean
}
