import path from 'node:path'

import {
  deriveRoleKeypair,
  hashChange,
  jcsCanonicalize,
  signPayload,
  type RoleKeypair,
} from '@savant-code/common/crypto'
import { receiptBase } from '@savant-code/common/provenance'

import { resolveOpenReceiptsAtClose } from './close-annotations'
import { ProvenanceLedger } from './ledger'
import { buildWriteReceipt } from './receipt'
import { bindVerdicts } from './verdict-binding'

import type { ProvenanceSessionOptions } from './registry'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  LawCheck,
  LedgerEntry,
  ProvenanceEvent,
  ProvenanceMode,
  ProvenanceSessionLike,
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

/** Bounded display/observability event cap (mirrors MAX_RUNTIME_EVENTS). */
const MAX_PROVENANCE_EVENTS = 2_000

/**
 * The per-session provenance engine (FID-2026-0813-004).
 *
 * Append-only chain (D1): write-time `pending` receipts, extended by signed
 * verdict bindings at Verifier/Adversary completion. Per-role keys (D2) from a
 * memory-only session seed; hash-only ledger (D3); mode-gated signing with
 * unconditional display events (D8 + FID-004 post-Nova clarification).
 */
export class ProvenanceSession implements ProvenanceSessionLike {
  readonly sessionId: string
  readonly mode: ProvenanceMode
  readonly projectRoot: string

  private readonly seed: Uint8Array | null
  private readonly roleKeys = new Map<string, Promise<RoleKeypair>>()
  private readonly ledger: ProvenanceLedger
  private readonly receipts = new Map<number, TrustReceipt>()
  private seqCounter = 0
  private readonly listeners = new Set<(event: ProvenanceEvent) => void>()
  private eventCount = 0
  private finalized = false
  private readonly manifest: SessionManifest

  constructor(options: ProvenanceSessionOptions) {
    this.sessionId = options.sessionId
    this.mode = options.mode
    this.projectRoot = options.projectRoot
    this.seed = this.mode === 'off' ? null : new Uint8Array(32)
    if (this.seed) {
      crypto.getRandomValues(this.seed)
    }
    // Key custody (master D2/D3, FID-2026-0813-005): the seed must never
    // serialize. Class fields are enumerable — redefine non-enumerable so even
    // an accidental JSON.stringify of the session (or an AgentState holding
    // it) cannot leak key material. Defense in depth: the field is also
    // documented @internal / non-serialized on AgentState.
    Object.defineProperty(this, 'seed', {
      value: this.seed,
      enumerable: false,
      configurable: false,
      writable: false,
    })
    this.ledger = new ProvenanceLedger(
      options.projectRoot,
      this.sessionId,
      (error) => {
        this.emit({
          type: 'session_finalized',
          sessionId: this.sessionId,
          receiptCount: -1,
        })
        // Best-effort surface: ledger failures must never break the write path.
        // eslint-disable-next-line no-console
        console.warn(`[provenance] ledger write failed: ${String(error)}`)
      },
    )
    this.manifest = {
      schema: 'savant.provenance.session.v1',
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      mode: this.mode,
      roles: {},
    }
    if (this.mode !== 'off') {
      this.ledger.writeManifest(this.manifest)
    }
  }

  getRoleKey(role: string): Promise<RoleKeypair> {
    const cached = this.roleKeys.get(role)
    if (cached) return cached
    if (!this.seed) {
      return Promise.reject(
        new Error('Provenance session is off; no keys available'),
      )
    }
    const derived = deriveRoleKeypair(this.seed, this.sessionId, role)
    this.roleKeys.set(role, derived)
    void derived.then((keypair) => {
      this.manifest.roles[role] = keypair.publicKey
        ? Buffer.from(keypair.publicKey).toString('base64url')
        : ''
    })
    return derived
  }

