# Session Summary — 2026-09-16 1300 — probe-endpoint.ts ceiling split (Task 57)

**Operator directive:** "Split probe-endpoint.ts under the 300-line ceiling
and clear the quality:report FAIL" (approving Task 56's recorded
[OPEN-OUT-OF-SCOPE] item).

## 1. The defect and its history

`scripts/providers/lib/probe-endpoint.ts` measured 305 lines against the
300-line absolute ceiling (`protocol.config.yaml` `max_file_lines`). The
growth came from FID-2026-0916-001's implementation (commit `7d1446d0`),
whose declared gate list (typecheck ×2, two suites, LIVE harvest probe)
did not include `quality:report` — the last recorded quality PASS
(FID-2026-0915-002) predated it. Discovered at Task 56's gate run;
recorded as [OPEN-OUT-OF-SCOPE], approved as Task 57.

## 2. The split (move-only, FID-2026-0913-002 discipline)

- Natural seam: the two pure static guard functions
  (`isPrivateAddress`, `isPublicProbeUrl`) vs the `probeEndpoint` runner.
- NEW `scripts/providers/lib/probe-url-guard.ts` (96 lines): both
  functions byte-verbatim + the MQ4 trust-boundary rationale comment.
- `probe-endpoint.ts` (221 lines): imports the guards for the DNS leg and
  re-exports them — a facade preserving the `./probe-endpoint` import
  path for all four existing sites (`harvest-phases.ts`,
  `harvest-report-phase.ts`, both test files). Zero consumer churn,
  zero behavior change.

## 3. Gates

- `bun run quality:report` — **PASS (1498 baselined files)**; the FAIL is
  cleared (was: `probe-endpoint.ts: 305 lines exceeds absolute maximum 300`).
- Full scripts/providers suite: **101 pass / 411 expect / 0 fail** (11
  files) — exactly the parity FID-2026-0916-001 recorded at closure
  (probe-boundary + pipeline-integrity baseline was 22/76 pre-split).
- eslint `--max-warnings 0` on both touched files; prettier clean
  (facade reformatted by prettier, suite parity re-proven after).

## 4. Records

SCOPE Task 57 logged; Task 56's OOS item marked [RESOLVED — Task 57].
