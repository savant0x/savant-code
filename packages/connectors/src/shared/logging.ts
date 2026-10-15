/**
 * Logging seam — replaces `@shared/logging` (pino) (port deviation,
 * PORT-NOTES.md "Substitutions"). Upstream's engine consumes the logger
 * ONLY through this structural shape (type-only imports in fn-utils.ts /
 * interfaces/mod.ts; a constructor parameter at run time), so a minimal
 * console-backed implementation satisfies every call site while keeping
 * the engine dependency-free. A host that wants structured logging passes
 * its own implementation — the seam is the contract.
 */

export interface Logger {
  debug(...data: unknown[]): void
  info(...data: unknown[]): void
  warn(...data: unknown[]): void
  error(...data: unknown[]): void
  /** Bound-child seam — the engine derives scoped loggers (engine.ts:91). */
  child(bindings?: unknown): Logger
}

/** The default engine logger: warnings and errors to console, info/debug silent. */
export const noopLogger: Logger = {
  debug() {},
  info() {},
  /* eslint-disable no-console -- the seam's default sink IS the console; structured hosts inject their own Logger (rationale-comment rule) */
  warn: (...data: unknown[]) => console.warn(...data),
  error: (...data: unknown[]) => console.error(...data),
  // eslint-enable no-console
  child: () => noopLogger,
}