  async recordWriteReceipt(params: {
    path: string
    tool: TrustReceipt['tool']
    content: string
    writerAgentId: string
    writerAgentType: string
    fsmPhase: string
    fidId: string | null
    lawChecks: LawCheck[]
  }): Promise<TrustReceipt | null> {
    if (this.mode === 'off') return null
    const {
      path: writePath,
      tool,
      content,
      writerAgentId,
      writerAgentType,
      fsmPhase,
      fidId,
      lawChecks,
    } = params
    const seq = ++this.seqCounter
    const changeHash = hashChange(content)
    const relative = path
      .relative(this.projectRoot, writePath)
      .replaceAll('\\', '/')
    const receiptPath = relative.startsWith('..') ? writePath : relative
    const timestamp = new Date().toISOString()
    const receipt = buildWriteReceipt({
      sessionId: this.sessionId,
      seq,
      changeHash,
      path: receiptPath,
      tool,
      fidId,
      lawChecks,
      failClosed: this.mode === 'enforce',
      writerAgentId,
      writerAgentType,
      fsmPhase,
      timestamp,
    })
    try {
      const keypair = await this.getRoleKey(writerAgentType)
      const canonical = jcsCanonicalize(
        receiptBase(receipt) as unknown as JSONValue,
      )
      const { sig, over } = signPayload(keypair, { kind: 'jcs', canonical })
      receipt.signatures = [
        { role: writerAgentType, agentId: writerAgentId, over, sig },
      ]
    } catch (error) {
      if (this.mode === 'enforce') {
        // Fail closed: no receipt, no silent write claim. The pre-write gate
        // should have blocked earlier; this is the defense-in-depth path.
        throw error
      }
      this.emitNotice(
        `receipt signing failed for ${receiptPath}: ${String(error)}`,
      )
      return null
    }
    this.receipts.set(seq, receipt)
    const entry: LedgerEntry = { type: 'receipt', receipt }
    this.ledger.enqueue(entry)
    this.emit({ type: 'receipt_created', sessionId: this.sessionId, receipt })
    return receipt
  }

  async bindVerdict(params: {
    phase: 'audit' | 'adversarial'
    agentId: string
    agentType: string
    verdictText: string
  }): Promise<TrustReceipt[]> {
    // Engine extracted to verdict-binding.ts (FID-2026-0819-005 Loop 165);
    // the session supplies its own context.
    return bindVerdicts(
      {
        sessionId: this.sessionId,
        mode: this.mode,
        receipts: this.receipts,
        ledger: this.ledger,
        emit: (event) => this.emit(event),
        getRoleKey: (role) => this.getRoleKey(role),
        emitNotice: (message) => this.emitNotice(message),
      },
      params,
    )
  }

  /**
   * FID-2026-0814-005: resolve open receipts BEFORE the session-close entry
   * (extracted to close-annotations.ts, FID-2026-0819-005 Loop 157) so the
   * ledger order is receipt → verdict → session_close and the close
   * annotation is verifiable in the same chain.
   */
  private async resolveOpenReceipts(): Promise<TrustReceipt[]> {
    return resolveOpenReceiptsAtClose({
      sessionId: this.sessionId,
      mode: this.mode,
      receipts: this.receipts,
      ledger: this.ledger,
      emit: (event) => this.emit(event),
      getRoleKey: (role) => this.getRoleKey(role),
      emitNotice: (message) => this.emitNotice(message),
    })
  }

  async finalize(): Promise<void> {
    if (this.mode === 'off' || this.finalized) return
    this.finalized = true
    // FID-2026-0814-005: resolve open receipts BEFORE the session-close entry
    // so the ledger order is receipt → verdict → session_close and the close
    // annotation is verifiable in the same chain.
    await this.resolveOpenReceipts()
    this.ledger.enqueue({
      type: 'session_close',
      sessionId: this.sessionId,
      closedAt: new Date().toISOString(),
      finalSeq: this.seqCounter,
    })
    this.manifest.closedAt = new Date().toISOString()
    this.manifest.finalSeq = this.seqCounter
    this.ledger.updateManifest(this.manifest)
    await this.ledger.flush()
    this.emit({
      type: 'session_finalized',
      sessionId: this.sessionId,
      receiptCount: this.receipts.size,
    })
  }

  onEvent(listener: (event: ProvenanceEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: ProvenanceEvent): void {
    if (this.eventCount >= MAX_PROVENANCE_EVENTS) return
    this.eventCount++
    for (const listener of this.listeners) listener(event)
  }

  private emitNotice(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[provenance] ${message}`)
  }
}

export { receiptBase } from '@savant-code/common/provenance'
