import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  COMPLIANCE_EVENTS_FILE_NAME,
  COMPLIANCE_EVENT_SCHEMA_VERSION,
  COMPLIANCE_TELEMETRY_DIR_NAME,
} from '@savant-code/common/types/telemetry'
import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import type {
  ComplianceEvent,
  GateLayer,
  ViolationClass,
} from '@savant-code/common/types/telemetry'

/**
 * FID-2026-1007-012 FID 2 — in-process model-compliance telemetry sink.
 *
 * Mirrors the experience-capture contract verbatim (fail-open, atomic
 * line-append, single write per event, never throws): one JSONL line per
 * enforced-law observation. Differences from experience-capture are
 * deliberate: the payload is schema-typed metadata (never message text —
 * `AdvisoryWarning.message` may carry snippets), and the kill-switch is an
 * explicit config section (`complianceTelemetry.enabled`, default-on per the
 * build order) rather than hook declaration, because emission is caller-side
 * at the enforcement funnels, not engine-dispatched.
 *
 * Identity comes from the resolved request route and agent run. Historical
 * callers without identity retain empty model/provider and the agentId proxy.
 * No served-model claim or request/response content is stored.
 */

export interface ComplianceObservation {
  lawId: number
  violationClass: ViolationClass
  gateLayer: GateLayer
  agentId: string
  strikeCount?: number
}

export interface ComplianceIdentity {
  model: string
  provider: string
  sessionId: string
  agentRole: string
}

/** Build one immutable event record. Pure: `now` injects the clock. */
export function buildComplianceEvent(
  observation: ComplianceObservation,
  now: () => string = () => new Date().toISOString(),
  identity?: ComplianceIdentity,
): ComplianceEvent {
  return {
    schemaVersion: COMPLIANCE_EVENT_SCHEMA_VERSION,
    ts: now(),
    sessionId: identity?.sessionId ?? observation.agentId,
    model: identity?.model ?? '',
    provider: identity?.provider ?? '',
    lawId: observation.lawId,
    violationClass: observation.violationClass,
    agentRole: identity?.agentRole ?? observation.agentId,
    gateLayer: observation.gateLayer,
    contextHash: '',
    ...(observation.strikeCount === undefined
      ? {}
      : { strikeCount: observation.strikeCount }),
  }
}

const enabledCache = new Map<string, { mtimeMs: number; enabled: boolean }>()

/**
 * Kill-switch read with per-root mtime cache: one stat per emission, full
 * re-parse only when protocol.config.yaml changes. Missing/unreadable file
 * follows `readProtocolConfig`'s own default-on fallback.
 */
export function isComplianceCaptureEnabled(rootDir: string): boolean {
  try {
    const mtimeMs = fs.statSync(
      path.join(rootDir, 'protocol.config.yaml'),
    ).mtimeMs
    const cached = enabledCache.get(rootDir)
    if (cached !== undefined && cached.mtimeMs === mtimeMs) {
      return cached.enabled
    }
    const enabled = readProtocolConfig(rootDir).complianceTelemetry.enabled
    enabledCache.set(rootDir, { mtimeMs, enabled })
    return enabled
  } catch {
    return true
  }
}

/** Test isolation: clears the per-root kill-switch cache. */
export function resetComplianceCaptureCache(): void {
  enabledCache.clear()
}

/**
 * Atomic append of one record to `<rootDir>/dev/telemetry/compliance.jsonl`.
 * Creates the directory on first use. Fail-open: any filesystem error is
 * reported on the return, never thrown.
 */
export function appendComplianceRecord(
  rootDir: string,
  record: ComplianceEvent,
): { appended: boolean; error?: string } {
  try {
    const dir = path.join(rootDir, COMPLIANCE_TELEMETRY_DIR_NAME)
    const file = path.join(dir, COMPLIANCE_EVENTS_FILE_NAME)
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8')
    return { appended: true }
  } catch (error) {
    return {
      appended: false,
      error:
        error instanceof Error
          ? error.message
          : `capture failed: ${String(error)}`,
    }
  }
}

/**
 * Emit one observation unless the kill-switch is off. Never throws; an
 * undefined root or a disabled sink reports `{ appended: false }` without
 * touching disk (undefined = the caller has no project root, e.g. tests).
 */
export function runComplianceCapture(
  rootDir: string | undefined,
  observation: ComplianceObservation,
  identity?: ComplianceIdentity,
): { appended: boolean; error?: string } {
  if (rootDir === undefined || rootDir === '') return { appended: false }
  if (!isComplianceCaptureEnabled(rootDir)) return { appended: false }
  return appendComplianceRecord(
    rootDir,
    buildComplianceEvent(observation, undefined, identity),
  )
}
