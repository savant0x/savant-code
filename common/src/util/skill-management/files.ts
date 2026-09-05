/**
 * Reference-file operations (write/remove) inside the quarantine draft
 * (FID-2026-0819-005 Loop 304: extracted verbatim).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  appendLedgerEntry,
  referencesDir,
  validateReferencePath,
} from './helpers'
import { currentVersionOf, mutationBase } from './mutations'
import { skillQuarantineDir } from './paths'
import { hashChange } from '../../crypto/hash'

import type { SkillManageResult } from './types'

export function writeReferenceFile(params: {
  rootDir: string
  name: string
  relPath: string
  content: string
  sessionId: string
  reason: string
  provenanceRef?: string
}): SkillManageResult {
  const invalid = validateReferencePath(params.relPath)
  if (invalid) return { ok: false, error: invalid }
  const base = mutationBase(params.rootDir, params.name, 'write_file')
  if (!base.ok) return base
  const draftDir = skillQuarantineDir(params.rootDir, params.name)
  const file = path.join(referencesDir(draftDir), params.relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, params.content, 'utf8')
  const nextSha = hashChange(params.content)
  appendLedgerEntry(params.rootDir, params.name, {
    seq: base.seq,
    version: currentVersionOf(base.base),
    action: 'write_file',
    ts: new Date().toISOString(),
    sessionId: params.sessionId,
    reason: params.reason,
    prevSha: null,
    nextSha,
    provenanceRef: params.provenanceRef ?? `session:${params.sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name: params.name,
    version: currentVersionOf(base.base),
    action: 'write_file',
    nextSha,
    pendingTrust: true,
  }
}

export function removeReferenceFile(params: {
  rootDir: string
  name: string
  relPath: string
  sessionId: string
  reason: string
}): SkillManageResult {
  const invalid = validateReferencePath(params.relPath)
  if (invalid) return { ok: false, error: invalid }
  const base = mutationBase(params.rootDir, params.name, 'remove_file')
  if (!base.ok) return base
  const draftDir = skillQuarantineDir(params.rootDir, params.name)
  const file = path.join(referencesDir(draftDir), params.relPath)
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      error: `references/${params.relPath} does not exist in the draft`,
    }
  }
  fs.rmSync(file, { force: true })
  appendLedgerEntry(params.rootDir, params.name, {
    seq: base.seq,
    version: currentVersionOf(base.base),
    action: 'remove_file',
    ts: new Date().toISOString(),
    sessionId: params.sessionId,
    reason: params.reason,
    prevSha: null,
    nextSha: hashChange(''),
    provenanceRef: `session:${params.sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name: params.name,
    version: currentVersionOf(base.base),
    action: 'remove_file',
    nextSha: hashChange(''),
    pendingTrust: true,
  }
}
