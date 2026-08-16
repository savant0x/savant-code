/**
 * ZTAP batch validation + export-time classification — FID-2026-0813-001
 * (master rules (5) seq monotonicity, (6) session bounds, D6 live/superseded).
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { hashChange } from '../crypto'

import type { SessionManifest, TrustReceipt } from '../types/provenance'

export type ReceiptClassification = 'live' | 'superseded'

/**
 * Batch validation — master rules (5) seq monotonicity + (6) session bounds.
 * Receipts must be sorted by seq (as loaded).
 */
export function validateReceiptBatch(
  receipts: TrustReceipt[],
  manifest: SessionManifest,
): string[] {
  const failures: string[] = []
  let lastSeq = 0
  const seen = new Set<number>()
  for (const receipt of receipts) {
    if (seen.has(receipt.seq)) {
      failures.push(`duplicate seq ${receipt.seq}`)
    }
    if (receipt.seq <= lastSeq) {
      failures.push(
        `seq ${receipt.seq} not strictly increasing (after ${lastSeq})`,
      )
    }
    seen.add(receipt.seq)
    lastSeq = receipt.seq
    if (receipt.timestamp < manifest.createdAt) {
      failures.push(`receipt ${receipt.seq}: timestamp before session start`)
    }
    if (manifest.closedAt && receipt.timestamp > manifest.closedAt) {
      failures.push(`receipt ${receipt.seq}: timestamp after session close`)
    }
  }
  return failures
}

/**
 * Export-time live/superseded classification (master D6): recompute the
 * content hash of each receipt's target path on disk; a mismatch (rewind,
 * manual edit, later change) marks the receipt superseded. The ledger is never
 * mutated. Paths outside the project root fall back to the stored path.
 */
export function classifyReceipts(
  receipts: TrustReceipt[],
  projectRoot: string,
): Map<number, ReceiptClassification> {
  const result = new Map<number, ReceiptClassification>()
  for (const receipt of receipts) {
    const absolute = path.isAbsolute(receipt.path)
      ? receipt.path
      : path.join(projectRoot, receipt.path)
    let classification: ReceiptClassification = 'superseded'
    try {
      if (existsSync(absolute)) {
        const current = readFileSync(absolute, 'utf8')
        if (hashChange(current) === receipt.changeHash) {
          classification = 'live'
        }
      }
    } catch {
      classification = 'superseded'
    }
    result.set(receipt.seq, classification)
  }
  return result
}
