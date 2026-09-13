// FID-2026-0913-004 — pre-audit shared types.

export type FindingSeverity = 'block' | 'fixed' | 'warn'

export interface AuditFinding {
  check: string
  severity: FindingSeverity
  message: string
}

/** Applies one safe fix; returns a human description. Must not throw past the caller's log. */
export type SafeFix = () => string

export interface CheckResult {
  findings: AuditFinding[]
  fixes: SafeFix[]
}

export type PreAuditMode = 'preview' | 'mutation' | 'resume'

export interface PreAuditResult {
  findings: AuditFinding[]
  /** Messages for fixes that were APPLIED (never in preview mode). */
  fixedMessages: string[]
  blocked: boolean
}
