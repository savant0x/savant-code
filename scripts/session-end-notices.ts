import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import { readProtocolConfig } from '@savant-code/common/util/protocol-config'
import {
  claimSkillLifecycleEvents,
  formatSkillLifecycleNoticeLine,
} from '@savant-code/common/util/skill-lifecycle-events'
import { countQuarantinedDrafts } from '@savant-code/common/util/skill-management'

import { syncProposals } from './telemetry-feedback'
import { runSentinel } from './telemetry-sentinel'

/** Mechanical drafts remain visible even when no chat created them. */
export function quarantineAlertNote(rootDir: string): string | null {
  const pending = countQuarantinedDrafts(rootDir)
  if (pending === 0) return null
  return (
    `⚠ ${pending} quarantined skill draft${pending === 1 ? '' : 's'} ` +
    'pending operator review — run `/skills list --quarantined`'
  )
}

/** Metadata-only report; acknowledgement stays with the rendering surface. */
export function skillLifecycleReportLines(rootDir: string): string[] {
  const { events, remaining } = claimSkillLifecycleEvents(rootDir, 'cli')
  if (events.length === 0) return []
  const lines = events.map(formatSkillLifecycleNoticeLine)
  if (remaining > 0)
    lines.push(`… ${remaining} more — run \`/skills activity\``)
  return lines
}

/** Run local insights at SessionEnd without consuming the agenda's item cap. */
export function telemetryReportLines(
  rootDir: string,
  options: { now?: number } = {},
): string[] {
  try {
    const source = path.join(
      rootDir,
      COMPLIANCE_TELEMETRY_DIR_NAME,
      COMPLIANCE_EVENTS_FILE_NAME,
    )
    if (
      !fs.existsSync(source) ||
      !readProtocolConfig(rootDir).complianceTelemetry.enabled
    ) {
      return []
    }
    const run = runSentinel(rootDir, options)
    const { written } = syncProposals(rootDir, options)
    return [
      ...run.findings.map(
        (finding) =>
          `Telemetry drift: law ${finding.law}, ${finding.priorCount} → ` +
          `${finding.currentCount} observations (${finding.ratio.toFixed(1)}×); ` +
          'review dev/telemetry/drift.jsonl.',
      ),
      ...written.map(
        (name) =>
          `Telemetry draft: dev/telemetry/proposals/${name} — operator review required.`,
      ),
    ]
  } catch {
    return ['Telemetry review unavailable; retry /telemetry.']
  }
}
