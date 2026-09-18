# FID: Cadence-based re-probe for boundary-unverifiable hosts

**Filename:** `FID-2026-0918-002-unverifiable-reprobe-cadence.md`
**ID:** FID-2026-0918-002
**Severity:** low
**Status:** verified
**Created:** 2026-09-18 12:05
**YAGNI-Compliance:** Verified — one gate function + one pure stamp
helper + an additive optional state field; no new network surface, no new
dependency.

---

## Summary

The harvester re-probes every host whose standing boundary verdict is
`boundary-unverifiable` on EVERY daily run (the only mechanism by which
that verdict self-corrects — FID-2026-0915-002 rationale). Today 41 of 71
tracked hosts sit in that class, so each daily run spends its serial probe
budget largely re-measuring hosts that have been unverifiable for days.
This FID proposes a 3-day re-probe cadence for that class (aligned with
the existing 72-hour grace rule, `PROBE_LAPSED_AFTER_DAYS = 3` in
`scripts/providers/lib/health.ts:10`), cutting the daily probe load
roughly in half while leaving new/changed/lapsed probing and report
semantics untouched. Boundary verdicts already carry forward in state
(`diffCandidates`, `common/src/providers/discovery-state.ts` —
`lastBoundary: card.boundaryVerdict ?? prev?.lastBoundary ?? null`), so
non-probed days lose no evidence.

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** bun 1.3.14
- **Commit/State:** working tree, `main` (pre-release session 2026-09-18)

## Detailed Description

### Problem

`runProbeMergePhase` targets:

```text
scripts/providers/lib/harvest-phases.ts:49-55
  const probeTargets = entries.filter(
    (entry) =>
      entry.classification === 'new' ||
      entry.classification === 'changed' ||
      next.get(entry.host)?.lastBoundary === 'boundary-unverifiable',
  )
```

The third disjunct re-probes every unverifiable host daily. Persisted
state 2026-09-18: 71 hosts, 41 unverifiable — the dominant per-run probe
count, most of it repeat measurement of hosts whose verdict has not
changed in days (each re-probe costs up to 3 × 10 s serial).

### Expected Behavior

Unverifiable hosts are re-measured on a bounded cadence (every 3rd day)
instead of daily; their standing verdict remains authoritative on
non-probe days via the existing carry-forward.

### Root Cause

The daily re-probe was correct when unverifiable was a small transient
class; at 58% of the tracked set it is a standing cost.

### Evidence

```text
state 2026-09-18: hosts 71, boundary-unverifiable 41 (persisted
candidates.json). Probe-target filter: harvest-phases.ts:49-55.
Carry-forward already safe for skipped days:
  common/src/providers/discovery-state.ts (diffCandidates):
    lastBoundary: card.boundaryVerdict ?? prev?.lastBoundary ?? null
Grace-rule precedent: PROBE_LAPSED_AFTER_DAYS = 3 (health.ts:10)
```

## Impact Assessment

### Affected Components

- `scripts/providers/lib/harvest-phases.ts` (probe-target filter)
- `common/src/providers/discovery-state.ts` (new optional
  `lastProbeAttemptUtc` field on `CandidateState`, written by the
  probe-merge phase when a probe is attempted)

### Risk Level

- [x] Low: evidence freshness on unverifiable hosts becomes ≤3 days old
  instead of ≤1 day; no verdict changes; report unchanged (standing
  verdicts render identically via carry-forward).

## Proposed Solution

### Approach

1. Add optional `lastProbeAttemptUtc?: string` to `CandidateState`
   (state v2 is additive-tolerant; absent field = "never attempted").
2. In `runProbeMergePhase`, extend the target filter: an unverifiable
   host is re-probed only when
   `now - lastProbeAttemptUtc >= REPROBE_CADENCE_MS` (3 days, constant
   `UNVERIFIABLE_REPROBE_DAYS = 3` beside `PROBE_LAPSED_AFTER_DAYS` in
   `health.ts` — one truth for the 72h number, Law 13).
3. On every attempted probe (any verdict), write `lastProbeAttemptUtc`.

### Steps

1. [x] RED-first pin: cadence gate (fresh attempt < 3 days old → skipped;
     stale attempt → re-probed; never-attempted → probed; new/changed
     always probed) — `probe-cadence.test.ts` written first, failed on the
     missing module (0 pass), then GREEN 9/0. `implemented`
2. [x] GREEN: `lastProbeAttemptUtc` field (type + parse + diff
     carry-forward), `shouldReprobeUnverifiable` gate,
     `withProbeAttempt` write-back, filter + phase wiring (`nowMs`
     param). `implemented`
3. [x] LIVE double-run proof: run 1 stamped 40 hosts; run 2 (same day)
     probed none of them — zero timestamp diffs, wall clock 14.0s →
     1.13s. `implemented`

### Verification

- `scripts/providers/__tests__/intelligence-layer.test.ts` (or a new
  `probe-cadence.test.ts`) pins the four filter cases.
- LIVE `--probe` run: unverifiable probe count drops from 41 to
  ~0 (day-1 write-back) then stays ≤ new/changed volume.

## Verification Gates

