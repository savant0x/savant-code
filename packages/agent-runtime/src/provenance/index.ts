/**
 * ZTAP provenance module — FID-2026-0813-004.
 *
 * Append-only signed chain at the EHEL write boundary: per-role Ed25519 keys,
 * write-time receipts, Verifier/Adversary verdict binding, a hash-only
 * `.savant/provenance/` ledger, a bounded display event stream, and the shared
 * validator (also consumed by the /attest export + attack suite).
 */
export { ProvenanceLedger } from './ledger'
export { ProvenanceSession, receiptBase } from './session'
export {
  createOffSession,
  getOrCreateProvenance,
  resolveProvenanceMode,
  type ProvenanceSessionOptions,
} from './registry'
export {
  classifyReceipts,
  validateReceipt,
  validateReceiptBatch,
  type ReceiptClassification,
} from './validate'
