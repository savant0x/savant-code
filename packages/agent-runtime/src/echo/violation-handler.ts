import type { EnforcementResult, AdvisoryWarning } from './types'
import type { ComplianceWarningLaw } from '@savant-code/common/types/echo-compliance'
import type { PrintModeComplianceWarning } from '@savant-code/common/types/print-mode'

export function formatBlockingError(
  reason: string,
  classification?: 'echo' | 'design_contract',
): string {
  const prefix =
    classification === 'design_contract'
      ? '[DESIGN CONTRACT]'
      : '[ECHO Enforcement]'
  return `${prefix} BLOCKED: ${reason}. Fix the violation and retry.`
}

/**
 * Corrective steering text for an EHEL advisory — the actionable "what to do
 * next" the tool executor injects into the agent's message history when a
 * pre-write gate blocks a write (Law 7/8 today). The `[ECHO enforcement]`
 * prefix mirrors the tracker's `[ECHO compliance]` steering format.
 */
export function buildSteeringText(warning: AdvisoryWarning): string {
  switch (warning.law) {
    case 7:
      return `[ECHO enforcement] ${warning.message} Run a codebase search first (glob / code_search) to check for an existing implementation, then retry the write.`
    case 8:
      return `[ECHO enforcement] ${warning.message} Log your intent first (write_todos / ask_user), then retry the write.`
    default:
      return `[ECHO enforcement] ${warning.message}`
  }
}

export function formatTurnEndReport(results: EnforcementResult[]): string {
  const blocking = results.filter((r) => r.blocked)
  const advisory = results.flatMap((r) => r.warnings)
  const parts: string[] = []
  if (blocking.length > 0) {
    parts.push(`BLOCKING violations (${blocking.length}):`)
    blocking.forEach((r) =>
      parts.push(
        `  - ${r.classification === 'design_contract' ? '[DESIGN_CONTRACT] ' : ''}${r.reason}`,
      ),
    )
  }
  if (advisory.length > 0) {
    parts.push(`Advisory warnings (${advisory.length}):`)
    advisory.forEach((w) =>
      parts.push(
        `  - ${w.classification === 'design_contract' ? 'Design contract' : `Law ${w.law}`}: ${w.message}`,
      ),
    )
  }
  return parts.length > 0 ? `[ECHO Turn End]\n${parts.join('\n')}` : ''
}

/**
 * Map an EHEL numeric law to the wire `compliance_warning` law value
 * (7 → `law7`, 8 → `law8`). The template-literal `ComplianceWarningLaw`
 * accepts any future numeric law without a code change.
 *
 * Disjoint-law invariant (updated FID-2026-0823-007): Laws 1, 3 and 4
 * block UNIVERSALLY (tier-independent), and blocked writes attach empty
 * advisory lists — Laws 7 and 8 remain the only non-blocking advisories
 * here. This mapping therefore still cannot emit a `law1`/`law3`/`law4`
 * receipt colliding with the tracker's own receipts. Keep that invariant
 * if a future gate gains non-blocking advisories.
 */
export function lawNumberToComplianceLaw(law: number): ComplianceWarningLaw {
  return `law${law}`
}

/**
 * Convert EHEL advisory warnings into `compliance_warning` chunks carrying
 * their ACTUAL law (never a hardcoded law1). The tracker's receipts and the
 * EHEL advisories emit disjoint law sets, so emitting both is never a
 * double-report of the same violation.
 */
export function buildComplianceWarningChunks(
  warnings: AdvisoryWarning[],
): PrintModeComplianceWarning[] {
  return warnings.map((warning) => ({
    type: 'compliance_warning',
    law:
      warning.classification === 'design_contract'
        ? 'design_contract'
        : lawNumberToComplianceLaw(warning.law),
    severity: warning.severity,
    message: warning.message,
    ...(warning.file !== undefined ? { path: warning.file } : {}),
  }))
}
