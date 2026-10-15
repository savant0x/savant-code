import { appendFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
import { sha256Hex } from '@savant-code/common/util/hash'
// Canonical body lives in `@savant-code/common/util/redact`
// (FID-2026-1007-004 step 6); this module keeps the call-site name.
import { redactSecrets } from '@savant-code/common/util/redact'

import {
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_RECORD_BYTES,
  EVIDENCE_MAX_SHARDS,
  evidenceShardPath,
  shardNumbers,
} from './spill-contract'

import type {
  EvidenceSpillRecord,
  RetentionParams,
  RetentionResult,
} from './spill-contract'

/**
 * Evidence spill (FID-2026-0824-026): append-only JSONL capture of raw tool
 * results at the tool-result boundary, BEFORE any compaction layer can clear
 * them. `requiresRawEvidence` agents splice records back at spawn time.
 *
 * Fail-open by contract: a spill failure must never affect tool execution.
 *
 * FID-2026-1007-004 gives that contract the half it was missing. The WRITE side
 * (this module) now:
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
 *   tool for that. Redaction removes bytes from the STORE and never from the
 *   model's context, so it cannot re-introduce the loss this record exists to
 *   stop.
 * - **Rotates instead of refusing** (step 7). A shard at
 *   `EVIDENCE_MAX_FILE_BYTES` is closed and the next record opens
 *   `<runId>.part-N.jsonl`; the first shard keeps the canonical file name, so
 *   every existing reader keeps working. `store-full` now means all
 *   `EVIDENCE_MAX_SHARDS` shards are sealed — a stated ceiling instead of the
 *   ordinary outcome of a long run.
 * - **States its ceilings in one place**: the `maxRecordBytes`, `maxShardBytes`
 *   and `maxShards` overrides exist so the limits are testable at a size a test
 *   can produce, and so an operator can raise them without editing this module.
 *
 * The READ side lives in `./spill-read` and the shared shapes in
 * `./spill-contract` (300-line ceiling splits); everything both sides used to
 * export from here is still exported from here.
 */

/**
 * Store a payload and RETURN the verdict (FID-2026-1007-004 steps 1, 6, 7).
 *
 * This is the seam the record's contract turns on: a transform may discard
 * model-facing bytes only on the strength of a handle it received from here, and
 * a refusal means the bytes stay in context. It reuses the existing store — the
 * canonical path, `sha256Hex`, the append-only JSONL format — rather than
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

// The store's public surface, unchanged: shapes and caps from the contract, the
// readers from the read side, and the hash the call sites name.
export * from './spill-contract'
export {
  loadEvidenceRecords,
  parseEvidenceFile,
  resetEvidenceRecordCache,
  resolveRetainedPayload,
} from './spill-read'
export type { ResolvedPayload } from './spill-read'
export { sha256Hex } from '@savant-code/common/util/hash'
