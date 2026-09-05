/**
 * Draft rollback and operator trust boundary operations
 * (FID-2026-0819-005 Loop 304: extracted verbatim).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { appendLedgerEntry, nextLedgerSeq, readSkillFile } from './helpers'
import { currentVersionOf } from './mutations'
import {
  skillCanonicalDir,
  skillQuarantineDir,
  skillVersionsDir,
} from './paths'
import { SKILL_FILE_NAME, isValidSkillName } from '../../constants/skills'
import { hashChange } from '../../crypto/hash'

import type { SkillManageResult } from './types'

/**
 * Agent-initiated rollback — quarantine scope only (S2-E): restore snapshot
 * `seq` into the draft working copy. Restoring a LIVE skill is operator-only
 * (`skills rollback`, in the CLI — S2-E).
 */
export function rollbackDraft(params: {
  rootDir: string
  name: string
  seq: number
  sessionId: string
  reason: string
}): SkillManageResult {
  const { rootDir, name, seq, sessionId, reason } = params
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const snapshot = path.join(
    skillVersionsDir(rootDir, name),
    `v${seq}`,
    SKILL_FILE_NAME,
  )
  if (!fs.existsSync(snapshot)) {
    return { ok: false, error: `no snapshot v${seq} for skill '${name}'` }
  }
  const content = fs.readFileSync(snapshot, 'utf8')
  const draftDir = skillQuarantineDir(rootDir, name)
  if (!fs.existsSync(path.join(draftDir, SKILL_FILE_NAME))) {
    return {
      ok: false,
      error: `no quarantined draft '${name}' — operator rollback required`,
    }
  }
  fs.writeFileSync(path.join(draftDir, SKILL_FILE_NAME), content, 'utf8')
  const version = currentVersionOf(content)
  const ledgerSeq = nextLedgerSeq(rootDir, name)
  appendLedgerEntry(rootDir, name, {
    seq: ledgerSeq,
    version,
    action: 'rollback',
    ts: new Date().toISOString(),
    sessionId,
    reason,
    prevSha: null,
    nextSha: hashChange(content),
    provenanceRef: `session:${sessionId}`,
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version,
    action: 'rollback',
    nextSha: hashChange(content),
    pendingTrust: true,
  }
}

/** Operator-only: trust a draft (migrate quarantine → live). */
export function trustSkill(rootDir: string, name: string): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const draftDir = skillQuarantineDir(rootDir, name)
  const draft = readSkillFile(draftDir)
  if (!draft) return { ok: false, error: `no quarantined draft '${name}'` }
  const liveDir = skillCanonicalDir(rootDir, name)
  fs.mkdirSync(liveDir, { recursive: true })
  fs.writeFileSync(path.join(liveDir, SKILL_FILE_NAME), draft.content, 'utf8')
  fs.rmSync(draftDir, { recursive: true, force: true })
  return {
    ok: true,
    name,
    version: draft.version,
    action: 'edit',
    nextSha: hashChange(draft.content),
    pendingTrust: false,
    message: `trusted '${name}' v${draft.version}`,
  }
}

/** Operator-only: untrust (live → quarantine), keeping history intact. */
export function untrustSkill(rootDir: string, name: string): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const liveDir = skillCanonicalDir(rootDir, name)
  const live = readSkillFile(liveDir)
  if (!live) return { ok: false, error: `no trusted skill '${name}'` }
  if (live.immutable) {
    return { ok: false, error: `skill '${name}' is immutable — cannot untrust` }
  }
  const draftDir = skillQuarantineDir(rootDir, name)
  fs.mkdirSync(draftDir, { recursive: true })
  fs.writeFileSync(path.join(draftDir, SKILL_FILE_NAME), live.content, 'utf8')
  fs.rmSync(path.join(liveDir, SKILL_FILE_NAME), { force: true })
  return {
    ok: true,
    name,
    version: live.version,
    action: 'edit',
    nextSha: hashChange(live.content),
    pendingTrust: true,
    message: `untrusted '${name}' v${live.version} (moved to quarantine)`,
  }
}

/** Operator-only: restore snapshot `seq` into the LIVE copy. */
export function rollbackLiveSkill(
  rootDir: string,
  name: string,
  seq: number,
): SkillManageResult {
  if (!isValidSkillName(name))
    return { ok: false, error: `invalid skill name: ${name}` }
  const snapshot = path.join(
    skillVersionsDir(rootDir, name),
    `v${seq}`,
    SKILL_FILE_NAME,
  )
  if (!fs.existsSync(snapshot)) {
    return { ok: false, error: `no snapshot v${seq} for skill '${name}'` }
  }
  const liveDir = skillCanonicalDir(rootDir, name)
  const live = readSkillFile(liveDir)
  if (live?.immutable) {
    return {
      ok: false,
      error: `skill '${name}' is immutable — cannot rollback`,
    }
  }
  const content = fs.readFileSync(snapshot, 'utf8')
  fs.mkdirSync(liveDir, { recursive: true })
  fs.writeFileSync(path.join(liveDir, SKILL_FILE_NAME), content, 'utf8')
  appendLedgerEntry(rootDir, name, {
    seq: nextLedgerSeq(rootDir, name),
    version: currentVersionOf(content),
    action: 'rollback',
    ts: new Date().toISOString(),
    sessionId: 'operator-cli',
    reason: `operator rollback to v${seq}`,
    prevSha: live ? hashChange(live.content) : null,
    nextSha: hashChange(content),
    provenanceRef: 'operator-cli',
    semanticPreservation: true,
  })
  return {
    ok: true,
    name,
    version: currentVersionOf(content),
    action: 'rollback',
    nextSha: hashChange(content),
    pendingTrust: false,
    message: `rolled back '${name}' to v${seq}`,
  }
}
