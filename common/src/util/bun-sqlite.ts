/**
 * Canonical lazy `bun:sqlite` loader (FID-2026-1013-011 Wave 2 — ECHO Law 13).
 *
 * `bun:sqlite` is Bun-only, so every package that opens a SQLite database
 * resolves the constructor through the module-scope `require` at CALL time
 * rather than importing it at the top level — a hoisted `require("bun:sqlite")`
 * in a bundled `dist/index.cjs` breaks Node.js consumers of the SDK at load
 * time (the published SDK ships `engines.node >= 18` and a Node dist smoke
 * test).
 *
 * Four packages had grown their own copy of this loader with four different
 * error wordings. This module owns the mechanism; each caller keeps a thin
 * wrapper that supplies its own sentence subject, so the exact error text
 * (and, for the database tools, the `StructuredDbError` wrapping) is
 * preserved verbatim while the duplicated body is gone.
 *
 * `packages/database/src/index.ts` is the one deliberate exception: it is a
 * zero-dependency package and importing this module would add a workspace
 * edge, so it is registered in the shared-primitive rule's `allowedFiles`
 * instead (FID-2026-1013-011 W2-6).
 */

import type { Database } from 'bun:sqlite'

/** The module-scope `require` when it exists; `undefined` under Node ESM. */
export function getRuntimeRequire(): ((id: string) => unknown) | undefined {
  // `typeof` is safe even where `require` is undeclared (Node ESM) — it
  // evaluates to 'undefined' without throwing a ReferenceError.
  return typeof require === 'function' ? require : undefined
}

export interface ResolveBunSqliteModuleOptions {
  /**
   * The require implementation to resolve through. Injectable for tests;
   * pass explicit `null` to simulate an environment without `require`
   * (Node ESM). Omitting the property entirely has the same meaning.
   */
  requireFn: ((id: string) => unknown) | null | undefined
  /**
   * The complete leading clause of the thrown message, verb included — e.g.
   * `The knowledge-graph package requires the Bun runtime` or `The database
   * tools require the Bun runtime`. The caller supplies its own wording, so
   * the sentence stays grammatical and names the thing that actually failed
   * (the singular/plural verb differs per subject, which is exactly why this
   * is a clause rather than a noun phrase).
   */
  subject: string
  /** Guidance appended when no `require` exists at all (Node ESM/CJS). */
  unavailableHint?: string
  /** Guidance appended when `require('bun:sqlite')` itself threw. */
  loadFailureHint?: string
}

/**
 * Resolve the `bun:sqlite` module, or throw a clear error naming the caller's
 * subject when the runtime cannot provide it. Turns what would otherwise be a
 * bare `ReferenceError: require is not defined` (Node ESM) or a raw
 * `Cannot find module 'bun:sqlite'` (Node CJS) into an actionable message.
 *
 * The error is thrown as a plain `Error`; a caller with a richer error
 * contract (e.g. `StructuredDbError`) catches it and re-wraps, keeping the
 * message intact.
 */
export function resolveBunSqliteModule(
  options: ResolveBunSqliteModuleOptions,
): { Database: typeof Database } {
  const {
    requireFn,
    subject,
    unavailableHint = '',
    loadFailureHint = '',
  } = options
  if (typeof requireFn !== 'function') {
    throw new Error(
      `${subject}: bun:sqlite is only available under Bun.${unavailableHint}`,
    )
  }
  try {
    return requireFn('bun:sqlite') as { Database: typeof Database }
  } catch (error) {
    throw new Error(
      `${subject}: failed to load bun:sqlite (${
        error instanceof Error ? error.message : String(error)
      }).${loadFailureHint}`,
    )
  }
}
