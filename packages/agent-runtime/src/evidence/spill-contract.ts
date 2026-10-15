import path from 'node:path'

/**
 * The evidence store's SHARED CONTRACT (FID-2026-1007-004).
 *
 * Ceiling split, not a new store: the record shape, the caps, the shard paths and
 * the retention vocabulary are what the write side (`./spill`) and the read side
 * (`./spill-read`) both need, and keeping them in one leaf module is what lets
 * the read side exist without an import edge back into the writer. `./spill`
 * re-exports all of it, so no caller moved.
 */

export type EvidenceSpillRecord = {
  ts: number
  runId: string
  agentId: string
  toolCallId: string
  toolName: string
  byteSize: number
  sha256: string
  raw: string
  /** True when `raw` is the redacted form of what the tool produced. */
  redacted?: boolean
}

export const EVIDENCE_MAX_RECORD_BYTES = 512 * 1024
export const EVIDENCE_MAX_FILE_BYTES = 8 * 1024 * 1024
/** Shard ceiling: 64 × 8 MiB per run before the store reports `store-full`. */
export const EVIDENCE_MAX_SHARDS = 64

/** Shard 1 keeps the canonical name (`<runId>.jsonl`). */
export function evidenceFilePath(projectRoot: string, runId: string): string {
  return path.join(projectRoot, '.savant', 'evidence', `${runId}.jsonl`)
}

/** Shards 2..MAX are `<runId>.part-N.jsonl`; shard 1 is the canonical path. */
export function evidenceShardPath(
  projectRoot: string,
  runId: string,
  shard: number,
): string {
  if (shard <= 1) return evidenceFilePath(projectRoot, runId)
  return path.join(
    projectRoot,
    '.savant',
    'evidence',
    `${runId}.part-${shard}.jsonl`,
  )
}

export function shardNumbers(maxShards: number): number[] {
  return Array.from({ length: maxShards }, (_, index) => index + 1)
}

/**
 * Why a retention attempt failed. A refusal is data, not a swallowed error
 * (FID-2026-1007-004): the transform that wanted to drop the payload reads this
 * and keeps the payload instead of discarding bytes nobody stored.
 */
export type RetentionRefusal =
  | 'no-project-root'
  | 'no-tool-call-id'
  | 'record-too-large'
  | 'store-full'
  | 'io-error'

/**
 * A PROVEN retention — the identity a reader needs to get the bytes back. Emitted
 * only after the append resolved, so a marker carrying one is never a promise
 * about a write that did not happen. `sha256`/`bytes` describe the STORED
 * (redacted) form.
 */
export type RetentionHandle = {
  file: string
  toolCallId: string
  sha256: string
  bytes: number
  redacted: boolean
}

export type RetentionResult =
  | { retained: true; handle: RetentionHandle }
  | { retained: false; reason: RetentionRefusal }

export type RetentionParams = {
  projectRoot: string
  runId: string
  agentId: string
  toolCallId: string
  toolName: string
  raw: string
  /** Ceiling overrides — see the contract in `./spill`; production omits them. */
  maxRecordBytes?: number
  maxShardBytes?: number
  maxShards?: number
}
