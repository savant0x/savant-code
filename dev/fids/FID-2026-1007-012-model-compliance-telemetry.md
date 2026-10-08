# FID: Model Compliance Telemetry — per-model law-violation analytics

**Filename:** `FID-2026-1007-012-model-compliance-telemetry.md`
**ID:** FID-2026-1007-012
**Severity:** low
**Status:** created
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Formal FID for `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md`,
which has specified this work since 2026-08-24 with zero implementation. The
build order proposed turning EHEL's enforcement events into per-model compliance
profiles. It never left `planning` because nothing tracked it; this FID and its
`SCOPE.md` line (`T164-C`) are that tracking. Implementation is **not** authorized
by this record — `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md`
remains the design authority.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint`
- **Commit/State:** uncommitted working tree

## Detailed Description

### Problem

No compliance telemetry exists. Enforcement events fire at runtime but are not
persisted, so there is no ground truth about what models actually do under the
protocol — only what benchmarks measure about what they can do.

### Expected Behavior

Per the source build order: a `ComplianceEvent` schema, an in-process
fail-open capture sink, an aggregation engine, a CLI group, a desktop panel,
a drift sentinel, and a LEARNINGS feedback loop.

### Root Cause

Not a defect — an unstarted feature. The build order sat unindexed and
unregistered from 2026-08-24 until 2026-10-07.

### Evidence

Measured 2026-10-07, all absent:

```text
common/src/types/telemetry.ts   ABSENT
dev/telemetry/                  ABSENT
dev/telemetry/compliance.jsonl  ABSENT (repo-wide search)
```

The build order's own precondition is also unmet — it recommends a research pass
before Phase 1 and `source_research` is still empty.

## Impact Assessment

### Affected Components

None yet. Proposed: `common/src/types/telemetry.ts`, an in-process sink in the
hooks/enforcement layer, `scripts/telemetry-aggregate.ts`, a `telemetry` CLI
group, a desktop panel, `dev/telemetry/compliance.jsonl`.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

> No current degradation: the feature does not exist, so nothing regresses. The
> rating describes the risk of implementing it (a capture sink in the enforcement
> path is the sensitive surface), not a present fault.

## Proposed Solution

### Approach

Adopt the source build order's seven phases unchanged. This FID carries no
independent design.

### Steps

Per `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md`:

1. FID 1 — `ComplianceEvent` schema (metadata only, no code content).
2. FID 2 — in-process capture sink, fail-open, atomic append.
3. FID 3 — `scripts/telemetry-aggregate.ts`, deterministic streaming aggregation.
4. FID 4 — `telemetry` CLI group (summary / laws / models).
5. FID 5 — desktop compliance panel.
6. FID 6 — drift sentinel into `dev/agenda.md`.
7. FID 7 — LEARNINGS feedback loop on dominant-law share.

### Verification

Per the source build order's per-phase acceptance gates. None are declarable
until implementation exists.

## Verification Gates

None — `created` status; gates are declared at implementation time.

## Perfection Loop

### Loop 1 — RED

- **RED:** No telemetry surface exists; 0 of 7 items implemented.
- **GREEN:** Not reached — design authority is the source build order.
- **AUDIT / ADVERSARIAL:** Not reached.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **Should the build order be deleted now that a FID exists?** → No. It is the
   design record; this FID tracks it. Archiving it would lose the phase gates.
2. **Does Phase 6 conflict with the agenda cap?** → Yes, and it must be resolved
   before FID 6 opens: `dev/agenda.md` is capped at 1–3 items by
   `FID-2026-0824-012` S3-A, and a sentinel writing into it competes with the
   three capabilities already listed there.

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Source:** `dev/build-orders/BO-2026-08-24-model-compliance-telemetry.md`
- **Archived:** pending

### Code Verification Evidence

Status is `created` — no implementation exists, so there is nothing to verify
against. The absence claims in this FID's Evidence section are the verified
facts (measured 2026-10-07, every named path confirmed absent), reproduced here
so a future session re-measures rather than trusts.

## Lessons Learned

Pending implementation.