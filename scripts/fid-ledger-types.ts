export type FidLedgerIssue = {
  code: string
  message: string
  /**
   * FID-2026-0927-003 F3: `warning` items are reported but do NOT fail the
   * repository gate. Only the FID receipt-staleness demotion uses this — a
   * stale receipt whose declared gates all pass the C3 live re-run. Absent
   * means `error`, so every pre-existing producer of this type is unchanged
   * and fails closed by default.
   */
  severity?: 'error' | 'warning'
}
