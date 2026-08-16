/**
 * trust-receipt.json serializer — FID-2026-0813-007 (master D11/D12).
 *
 * The AUTHORITATIVE export artifact. Every manifest field is explicitly
 * whitelisted (Loop 2 finding — "reuse the manifest" is a Law-12 incident
 * waiting to happen): public role keys only, never seeds. Each receipt is
 * validated with the shared validator and classified live/superseded by
 * content-hash recomputation against disk (the current state's hash is
 * embedded, never the content — Law 12).
 */
import fs from 'node:fs'
import path from 'node:path'

import { hashChange } from '@savant-code/common/crypto'
import {
  classifyReceipts,
  validateReceipt,
  validateReceiptBatch,
  type ReceiptClassification,
} from '@savant-code/common/provenance'

import { getVersion } from '../../utils/version'

import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

export const ATTEST_SCHEMA = 'savant.trust-receipt.v1'

/** Honest-claim trust warning (Nova audit flag #2) — emitted verbatim into
 *  both artifacts. */
export const TRUST_WARNING =
  'Receipt trust rests on the session\u2019s ephemeral keys: they are generated in memory, ' +
  'never persisted, and dropped at session end. A compromised session key compromises every ' +
  'receipt of that session; receipts prove the harness signed these verdicts for these content ' +
  'hashes, not that the model outputs were independently derived.'

/** Verbatim convenience-view disclaimer (Nova audit flag #3). */
export const HTML_DISCLAIMER =
  'This HTML is a convenience view; trust-receipt.json is the authoritative artifact.'

export type AttestSessionEntry = {
  sessionId: string
  manifest: {
    schema: string
    sessionId: string
    createdAt: string
    closedAt?: string
    finalSeq?: number
    mode: SessionManifest['mode']
    roles: Record<string, string>
  }
  summary: {
    receipts: number
    live: number
    superseded: number
    complete: number
    pending: number
    /** FID-2026-0814-005: closed without an independent verdict (terminal). */
    noVerdict: number
    withFailures: number
    byFid: Record<string, number>
  }
  receipts: {
    receipt: TrustReceipt
    validation: { valid: boolean; failures: string[] }
    classification: ReceiptClassification
    /** sha256:<hex> of the current disk state (never the content). */
    currentHash: string | null
  }[]
}

export type AttestBundle = {
  schema: typeof ATTEST_SCHEMA
  generatedAt: string
  product: 'SavantCode' | 'SavantFree'
  version: string
  trustWarning: string
  disclaimer: string
  sessions: AttestSessionEntry[]
}

export type AttestSessionInput = {
  manifest: SessionManifest
  receipts: TrustReceipt[]
  projectRoot: string
}

export function buildAttestBundle(
  product: 'SavantCode' | 'SavantFree',
  sessions: AttestSessionInput[],
  projectRoot: string,
): AttestBundle {
  const classified = sessions.map((session) => {
    const classification = classifyReceipts(session.receipts, projectRoot)
    const manifest = session.manifest
    const entries = session.receipts.map((receipt) => {
      const failures = validateReceipt(receipt, manifest)
      const batchFailures = validateReceiptBatch(session.receipts, manifest)
      const allFailures = [...failures, ...batchFailures]
      return {
        receipt,
        validation: { valid: allFailures.length === 0, failures: allFailures },
        classification:
          classification.get(receipt.seq) ??
          ('superseded' as ReceiptClassification),
        currentHash: currentFileHash(projectRoot, receipt),
      }
    })
    const byFid: Record<string, number> = {}
    for (const entry of entries) {
      const key = entry.receipt.fidId ?? '(no FID)'
      byFid[key] = (byFid[key] ?? 0) + 1
    }
    return {
      sessionId: manifest.sessionId,
      // Explicit whitelist — public metadata + role keys only (Law 12).
      manifest: {
        schema: manifest.schema,
        sessionId: manifest.sessionId,
        createdAt: manifest.createdAt,
        closedAt: manifest.closedAt,
        finalSeq: manifest.finalSeq,
        mode: manifest.mode,
        roles: { ...manifest.roles },
      },
      summary: {
        receipts: entries.length,
        live: entries.filter((e) => e.classification === 'live').length,
        superseded: entries.filter((e) => e.classification === 'superseded')
          .length,
        complete: entries.filter((e) => e.receipt.status === 'complete').length,
        pending: entries.filter((e) => e.receipt.status === 'pending').length,
        noVerdict: entries.filter((e) => e.receipt.status === 'no_verdict')
          .length,
        withFailures: entries.filter((e) => !e.validation.valid).length,
        byFid,
      },
      receipts: entries,
    } satisfies AttestSessionEntry
  })
  return {
    schema: ATTEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    product,
    version: getVersion(),
    trustWarning: TRUST_WARNING,
    disclaimer: HTML_DISCLAIMER,
    sessions: classified,
  }
}

function currentFileHash(
  projectRoot: string,
  receipt: TrustReceipt,
): string | null {
  try {
    const absolute = path.isAbsolute(receipt.path)
      ? receipt.path
      : path.join(projectRoot, receipt.path)
    if (!fs.existsSync(absolute)) return null
    return hashChange(fs.readFileSync(absolute, 'utf8'))
  } catch {
    return null
  }
}
