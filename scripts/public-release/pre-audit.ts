// FID-2026-0913-004 — pre-audit orchestrator: composes the check families,
// applies safe fixes (mutation mode only; preview reports what WOULD be
// fixed), prints a verdict block, and returns whether the release is blocked.

import {
  checkConfigDirIsolation,
  checkConfigDirUnpolluted,
} from './pre-audit-config'
import {
  checkReleaseLock,
  checkStaleTag,
  checkWorktreeClean,
} from './pre-audit-local'
import { checkPushRange } from './pre-audit-push'

import type { AuditFinding, PreAuditMode, PreAuditResult } from './audit-types'

export function runPreAudit(
  root: string,
  version: string,
  mode: PreAuditMode,
): PreAuditResult {
  const findings: AuditFinding[] = []
  const fixes: (() => string)[] = []

  for (const result of [
    checkWorktreeClean(root),
    checkReleaseLock(root, version),
    checkStaleTag(root, version, mode === 'resume'),
    checkPushRange(root),
    checkConfigDirUnpolluted(),
    checkConfigDirIsolation(root),
  ]) {
    findings.push(...result.findings)
    fixes.push(...result.fixes)
  }

  const fixedMessages: string[] = []
  if (mode !== 'preview') {
    for (const fix of fixes) {
      try {
        fixedMessages.push(fix())
      } catch (error) {
        fixedMessages.push(
          `fix FAILED: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  const blocked = findings.some((finding) => finding.severity === 'block')
  return { findings, fixedMessages, blocked }
}
