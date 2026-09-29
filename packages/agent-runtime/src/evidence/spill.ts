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
 * Append one record. Best-effort: resolves false on any failure instead of
 * throwing, so the hot tool-result path is never blocked by evidence IO.
 */
export async function recordEvidence(params: {
  projectRoot: string
  runId: string
  agentId: string
  toolCallId: string
  toolName: string
  raw: string
}): Promise<boolean> {
  try {
    if (!params.projectRoot) return false
    if (params.raw.length > EVIDENCE_MAX_RECORD_BYTES) return false
    const file = evidenceFilePath(params.projectRoot, params.runId)
    try {
      const st = await stat(file)
      if (st.size > EVIDENCE_MAX_FILE_BYTES) return false
    } catch {
      // File does not exist yet — first record.
    }
    const record: EvidenceSpillRecord = {
      ts: Date.now(),
      runId: params.runId,
      agentId: params.agentId,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      byteSize: params.raw.length,
      sha256: sha256Hex(params.raw),
      raw: params.raw,
    }
    await mkdir(path.dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
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
