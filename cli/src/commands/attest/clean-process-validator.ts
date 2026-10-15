/**
 * Clean-process trust-receipt validator — FID-2026-0813-008 (barrel).
 *
 * The implementation lives in `./clean-process/`; every submodule there uses
 * only Node/Bun built-ins — no Savant package, common validator, or crypto
 * helper — so a shared implementation bug cannot make this audit pass. This
 * barrel keeps the public entry stable for the clean-process audit import.
 */
export {
  extractEmbeddedAttestBundle,
  validateCleanProcessBundle,
  type CleanProcessAuditResult,
  type CleanProcessReceiptResult,
} from './clean-process/validate'
