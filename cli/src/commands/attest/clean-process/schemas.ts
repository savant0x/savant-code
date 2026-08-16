/**
 * Clean-process schema allowlists (FID-2026-0813-008) — mirrored from the
 * shared validator, kept independent so a schema-drift bug cannot align them.
 */
export const RECEIPT_KEYS = [
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
export const SIGNATURE_KEYS = ['role', 'agentId', 'over', 'sig']
export const VERDICT_KEYS = [
  'phase',
  'agentType',
  'agentId',
  'verdictText',
  'timestamp',
  'over',
  'sig',
]
export const MANIFEST_KEYS = [
  'schema',
  'sessionId',
  'createdAt',
  'closedAt',
  'finalSeq',
  'mode',
  'roles',
]
