import { retainedToolCallIds } from './omission'
import { loadEvidenceRecords } from './spill'

import type { EvidenceSpillRecord } from './spill'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-027 — raw-evidence transport for a spawn, at ANY depth and from
 * EITHER spawn site.
 *
 * FID-2026-0824-026 spills every raw tool result to a per-RUN JSONL file
 * (`.savant/evidence/<runId>.jsonl`) so an audit agent can splice the
 * pre-compaction originals back over compaction sentinels. That restore only
 * happens if the spawn boundary hands the records to `createAgentState`, and
 * two gaps meant it often did not:
 *
 * 1. The batch path required `!parentAgentState.parentId` (a ROOT spawn), so a
 *    nested spawn — a child spawning its own Verifier/Adversary, reachable up to
 *    `MAX_SUBAGENT_DEPTH` (8) — restored nothing.
 * 2. The inline path never loaded records at all, so an inline audit spawn
 *    audited sentinels.
 *
 * Depth is irrelevant to where the records live: the spill is keyed by the run
 * that produced the tool result, and `ancestorRunIds` names exactly the runs
 * whose tool results can appear in the inherited history (the child's history
 * starts as a copy of its immediate parent's, which itself began as a copy of
 * its ancestors'). So the correct source is the UNION of the run chain, with
 * the spawning agent's own run winning on a duplicate `toolCallId`.
 *
 * FID-2026-1007-004 step 5 — the gate was scoped by ROLE, not by need. It is now
 * `requiresRawEvidence === true` OR the spawning history naming a payload whose
 * bytes are gone: an audit role keeps the full union of the run chain (the bulk
 * splice, unchanged), while any other agent gets exactly the records its own
 * inherited history says it is missing. An agent that owns a truncated tool
 * result can recover it; an agent that does not own one still does no IO.
 *
 * Returns `undefined` when nothing applies — a non-audit agent with nothing
 * omitted in its history (no spill read at all, so no IO on the hot spawn path),
 * no project root, or an empty union — keeping the "absent spill ⇒ never worse
 * than today" contract of the loader.
 */
export async function loadRawEvidenceForSpawn(params: {
  agentTemplate: AgentTemplate
  spawningAgentState: AgentState
  projectRoot: string | undefined
}): Promise<EvidenceSpillRecord[] | undefined> {
  const requiresAll = params.agentTemplate.requiresRawEvidence === true
  const ownedToolCallIds = new Set(
    params.agentTemplate.includeMessageHistory
      ? retainedToolCallIds(params.spawningAgentState.messageHistory)
      : [],
  )
  if (!requiresAll && ownedToolCallIds.size === 0) return undefined

  const projectRoot = params.projectRoot ?? ''
  if (!projectRoot) return undefined

  const runIds = [
    ...params.spawningAgentState.ancestorRunIds,
    ...(params.spawningAgentState.runId
      ? [params.spawningAgentState.runId]
      : []),
  ]

  const byToolCallId = new Map<string, EvidenceSpillRecord>()
  for (const runId of runIds) {
    for (const record of await loadEvidenceRecords(projectRoot, runId)) {
      byToolCallId.set(record.toolCallId, record)
    }
  }

  const records = [...byToolCallId.values()]
  const scoped = requiresAll
    ? records
    : records.filter((record) => ownedToolCallIds.has(record.toolCallId))
  return scoped.length > 0 ? scoped : undefined
}
