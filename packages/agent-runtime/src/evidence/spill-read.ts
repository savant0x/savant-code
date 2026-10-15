import { readFile, stat } from 'node:fs/promises'

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
import { sha256Hex } from '@savant-code/common/util/hash'

import {
  EVIDENCE_MAX_SHARDS,
  evidenceShardPath,
  shardNumbers,
} from './spill-contract'

import type { EvidenceSpillRecord, RetentionHandle } from './spill-contract'

/**
 * Bounded per-shard cache keyed by `(shardPath -> { mtimeMs, size, records })`
 * (FID-2026-1013-010 W1-3). Parallel or sequential subagent spawns otherwise
 * re-read and JSON-parse the same `.savant/evidence/<runId>.jsonl` shards on
 * every child spawn. Keying on both `mtimeMs` and `size` guarantees that any
 * append within the same filesystem tick invalidates the cached slice.
 */
const MAX_CACHED_SHARDS = 64

type CachedShardEntry = {
  mtimeMs: number
  size: number
  records: EvidenceSpillRecord[]
}

const shardRecordCache = new Map<string, CachedShardEntry>()

export function resetEvidenceRecordCache(): void {
  shardRecordCache.clear()
}

/**
 * The evidence store's READ side (FID-2026-1007-004, ceiling split).
 *
 * Split from `./spill` so the writer's policy (redaction, rotation, the verdict
 * vocabulary) and the reader's resolution are separate modules with separate
 * tests. `./spill` re-exports every name here, so no caller moved.
 */

/** Parse a spill file; malformed lines are skipped (crash-safe reads). */
export function parseEvidenceFile(text: string): EvidenceSpillRecord[] {
  const records: EvidenceSpillRecord[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as EvidenceSpillRecord
      if (
        typeof parsed.toolCallId === 'string' &&
        typeof parsed.raw === 'string'
      ) {
        records.push(parsed)
      }
    } catch {
      // Partial/corrupt line — skip.
    }
  }
  return records
}

/**
 * Load a run's records across every shard, in write order. Absent/unreadable
 * spill ⇒ empty array (off-switch parity: never worse than today). Shards are
 * written contiguously from 1, so the first absent shard ends the run's store —
 * a normal run pays one read.
 */
export async function loadEvidenceRecords(
  projectRoot: string,
  runId: string,
): Promise<EvidenceSpillRecord[]> {
  if (!projectRoot || !runId) return []
  const records: EvidenceSpillRecord[] = []
  for (const shard of shardNumbers(EVIDENCE_MAX_SHARDS)) {
    const shardPath = evidenceShardPath(projectRoot, runId, shard)
    let mtimeMs: number
    let size: number
    try {
      const stats = await stat(shardPath)
      mtimeMs = stats.mtimeMs
      size = stats.size
    } catch {
      shardRecordCache.delete(shardPath)
      break
    }

    const cached = shardRecordCache.get(shardPath)
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      records.push(...cached.records)
      continue
    }

    let text: string
    try {
      text = await readFile(shardPath, 'utf8')
    } catch {
      shardRecordCache.delete(shardPath)
      break
    }

    const parsed = parseEvidenceFile(text)
    if (
      shardRecordCache.size >= MAX_CACHED_SHARDS &&
      !shardRecordCache.has(shardPath)
    ) {
      const oldestKey = shardRecordCache.keys().next().value
      if (oldestKey !== undefined) {
        shardRecordCache.delete(oldestKey)
      }
    }
    shardRecordCache.set(shardPath, { mtimeMs, size, records: parsed })
    records.push(...parsed)
  }
  return records
}

/** Why a handle could not be turned back into bytes. */
export type ResolvedPayload =
  | {
      found: true
      raw: string
      sha256Verified: true
      record: EvidenceSpillRecord
    }
  | { found: false; why: 'io-error' | 'not-in-store' | 'sha256-mismatch' }

/**
 * Resolve a handle back to its bytes (FID-2026-1007-004 step 5).
 *
 * The read path used to be gated by role — `requiresRawEvidence`, which only
 * Verifier and Adversary set — so the agent that actually owns a payload could
 * not reach it. This is keyed by the node a marker carries, so it resolves for
 * whoever holds the handle. Verification is fail-closed: bytes that no longer
 * match the handle's `sha256` are not returned at all, because a locator that
 * resolves to the wrong bytes is worse than one that resolves to none.
 */
export async function resolveRetainedPayload(
  handle: RetentionHandle,
): Promise<ResolvedPayload> {
  let text: string
  try {
    text = await readFile(handle.file, 'utf8')
  } catch {
    return { found: false, why: 'io-error' }
  }
  const record = parseEvidenceFile(text).find(
    (candidate) => candidate.toolCallId === handle.toolCallId,
  )
  if (!record) return { found: false, why: 'not-in-store' }
  if (sha256Hex(record.raw) !== handle.sha256) {
    return { found: false, why: 'sha256-mismatch' }
  }
  return { found: true, raw: record.raw, sha256Verified: true, record }
}
