/**
 * Teacher privacy policy — FID-2026-0813-012.
 *
 * Teacher privacy is an explicit product policy layered with ECHO Law 12
 * (sensitive-data protection). It is not a reinterpretation of Law 12.
 */
export type TeacherPrivacyPolicy = {
  version: string
  /** Teacher content, code, critiques, tests, and progression stay local. */
  localOnly: true
  /** No teacher data is sent to telemetry or any network service. */
  noTelemetry: true
  /** Raw critique text is never persisted; only evidence hashes are stored. */
  storesRedactedOnly: true
  /** ZTAP receipts record process evidence, not skill or identity. */
  ztapClaim: 'process-only'
}

/** The active V1 privacy policy. */
export const TEACHER_PRIVACY_POLICY: TeacherPrivacyPolicy = {
  version: '1',
  localOnly: true,
  noTelemetry: true,
  storesRedactedOnly: true,
  ztapClaim: 'process-only',
}
