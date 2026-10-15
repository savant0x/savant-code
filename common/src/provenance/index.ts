/**
 * ZTAP shared validator — FID-2026-0813-001 (master verification rules) and
 * FID-2026-0813-006 (attack suite).
 *
 * Lives in common so the runtime (agent-runtime provenance module), the CLI
 * `/attest` export, and the clean-process fixture share ONE implementation —
 * the FID-006 invariant ("the validator is the single implementation shared by
 * the runtime, the /attest export, and the attack suite"). The clean-process
 * validator (FID-2026-0813-008) is the deliberate independent re-implementation
 * with a parity test against this one.
 *
 * The public surface is unchanged from the former single-file module; the
 * implementation is decomposed into schema/receipt/batch/loader submodules.
 */
export { receiptBase, validateReceipt } from './receipt'
export {
  classifyReceipts,
  validateReceiptBatch,
  type ReceiptClassification,
} from './batch'
export { loadProvenanceSession, readProvenanceManifest } from './loader'
