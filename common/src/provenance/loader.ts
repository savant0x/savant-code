/**
 * ZTAP session manifest + ledger loader — FID-2026-0813-004/007.
 *
 * One loader shared by the runtime ledger, the /attest export, and tests so
 * receipt reconstruction cannot drift. Never mutates the ledger.
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  LedgerEntry,
  SessionManifest,
  TrustReceipt,
  VerdictRecord,
} from '../types/provenance'

/** Read the session manifest from a provenance session directory. */
export function readProvenanceManifest(dir: string): SessionManifest | null {
  try {
    return JSON.parse(
      readFileSync(path.join(dir, 'session.json'), 'utf8'),
    ) as SessionManifest
  } catch {
    return null
  }
}

/**
 * Load + reconstruct full receipts from a session directory: base `receipt`
 * lines merged with their `verdict` lines by (sessionId, seq). Shared by the
 * runtime ledger, the /attest export, and tests — one loader, no drift
 * (FID-2026-0813-004/007). Never mutates the ledger.
 */
export async function loadProvenanceSession(dir: string): Promise<{
  manifest: SessionManifest | null
  receipts: TrustReceipt[]
  entries: LedgerEntry[]
}> {
  const manifest = readProvenanceManifest(dir)
  let lines: string[]
  try {
    lines = (await readFile(path.join(dir, 'receipts.jsonl'), 'utf8'))
      .split('\n')
      .filter((line) => line.trim().length > 0)
  } catch {
    lines = []
  }
  const entries: LedgerEntry[] = []
  const verdictsBySeq = new Map<number, VerdictRecord[]>()
  const receipts = new Map<number, TrustReceipt>()
  let finalSeq = 0
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LedgerEntry
      entries.push(entry)
      if (entry.type === 'receipt') {
        receipts.set(entry.receipt.seq, entry.receipt)
        if (entry.receipt.seq > finalSeq) finalSeq = entry.receipt.seq
      } else if (entry.type === 'verdict') {
        const list = verdictsBySeq.get(entry.seq) ?? []
        list.push({
          phase: entry.phase,
          agentType: entry.agentType,
          agentId: entry.agentId,
          verdictText: entry.verdictText,
          timestamp: entry.timestamp,
          over: entry.over,
          sig: entry.sig,
        })
        verdictsBySeq.set(entry.seq, list)
      } else if (entry.type === 'session_close') {
        finalSeq = entry.finalSeq
      }
    } catch {
      // A malformed line is a ledger-integrity signal; skip it here and let
      // the validator flag it (the export reports malformed lines).
    }
  }
  for (const [seq, receipt] of receipts) {
    const bound = verdictsBySeq.get(seq) ?? []
    if (bound.length > 0) {
      receipt.verdicts = [...bound]
      receipt.status =
        receipt.verdicts.some((v) => v.phase === 'audit') &&
        receipt.verdicts.some((v) => v.phase === 'adversarial')
          ? 'complete'
          : // FID-2026-0814-005: a system-role close annotation (agentType
            // 'system', agentId 'session-close') means the session closed
            // without an independent verdict — reconstruct the honest
            // terminal rather than falling back to the stale `pending`.
            receipt.verdicts.some(
                (v) =>
                  v.agentType === 'system' && v.agentId === 'session-close',
              )
            ? 'no_verdict'
            : receipt.status
    }
  }
  return {
    manifest,
    receipts: [...receipts.values()].sort((a, b) => a.seq - b.seq),
    entries,
  }
}