- gate: typecheck common
- gate: test scripts/providers/__tests__/probe-cadence.test.ts
- gate: test scripts/providers/__tests__/harvest-core.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:c91e7614deb3086312c22d6a1d1aa39d45b42beefda0decf8afa9cfaaa43db21
- verified: 2026-09-18T18:08:36.651Z
- typecheck common: exit 0
- test scripts/providers/__tests__/probe-cadence.test.ts: exit 0
- test scripts/providers/__tests__/harvest-core.test.ts: exit 0
- probe scripts/providers/harvest-freeairouter.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** 41/71 hosts re-probed daily for an unchanged unverifiable
  verdict; carry-forward (`lastBoundary ?? prev`) already renders
  non-probed days correctly, so daily re-probing buys freshness only.
- **GREEN:** 3-day cadence keyed on a written-back
  `lastProbeAttemptUtc`; constant shares the 72h number with the lapse
  rule.
- **AUDIT:** implementation audited LIVE (2026-09-18): two consecutive
  `--probe` harvests — run 1 stamped 40 hosts, run 2 (same day) probed
  NONE of them (identical host sets, zero timestamp diffs; wall clock
  14.0s → 1.13s); probe-cadence 9/0, providers tree 119/0, typecheck
  common exit 0, quality PASS
- **ADVERSARIAL:** residual — an operator who WANTS daily freshness on
  unverifiable hosts may disagree with the cadence; resolved by operator
  approval 2026-09-18 and the one-line constant. The malformed-timestamp
  fail-open default was adversarially chosen: it can only spend an extra
  probe, never lose evidence.
- **CHANGE DELTA:** ~40% (implementation evidence + live proof)

### Missed Questions

1. *Does skipping a re-probe weaken the open-relay (LLMjacking) guard?*
   — No: open-relay is only ever confirmed by a 2xx probe, and an
   open-relay host is `open-relay-reject`, never
   `boundary-unverifiable` — it stays out of this class entirely.
   Tracked Stage-E providers (compromise detection) are health-probed
   EVERY run regardless of cadence; this FID does not touch that loop.
2. *What about a host that flips from unverifiable to boundary-ok?* — It
   leaves the class on its next cadence probe; meanwhile it renders its
   standing verdict (unchanged behavior).
3. *State migration?* — Additive optional field; v2 parse treats absent
   as "never attempted" (probe day 1). No version bump.
4. *Interaction with FID-2026-0918-001 (concurrency pool)?* —
   Independent and complementary: pool cuts per-probe wall clock,
   cadence cuts probe count. Either ships alone.

## Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending operator commit (G1/G2 — closure + archive
      follow the commit)
- [x] **File:line ranges:** `scripts/providers/lib/health.ts`
      (UNVERIFIABLE_REPROBE_DAYS + shouldReprobeUnverifiable +
      withProbeAttempt); `common/src/providers/discovery-state.ts`
      (lastProbeAttemptUtc field + diff carry-forward);
      `common/src/providers/discovery-state-io.ts` (defensive parse);
      `scripts/providers/lib/harvest-phases.ts` (filter gate + attempt
      write-back + nowMs param); `scripts/providers/harvest-freeairouter.ts`
      (caller); `scripts/providers/__tests__/probe-cadence.test.ts` (9 pins)
- [x] **Gate output:** probe-cadence 9/0; providers tree 119/0 (13 files);
      typecheck common exit 0; eslint scripts + common/providers 0
      warnings; quality PASS (1498 files); LIVE double-run evidence above
- [x] **Reproducibility:** grep `shouldReprobeUnverifiable` → definition
      + phase call site + tests; grep `lastProbeAttemptUtc` → type,
      parse, diff carry-forward, write-back, tests
- [x] **Step statuses:** all three steps `implemented`; closure/archive
      `blocked` on the operator commit (G2)

## Resolution

- **Closed Date:** 2026-09-18 (G2 commit `69f6e7a7`)
- **Fix Description:** 3-day re-probe cadence for boundary-unverifiable
  hosts via `shouldReprobeUnverifiable`; every attempted probe stamps
  `lastProbeAttemptUtc` (type/parse/diff/write-back all carry it)
- **Tests Added:** Yes — scripts/providers/__tests__/probe-cadence.test.ts
  (9 pins: constant, gate ×5 incl. fail-open, pure stamp, parse round-trip,
  diff carry-forward)
- **Verification Evidence:** LIVE double-run — 40 hosts stamped in run 1,
  zero re-probes in run 2 (identical host sets, zero timestamp diffs,
  wall clock 14.0s → 1.13s); probe-cadence 9/0; providers tree 119/0;
  typecheck common exit 0; quality PASS
- **Archived:** 2026-09-18 — moved to `dev/fids/archive/` at commit `69f6e7a7`; receipt re-stamped at the archived path

## Lessons Learned

A cadence feature lives or dies by its state field surviving EVERY state
rebuild — `diffCandidates` re-creates host records from an explicit field
literal, so the new field needed its own carry-forward line and a pin
proving a re-sight preserves it. Prefer fail-open on malformed cadence
inputs: an extra probe costs seconds, a lost re-measure costs days of
stale boundary evidence.
