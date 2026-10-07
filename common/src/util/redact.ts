/**
 * Canonical credential redaction (FID-2026-1007-004 step 6, promoted here by
 * Law 13 — one truth, two callers).
 *
 * Two things in this repository persist model-facing text: the semantic
 * summariser's memory (`tools/handlers/tool/semantic-summary-upgrade.ts`) and
 * the evidence spill (`.savant/evidence/<runId>.jsonl`). Before this module each
 * either redacted or did not, and the one that did not was the wider surface:
 * the spill writes whatever a tool printed, at the tool-result boundary, keyed to
 * a run. One pattern list now governs both.
 *
 * The patterns are deliberately narrow and high-confidence (provider-shaped API
 * keys and bearer tokens): a false positive silently rewrites a legitimately
 * stored payload, and the store's whole purpose is fidelity.
 */

/** Secret-looking strings (API keys, bearer tokens) never enter a store. */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi,
]

/**
 * Replace every secret-looking substring with `[REDACTED]`. Idempotent, pure,
 * and never throws. Callers that persist the result must record that they did:
 * `redacted === true` is what tells a reader the stored bytes are a summary
 * rather than the original.
 */
export function redactSecrets(text: string): string {
  let redacted = text
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}
