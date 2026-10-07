import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
import { sha256Hex } from '@savant-code/common/util/hash'

/**
 * Evidence spill (FID-2026-0824-026): append-only JSONL capture of raw tool
 * results at the tool-result boundary, BEFORE any compaction layer can clear
 * them. `requiresRawEvidence` agents splice records back at spawn time.
 *
 * Fail-open by contract: a spill failure must never affect tool execution.
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
}

export const EVIDENCE_MAX_RECORD_BYTES = 512 * 1024
export const EVIDENCE_MAX_FILE_BYTES = 8 * 1024 * 1024

export function evidenceFilePath(projectRoot: string, runId: string): string {
  return path.join(projectRoot, '.savant', 'evidence', `${runId}.jsonl`)
}

// Canonical body lives in `@savant-code/common/util/hash`
// (FID-2026-0928-009 Part 4); this module keeps the call-site name.
export { sha256Hex } from '@savant-code/common/util/hash'

/**
 * Load a run's records. Absent/unreadable spill ⇒ empty array (off-switch
 * parity: never worse than today).
 */
export async function loadEvidenceRecords(
  projectRoot: string,
  runId: string,
): Promise<EvidenceSpillRecord[]> {
  if (!projectRoot || !runId) return []
  try {
    const text = await readFile(evidenceFilePath(projectRoot, runId), 'utf8')
    return parseEvidenceFile(text)
  } catch {
    // Absent/unreadable — empty array.
    return []
  }
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
 * about a write that did not happen.
 */
export type RetentionHandle = {
  file: string
  toolCallId: string
  sha256: string
  bytes: number
}

export type RetentionResult =
  | { retained: true; handle: RetentionHandle }
  | { retained: false; reason: RetentionRefusal }

type RetentionParams = {
  projectRoot: string
  runId: string
  agentId: string
  toolCallId: string
  toolName: string
  raw: string
}

/**
 * Store a payload and RETURN the verdict (FID-2026-1007-004 step 1).
 *
 * This is the seam the record's contract turns on: a transform may discard
 * model-facing bytes only on the strength of a handle it received from here, and
 * a refusal means the bytes stay in context. It reuses the existing store —
 * `evidenceFilePath`, `sha256Hex`, the append-only JSONL format and both caps —
 * rather than introducing a second spill mechanism, which FID-2026-1006-005 step
 * 3 forbids.
 *
 * Never throws: every failure mode returns a named refusal.
 */
export async function retainOriginal(
  params: RetentionParams,
): Promise<RetentionResult> {
  if (!params.projectRoot) return { retained: false, reason: 'no-project-root' }
  if (!params.toolCallId) return { retained: false, reason: 'no-tool-call-id' }
  if (params.raw.length > EVIDENCE_MAX_RECORD_BYTES) {
    return { retained: false, reason: 'record-too-large' }
  }
  const file = evidenceFilePath(params.projectRoot, params.runId)
  try {
    try {
      const st = await stat(file)
      if (st.size > EVIDENCE_MAX_FILE_BYTES) {
        return { retained: false, reason: 'store-full' }
      }
    } catch {
      // File does not exist yet — first record.
    }
    const sha256 = sha256Hex(params.raw)
    const record: EvidenceSpillRecord = {
      ts: Date.now(),
      runId: params.runId,
      agentId: params.agentId,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      byteSize: params.raw.length,
      sha256,
      raw: params.raw,
    }
    await mkdir(path.dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
    return {
      retained: true,
      handle: {
        file,
        toolCallId: params.toolCallId,
        sha256,
        bytes: params.raw.length,
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
