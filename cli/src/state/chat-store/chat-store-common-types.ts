/**
 * FID-2026-0814-006: one terminal compaction lifecycle event for the bounded
 * in-stream transcript signal (kimi pattern). `pruned` = successful full
 * pruner run; `ineffective` = a pruner run that removed nothing (the runtime
 * writes phase `warning` at that boundary). Display-only; never a control
 * channel.
 */
export type CompactionLifecycleEvent = {
  outcome: 'pruned' | 'ineffective'
  tokensSaved?: number
  percentUsed?: number
  at: number
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
