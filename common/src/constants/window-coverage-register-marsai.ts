/**
 * MarsAI window-coverage register entry (FID-2026-1016-004).
 *
 * Seam split — the main register is at the 300-line quality ceiling.
 * Operator dashboard census 2026-10-16 (console-verified): 14 free-tier
 * ids, every row publishing no context window ("Context —"). The live
 * /v1/models probe is blocked from this network (DNS hijack + TLS reset).
 */
export const MARSAI_COVERAGE_ENTRIES = [
  [
    'marsai',
    {
      disposition: 'table-section',
      note: 'Static 14-model free-tier catalog from the operator dashboard census 2026-10-16 (console-verified); 10 exact-id rows are cross-gateway consensus in the context-window-table-marsai seam and 4 ids are documented no-row. The live /v1/models probe is blocked from this network (DNS hijack + TLS reset, 2026-10-16).',
    },
  ],
] as const
