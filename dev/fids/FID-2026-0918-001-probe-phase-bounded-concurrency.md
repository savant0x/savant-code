# FID: Probe-phase bounded concurrency in the free-compute harvester

**Filename:** `FID-2026-0918-001-probe-phase-bounded-concurrency.md`
**ID:** FID-2026-0918-001
**Severity:** medium
**Status:** verified
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-09-18 12:05
**YAGNI-Compliance:** Pending

---

## Summary

The daily free-compute harvester's probe phase runs its endpoint probes
serially (`scripts/providers/lib/harvest-phases.ts:58-73`), one host at a
time with a 10 s timeout per probe request. With 71 tracked hosts and 41
currently at `boundary-unverifiable` (every one re-probed daily by design),
a `--probe` run spends minutes wall-clock in this loop. A small
bounded-concurrency pool (6) around the probe loop cuts wall clock ~5-6×
on probe-heavy runs while leaving per-host etiquette (one probe set per
host, distinct vendor endpoints), verdict semantics, state writes, and
audit-trail ordering guarantees unchanged.

## Environment

- **OS:** Windows 11 (win32, Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** bun 1.3.14
- **Commit/State:** working tree, `main` (pre-release session 2026-09-18)

## Detailed Description

### Problem

`runProbeMergePhase` (FID-2026-0915-002 seam 2c-a) probes its targets in a
bare `for` loop with `await` per target:

```text
scripts/providers/lib/harvest-phases.ts:58
  for (const target of probeTargets) {
    ...
    const result = await probeEndpoint({ baseUrl: card.url })
```

`probeEndpoint` performs up to three network round-trips (DNS guard
lookup, `GET /models`, unauthenticated `POST /chat/completions`), each
with a hard 10 s timeout (`probe-endpoint.ts: TIMEOUT_MS = 10_000`). A
single slow host can stall the whole phase for 10-30 s; 41 daily
re-probes of `boundary-unverifiable` hosts (persisted state 2026-09-18:
71 hosts, 41 unverifiable) make serial execution the dominant wall-clock
cost of the daily run.

### Expected Behavior

Probes should run concurrently up to a small bounded limit, preserving
all current per-run outputs exactly (verdicts, state merges, audit rows,
report parity).

### Root Cause

The loop was written serially in FID-2026-0914-003 (single-digit candidate
count at the time) and never revisited as the tracked set grew to 71
hosts.

### Evidence

```text
persisted state (dev/provider-candidates/candidates.json, 2026-09-18):
  hosts: 71
  boundary-unverifiable: 41   ← re-probed EVERY run by design
probe budget per host: DNS + GET /models + POST /chat/completions,
  TIMEOUT_MS = 10_000 each (scripts/providers/lib/probe-endpoint.ts)
serial loop: scripts/providers/lib/harvest-phases.ts:58-73
second serial site (Stage-E health, tracked providers only):
  scripts/providers/lib/harvest-report-phase.ts:125-135
```

## Impact Assessment

### Affected Components

- `scripts/providers/lib/harvest-phases.ts` (probe-merge phase)
- `scripts/providers/lib/harvest-report-phase.ts` (Stage-E health loop —
  same pool, tracked-provider count is small but the same helper applies)

### Risk Level

- [x] Medium: feature degraded (slow daily run), no correctness risk —
  every host is a distinct vendor endpoint, so bounded concurrency does
  not change per-host request etiquette.

## Proposed Solution

### Approach

Add one tiny bounded-concurrency helper (worker-pool over an array with a
fixed lane count — no new dependency; `p-limit` is not in the repo, Law 7)
in `scripts/providers/lib/probe-pool.ts`, and run both probe sites
through it. Concurrency limit: 6 (constant `PROBE_CONCURRENCY`), chosen
to stay polite toward any single DNS resolver/vendor while overlapping
the 10 s timeout windows.

Correctness constraints (all preserved):

1. Per-host semantics identical: one `probeEndpoint` call set per host,
   same `probeResults` map, same `open-relay-reject` audit rows.
2. State merge (`next.set`) happens after the pool completes — the merge
   loop is unchanged and still runs over the completed results map.
3. Deterministic order where it matters: `probeResults` is a Map keyed by
   host (insertion order may differ, but no consumer depends on insertion
   order — report rendering reads by key).
4. The Stage-E health loop keeps its verdict/detail derivation but moves
   its `probeEndpoint` calls into the same pool shape.

### Steps

1. [ ] RED-first pin: a test proving N probes with fake async run to
     completion under the pool and that in-flight count never exceeds the
     limit (fake-clock-free: track concurrent counter inside the injected
     `fetchImpl`).
2. [ ] GREEN: implement `probe-pool.ts` (`runWithConcurrency`), wire both
     probe sites.
3. [ ] Verify: targeted suites + `bun run quality:report` + eslint;
     LIVE `--probe` harvest run for wall-clock evidence; close + archive
     + CHANGELOG.

### Verification

- New pin suite: `scripts/providers/__tests__/probe-pool.test.ts`
  (concurrency cap respected; all results delivered; empty-input no-op).
- Existing suites green: `probe-boundary.test.ts`,
  `pipeline-integrity.test.ts`, `discovery-seams.test.ts`,
  `harvest-core.test.ts` (report parity unchanged).
- LIVE wall-clock comparison logged in this FID (serial baseline vs
  pooled run of the same state).

## Verification Gates

- gate: test scripts/providers/__tests__/probe-pool.test.ts
- gate: test scripts/providers/__tests__/harvest-core.test.ts
- gate: test scripts/providers/__tests__/probe-boundary.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:18b6ef34155520ae8f444a993c1755f7a3d6a564beba23f35bf1d8d60a8bd5a0
- verified: 2026-09-18T16:15:49.656Z
- test scripts/providers/__tests__/probe-pool.test.ts: exit 0
- test scripts/providers/__tests__/harvest-core.test.ts: exit 0
- test scripts/providers/__tests__/probe-boundary.test.ts: exit 0
- probe scripts/providers/harvest-freeairouter.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** serial probe loop identified at
  `scripts/providers/lib/harvest-phases.ts:58-73`; 41/71 hosts re-probed
  daily; 10 s per-request timeout makes worst case ~7 min of pure waiting.
- **GREEN:** bounded pool (6) across both probe sites; no dependency
  added; etiquette unchanged.
- **AUDIT:** (pending implementation evidence)
- **ADVERSARIAL:** (pending)
- **CHANGE DELTA:** initial authoring

### Missed Questions

1. *Does concurrent probing violate the harvester's etiquette contract
   (transparent UA, single daily fetch, never evades blocks)?* — No: the
   contract (harvest header comment) governs the FEED fetch (one per day)
   and per-host politeness; each host still receives exactly one probe
   set. Distinct hosts have no shared rate limiter.
2. *Does probe ordering affect the report?* — No: `probeResults` is keyed
   by host; `reportCandidates` maps over `entries` (feed order), not over
   the results map's insertion order.
3. *Why not raise the per-request timeout instead?* — Timeouts are the
   safety bound against hung vendor surfaces; shortening/lengthening them
   changes evidence semantics, not throughput.
4. *Why a hand-rolled pool instead of `p-limit`/`Bun.spawn` parallelism?*
   — the repo carries no promise-concurrency dependency (grep: zero
   matches), the helper is ~20 lines, and adding a dependency on release
   day violates YAGNI.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending operator commit (G1/G2 — agent prepares the
      path-scoped staging plan; closure + archive follow the commit)
- [x] **File:line ranges:** `scripts/providers/lib/probe-pool.ts:19-45`
      (runWithConcurrency + PROBE_CONCURRENCY);
      `scripts/providers/lib/harvest-phases.ts:11,60-90` (probe-merge
      phase pooled);
      `scripts/providers/lib/health-probe.ts:28-74` (Stage-E phase module,
      pooled, DI seams); `scripts/providers/lib/harvest-report-phase.ts`
      (health block → runHealthProbePhase delegation);
      `scripts/providers/__tests__/probe-pool.test.ts` (9 pins)
- [x] **Gate output:** probe-pool 9/0; providers tree 110/0 (12 files);
      eslint scripts/providers exit 0 (0 warnings); quality:report PASS
      (1498 baselined files); LIVE harvest `--probe --json` exit 0,
      13.7s wall clock, 214 records → 70 stage-0, report written
- [x] **Reproducibility:** grep `runWithConcurrency` → 2 production call
      sites (harvest-phases.ts:63, health-probe.ts:35) + tests;
      grep `runHealthProbePhase` → definition (health-probe.ts:28) +
      caller (harvest-report-phase.ts:124)
- [x] **Step statuses:** Step 1 (RED pins) `implemented`; Step 2 (pool +
      wiring) `implemented`; Step 3 (verify + LIVE evidence) `implemented`;
      closure/archive `blocked` on the operator commit (G2)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (harvest-phases.ts,
      harvest-report-phase.ts + new probe-pool.ts / health-probe.ts)
- [x] Implementation matches the Proposed Solution (pool limit 6, both
      probe sites wired, zero new dependencies)
- [x] Typecheck/tests/lint pass with pasted tool output (see gate output;
      scripts/ is not a tsc workspace — bun runs it directly, suite green)
- [x] Production call-graph evidence is present (grep pins above — both
      call sites reachable from main())
- [x] FID status reflects the actual implementation state (`verified`)

### Loop 2 — Independent audit and self-correction

- **RED:** initial wiring pushed harvest-report-phase.ts to 303 lines
  (>300 absolute ceiling — quality gate FAIL) and left the pooled health
  branch LIVE-evidence-only (0 tracked providers in the run).
- **GREEN:** Stage-E block split to lib/health-probe.ts (move-only seam,
  FID-2026-0915-002 discipline) + injectable fetchImpl/lookupImpl seams
  mirroring probeEndpoint's DI convention + 2 network-free pins for the
  health path; type-only import conversions per eslint.
- **AUDIT:** quality PASS (1498 files); providers suites 110/0; eslint 0
  warnings; LIVE run exit 0 (13.7s).
- **ADVERSARIAL:** the first health-pin draft faked a 200 for the
  unauthenticated POST — which probeEndpoint CORRECTLY classifies as an
  open relay (compromised). The fake was corrected to the
  legitimate-provider shape (200 /models, 401 POST); the pin now proves
  `healthy` verdicts flow through the pool, not false-compromised ones.
- **CHANGE DELTA:** ~35% (evidence sections + new module)

### Loop 3 — Final convergence

- **RED:** none open — gates green, reachability proven, LIVE evidence
  captured; only the G2 commit remains (operator-held).
- **GREEN:** n/a (no corrections required)
- **AUDIT:** receipt stamped via `bun run fid:verify --write` (gates
  re-run LIVE by the executor)
- **ADVERSARIAL:** residual risk — a vendor that rate-limits by IP
  rather than per-key could see 6 overlapping probes; mitigation is the
  small constant (6) and per-host single-set etiquette; no observed 429
  in the LIVE run.
- **CHANGE DELTA:** <2% (convergence)

## Resolution

- **Closed Date:** pending G2 commit (closure + archive immediately after)
- **Fix Description:** bounded-concurrency pool (6) for both harvester
  probe phases; Stage-E block split to its own module to hold the
  300-line ceiling
- **Tests Added:** Yes — scripts/providers/__tests__/probe-pool.test.ts
  (9 pins: cap, ordering, empty, oversized limit, serial degradation,
  rejection propagation, constant pin, pooled health ×2)
- **Verification Evidence:** see Implementation Evidence (gate output)
- **Archived:** pending G2 commit

## Lessons Learned

Serial `await` loops over network probes are the default silent
bottleneck: they pass every functional test and only show up as wall
clock. When a loop's body is per-item independent I/O, reach for a bounded
pool immediately (and keep the limit a named constant next to the timeout
it overlaps). Split for the file ceiling BEFORE the quality gate forces
it — the seam was already there (probe/report boundary).
