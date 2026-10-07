import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
import { sha256Hex } from '@savant-code/common/util/hash'
// Canonical body lives in `@savant-code/common/util/redact`
// (FID-2026-1007-004 step 6); this module keeps the call-site name.
import { redactSecrets } from '@savant-code/common/util/redact'

/**
 * Evidence spill (FID-2026-0824-026): append-only JSONL capture of raw tool
 * results at the tool-result boundary, BEFORE any compaction layer can clear
 * them. `requiresRawEvidence` agents splice records back at spawn time.
 *
 * Fail-open by contract: a spill failure must never affect tool execution.
 *
 * FID-2026-1007-004 gives that contract the half it was missing. The store now:
 *
 * - **Returns a verdict** (`retainOriginal`): a handle that proves an append
 *   resolved, or a named refusal. A refusal is data, not a swallowed error — the
 *   transform that wanted to drop the payload reads it and keeps the payload
 *   instead (step 1).
 * - **Redacts before writing** (step 6, Law 12). Raw tool output is the widest
 *   surface a run has, so the STORED form is `redactSecrets(raw)` and the record
 *   and handle carry `redacted: true` when that changed anything. `sha256` and
 *   `byteSize` describe the stored form, so a handle always verifies against what
 *   is on disk. Consequence, stated rather than implied: a payload whose secret
 *   was redacted is not recoverable in its original form BY DESIGN — re-run the
 *   tool for that.
 * - **Rotates instead of refusing** (step 7). A shard at
 *   `EVIDENCE_MAX_FILE_BYTES` is closed and the next record opens
 *   `<runId>.part-N.jsonl`; the first shard keeps the canonical file name, so
 *   every existing reader keeps working. `store-full` now means all
 *   `EVIDENCE_MAX_SHARDS` shards are sealed — a stated ceiling instead of the
 *   ordinary outcome of a long run.
 * - **Resolves for whoever owns the payload** (step 5): `resolveRetainedPayload`
 *   is keyed by the handle, never by an agent role.
 * - **States its ceilings in one place**: the `maxRecordBytes`, `maxShardBytes`
 *   and `maxShards` overrides exist so the limits are testable at a size a test
 *   can produce, and so an operator can raise them without editing this module.
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

function shardNumbers(maxShards: number): number[] {
  return Array.from({ length: maxShards }, (_, index) => index + 1)
}

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
export { sha256Hex } from '@savant-code/common/util/hash'

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
    let text: string
    try {
      text = await readFile(
        evidenceShardPath(projectRoot, runId, shard),
        'utf8',
      )
    } catch {
      break
    }
    records.push(...parseEvidenceFile(text))
  }
  return records
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
  /** Ceiling overrides — see the module contract; production omits them. */
  maxRecordBytes?: number
  maxShardBytes?: number
  maxShards?: number
}

/** First shard that is missing or still under its cap; `null` when sealed. */
async function pickShard(params: {
  projectRoot: string
  runId: string
  maxShardBytes: number
  maxShards: number
}): Promise<string | null> {
  for (const shard of shardNumbers(params.maxShards)) {
    const file = evidenceShardPath(params.projectRoot, params.runId, shard)
    try {
      const stats = await stat(file)
      if (stats.size <= params.maxShardBytes) return file
    } catch {
      // Absent — shards are written in order, so this is the open one.
      return file
    }
  }
  return null
}

/**
 * Store a payload and RETURN the verdict (FID-2026-1007-004 steps 1, 6, 7).
 *
 * This is the seam the record's contract turns on: a transform may discard
 * model-facing bytes only on the strength of a handle it received from here, and
 * a refusal means the bytes stay in context. It reuses the existing store —
 * `evidenceFilePath`, `sha256Hex`, the append-only JSONL format — rather than
 * introducing a second spill mechanism, which FID-2026-1006-005 step 3 forbids.
 *
 * Never throws: every failure mode returns a named refusal.
 */
export async function retainOriginal(
  params: RetentionParams,
): Promise<RetentionResult> {
  if (!params.projectRoot) return { retained: false, reason: 'no-project-root' }
  if (!params.toolCallId) return { retained: false, reason: 'no-tool-call-id' }

  const maxRecordBytes = params.maxRecordBytes ?? EVIDENCE_MAX_RECORD_BYTES
  const maxShardBytes = params.maxShardBytes ?? EVIDENCE_MAX_FILE_BYTES
  const maxShards = params.maxShards ?? EVIDENCE_MAX_SHARDS

  // Law 12: the stored form is the redacted form, and the handle describes it.
  const stored = redactSecrets(params.raw)
  const redacted = stored !== params.raw
  if (stored.length > maxRecordBytes) {
    return { retained: false, reason: 'record-too-large' }
  }

  try {
    const file = await pickShard({
      projectRoot: params.projectRoot,
      runId: params.runId,
      maxShardBytes,
      maxShards,
    })
    if (file === null) return { retained: false, reason: 'store-full' }

    const sha256 = sha256Hex(stored)
    const record: EvidenceSpillRecord = {
      ts: Date.now(),
      runId: params.runId,
      agentId: params.agentId,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      byteSize: stored.length,
      sha256,
      raw: stored,
      ...(redacted ? { redacted: true } : {}),
    }
    await mkdir(path.dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
    return {
      retained: true,
      handle: {
        file,
        toolCallId: params.toolCallId,
        sha256,
        bytes: stored.length,
        redacted,
      },
    }
  } catch {
    return { retained: false, reason: 'io-error' }
  }
}

/**
 * The boolean view of `retainOriginal`, kept for callers that only need a
 * verdict. Best-effort by contract: never throws, so the hot tool-result path is
 * never blocked by evidence IO. One truth, two shapes (Law 13).
 */
export async function recordEvidence(
  params: RetentionParams,
): Promise<boolean> {
  const result = await retainOriginal(params)
  return result.retained
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
