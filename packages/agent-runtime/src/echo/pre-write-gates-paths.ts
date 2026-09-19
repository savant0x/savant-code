/**
 * @module echo/pre-write-gates-paths
 *
 * Shared write-gate path classification (FID-2026-0918-005: verbatim move
 * of `isExemptWritePath` out of pre-write-gates.ts under the 300-line
 * ceiling, so the Law 3 module and the parent gate share one authority).
 */

/** Exempt FSM write-gate prefixes (write-gate.ts): governance bookkeeping
 * paths whose writes are never blocked by pending code verification
 * (FID-2026-0820-012). */
export function isExemptWritePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  return (
    normalized.includes('dev/fids/') ||
    normalized.includes('dev/nova/') ||
    normalized.includes('dev/scratchpad/')
  )
}
