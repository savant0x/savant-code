import { mkdirSync, writeFileSync } from 'node:fs'
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import {
  loadProvenanceSession,
  readProvenanceManifest,
} from '@savant-code/common/provenance'

import type {
  LedgerEntry,
  SessionManifest,
} from '@savant-code/common/types/provenance'

/**
 * ZTAP append-only ledger — FID-2026-0813-004 (master D5).
 *
 * `.savant/provenance/<sessionId>/`:
 *   - `receipts.jsonl` — one JCS-canonicalizable `LedgerEntry` per line.
 *     Append-only: never edited in place; verdict bindings append `verdict`
 *     lines that the export merges back into their receipt by (sessionId, seq).
 *   - `session.json` — session manifest (public keys only). Rewritten at
 *     finalize with `closedAt`/`finalSeq` (metadata, not receipts).
 *
 * Writes are serialized through a promise chain (async, never blocking the
 * write path); `flush()` awaits the chain. Failure is surfaced via the
 * onError callback and never thrown into the interactive write path in
 * `record` mode.
 */
export class ProvenanceLedger {
  readonly dir: string
  private readonly receiptsPath: string
  private readonly manifestPath: string
  private writeChain: Promise<void> = Promise.resolve()
  private readonly onError: (error: unknown) => void

  constructor(
    projectRoot: string,
    sessionId: string,
    onError: (error: unknown) => void = () => {},
  ) {
    this.dir = path.join(projectRoot, '.savant', 'provenance', sessionId)
    this.receiptsPath = path.join(this.dir, 'receipts.jsonl')
    this.manifestPath = path.join(this.dir, 'session.json')
    this.onError = onError
  }

  /** Create the ledger directory + write the initial manifest. */
  writeManifest(manifest: SessionManifest): void {
    try {
      mkdirSync(this.dir, { recursive: true })
      writeFileSync(
        this.manifestPath,
        JSON.stringify(manifest, null, 2),
        'utf8',
      )
    } catch (error) {
      this.onError(error)
    }
  }

  /** Rewrite the manifest (finalize: closedAt/finalSeq). Metadata, not receipts. */
  updateManifest(manifest: SessionManifest): void {
    try {
      writeFileSync(
        this.manifestPath,
        JSON.stringify(manifest, null, 2),
        'utf8',
      )
    } catch (error) {
      this.onError(error)
    }
  }

  /**
   * Append a ledger entry. Serialized through the write chain; returns
   * immediately (non-blocking). Errors route to onError.
   */
  enqueue(entry: LedgerEntry): void {
    const line = `${JSON.stringify(entry)}\n`
    this.writeChain = this.writeChain
      .then(async () => {
        await mkdir(this.dir, { recursive: true })
        await appendFile(this.receiptsPath, line, 'utf8')
      })
      .catch((error) => {
        this.onError(error)
      })
  }

  /** Await all pending appends (turn-end flush / finalize / attest). */
  async flush(): Promise<void> {
    await this.writeChain
  }

  /** Read the manifest file; null when missing or malformed. */
  readManifest(): SessionManifest | null {
    return readProvenanceManifest(this.dir)
  }

  /** Read the manifest from an explicit session directory. */
  static readManifestFrom(dir: string): SessionManifest | null {
    return readProvenanceManifest(dir)
  }

  /**
   * Load + reconstruct full receipts from a session directory (shared loader
   * in common — /attest and the clean-process fixture use the same one).
   * Never mutates the ledger.
   */
  static loadSession(dir: string): ReturnType<typeof loadProvenanceSession> {
    return loadProvenanceSession(dir)
  }
}
