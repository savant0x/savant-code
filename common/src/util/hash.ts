import { createHash } from 'node:crypto'

/**
 * Canonical hex SHA-256 over a UTF-8 string (FID-2026-0928-009 Part 4:
 * utility-tier consolidation home; the shared-primitive rule registry
 * points `sha256` definitions here).
 *
 * Naming: the agent-runtime `sha256Hex` variant keeps its name because its
 * call sites express "hex" at the call; the body below is the one truth.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function sha256Hex(value: string): string {
  return sha256(value)
}
