/**
 * Quarantine/live/ledger path resolution
 * (FID-2026-0819-005 Loop 304: extracted verbatim).
 */

import * as path from 'node:path'

import { SKILL_VERSIONS_DIR_NAME, SKILL_VERSIONS_LEDGER_NAME } from './types'
import { QUARANTINE_DIR_NAME } from '../../constants/skills'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function skillCanonicalDir(rootDir: string, name: string): string {
  return path.join(rootDir, '.agents', 'skills', name)
}

export function skillQuarantineDir(rootDir: string, name: string): string {
  return path.join(rootDir, '.agents', 'skills', QUARANTINE_DIR_NAME, name)
}

export function skillLedgerPath(rootDir: string, name: string): string {
  return path.join(skillCanonicalDir(rootDir, name), SKILL_VERSIONS_LEDGER_NAME)
}

export function skillVersionsDir(rootDir: string, name: string): string {
  return path.join(skillCanonicalDir(rootDir, name), SKILL_VERSIONS_DIR_NAME)
}
