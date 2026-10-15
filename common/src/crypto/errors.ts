/**
 * ZTAP crypto error — FID-2026-0813-003.
 *
 * Fail-closed contract: every fallible crypto operation throws this typed
 * error; callers decide block-vs-record per provenance mode (D8). A silent
 * unsigned write is never allowed in `enforce` mode.
 */
export class ProvenanceCryptoError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ProvenanceCryptoError'
    this.code = code
  }
}

/** Convenience factory for the fail-closed paths. */
export function cryptoError(
  code: string,
  message: string,
): ProvenanceCryptoError {
  return new ProvenanceCryptoError(code, message)
}
