/**
 * Clean-process validation entry — FID-2026-0813-008.
 *
 * Independent re-implementation of the shared validator: bundle/manifest
 * checks, per-receipt rules (delegated to ./receipt), and live/superseded
 * classification are all re-proven here with built-ins only.
 */
import fs from 'node:fs'
import path from 'node:path'

import { hasUnknownKeys, isRecord, sha256Hex } from './primitives'
import { validateReceiptShape, validateReceiptSignatures } from './receipt'
import { MANIFEST_KEYS } from './schemas'

export type CleanProcessReceiptResult = {
  seq: number
  path: string
  valid: boolean
  failures: string[]
  classification: 'live' | 'superseded'
}

export type CleanProcessAuditResult = {
  ok: boolean
  sessions: number
  receipts: CleanProcessReceiptResult[]
  failures: string[]
}

/** Validate the authoritative JSON artifact against the independent rules. */
export function validateCleanProcessBundle(
  bundle: unknown,
  projectRoot: string,
): CleanProcessAuditResult {
  const failures: string[] = []
  if (!isRecord(bundle) || bundle.schema !== 'savant.trust-receipt.v1') {
    return {
      ok: false,
      sessions: 0,
      receipts: [],
      failures: ['bundle schema mismatch'],
    }
  }
  if (!Array.isArray(bundle.sessions)) {
    return {
      ok: false,
      sessions: 0,
      receipts: [],
      failures: ['sessions is not an array'],
    }
  }

  const results: CleanProcessReceiptResult[] = []
  for (const session of bundle.sessions) {
    if (
      !isRecord(session) ||
      !isRecord(session.manifest) ||
      !Array.isArray(session.receipts)
    ) {
      failures.push('malformed session entry')
      continue
    }
    const manifest = session.manifest
    const manifestFailures = validateManifest(manifest)
    if (manifestFailures.length > 0) {
      failures.push(...manifestFailures)
      continue
    }
    let previousSeq = 0
    const seen = new Set<number>()
    for (const entry of session.receipts) {
      if (!isRecord(entry) || !isRecord(entry.receipt)) {
        failures.push('malformed receipt entry')
        continue
      }
      const receipt = entry.receipt
      const receiptFailures: string[] = []
      receiptFailures.push(...validateReceiptShape(receipt))
      const seq = typeof receipt.seq === 'number' ? receipt.seq : -1
      const receiptPath =
        typeof receipt.path === 'string' ? receipt.path : '(unknown)'
      if (seen.has(seq)) receiptFailures.push(`duplicate seq ${seq}`)
      if (seq <= previousSeq) {
        receiptFailures.push(
          `seq ${seq} not strictly increasing (after ${previousSeq})`,
        )
      }
      seen.add(seq)
      previousSeq = seq
      if (
        typeof receipt.sessionId === 'string' &&
        receipt.sessionId !== manifest.sessionId
      ) {
        receiptFailures.push(`receipt ${seq}: sessionId mismatch`)
      }
      if (
        typeof receipt.timestamp === 'string' &&
        typeof manifest.createdAt === 'string' &&
        receipt.timestamp < manifest.createdAt
      ) {
        receiptFailures.push(`receipt ${seq}: timestamp before session start`)
      }
      if (
        typeof manifest.closedAt === 'string' &&
        typeof receipt.timestamp === 'string' &&
        receipt.timestamp > manifest.closedAt
      ) {
        receiptFailures.push(`receipt ${seq}: timestamp after session close`)
      }
      receiptFailures.push(...validateReceiptSignatures(receipt, manifest))
      const classification = classifyCurrentFile(
        projectRoot,
        receiptPath,
        receipt.changeHash,
      )
      results.push({
        seq,
        path: receiptPath,
        valid: receiptFailures.length === 0,
        failures: receiptFailures,
        classification,
      })
    }
  }

  const ok =
    failures.length === 0 &&
    results.length > 0 &&
    results.every((result) => result.valid)
  return { ok, sessions: bundle.sessions.length, receipts: results, failures }
}

/** Parse the verbatim JSON script embedded by the offline HTML exporter. */
export function extractEmbeddedAttestBundle(html: string): unknown {
  const startTag = '<script type="application/json" id="attest-bundle">'
  const start = html.indexOf(startTag)
  if (start < 0) throw new Error('attest-bundle script tag not found')
  const contentStart = start + startTag.length
  const end = html.indexOf('</script>', contentStart)
  if (end < 0) throw new Error('attest-bundle script closing tag not found')
  return JSON.parse(html.slice(contentStart, end)) as unknown
}

function validateManifest(manifest: Record<string, unknown>): string[] {
  const failures: string[] = []
  if (hasUnknownKeys(manifest, MANIFEST_KEYS))
    failures.push('manifest schema has unknown fields')
  if (manifest.schema !== 'savant.provenance.session.v1')
    failures.push('manifest schema mismatch')
  if (typeof manifest.sessionId !== 'string')
    failures.push('manifest sessionId missing')
  if (!isRecord(manifest.roles)) failures.push('manifest roles missing')
  return failures
}

function classifyCurrentFile(
  projectRoot: string,
  receiptPath: string,
  changeHash: unknown,
): 'live' | 'superseded' {
  if (typeof changeHash !== 'string') return 'superseded'
  const absolute = path.isAbsolute(receiptPath)
    ? receiptPath
    : path.join(projectRoot, receiptPath)
  try {
    if (!fs.existsSync(absolute)) return 'superseded'
    return `sha256:${sha256Hex(fs.readFileSync(absolute, 'utf8'))}` ===
      changeHash
      ? 'live'
      : 'superseded'
  } catch {
    return 'superseded'
  }
}
