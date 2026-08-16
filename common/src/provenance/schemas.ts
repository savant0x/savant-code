/**
 * ZTAP receipt/verdict schema allowlists — FID-2026-0813-001/006.
 *
 * The allowlists and the shared unknown-key rejection are used by the receipt
 * and verdict validators. Extracted so the schema contract lives in one place
 * without dragging the full validator graph into every consumer.
 */

export const RECEIPT_SCHEMA_KEYS = [
  'schema',
  'sessionId',
  'seq',
  'status',
  'changeHash',
  'path',
  'tool',
  'fidId',
  'lawChecks',
  'failClosed',
  'writer',
  'timestamp',
  'signatures',
  'verdicts',
]
export const SIGNATURE_SCHEMA_KEYS = ['role', 'agentId', 'over', 'sig']
export const VERDICT_SCHEMA_KEYS = [
  'phase',
  'agentType',
  'agentId',
  'verdictText',
  'timestamp',
  'over',
  'sig',
]

/** Unknown-key rejection shared by the receipt + verdict validators. */
export function hasUnknownKeys(value: object, allowed: string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).some((key) => !allowedKeys.has(key))
}
