/**
 * Shared ZTAP validator — re-exported from `@savant-code/common/provenance`
 * (FID-2026-0813-006: ONE implementation shared by the runtime, the /attest
 * export, and the attack suite; the clean-process fixture is the deliberate
 * independent re-implementation). Kept as a module so the agent-runtime
 * provenance index surface stays stable.
 */
export {
  classifyReceipts,
  receiptBase,
  validateReceipt,
  validateReceiptBatch,
  type ReceiptClassification,
} from '@savant-code/common/provenance'
