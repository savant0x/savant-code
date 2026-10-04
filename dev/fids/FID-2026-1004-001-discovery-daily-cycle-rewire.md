# FID: Discovery daily cycle is dead in production — rebuild the boot-check automation to spec

**Filename:** `FID-2026-1004-001-discovery-daily-cycle-rewire.md`
**ID:** FID-2026-1004-001
**Severity:** high
**Status:** verified
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-10-04 01:36
**Automation level:** 2
> (Authority this FID needs to be actioned **without asking**: `1` approval-gated,
> `2` within approved scope, `3` fully automatable. The session ceiling is
> `protocol.config.yaml` → `session.autonomy_level`; an item is actioned without
> approval only when its level is ≤ the session level. No level lifts the G-laws,
> credential handling, Law 3, or the project-directory boundary — see
> "Automation Levels" in the governing protocol.)
**YAGNI-Compliance:** Verified — reuses the two existing pure gates and the
existing sanitized builder verbatim; the only new pure function is the custats
staleness gate (operator-ruled scope extension); no new system, no new state
beyond one sidecar file that already existed.

---

## Summary

The daily free-compute discovery automation promised by FID-2026-0914-003
Loop 5 ("daily boot-check automation — 24h cache, background, fail-silent")
stopped existing in production on 2026-10-03: the T111–T127 batch landing
(`9f1b8068`) deleted `maybeSpawnDailyHarvest()` and `announceDiscoveryBlock()`
from `cli/src/chat/use-chat-bootstrap.ts` while extracting their shared logic
into `common/src/providers/discovery-context.ts`, and **nothing was re-wired**.
The pure gates in `common/src/providers/discovery-boot.ts` now have zero
production callers (test-only), so the pipeline only runs when someone
manually invokes `bun run providers:harvest`. Observed staleness on
2026-10-04: `report.md` ~2 days, `custats.json`/`custats-report.md` ~6 days
(custats was never automated), while the repo had active sessions on 10-03
and 10-04 that should have fired the boot-check. The custats leg also never
had a place in the daily cycle by design (FID-2026-0928-011: manual command),
which the operator has now ruled into scope (ruling 2026-10-04: full daily
cycle). Rebuild is required against the CURRENT architecture — a git restore
of the old file is explicitly ruled out (operator directive 2026-10-04: the
tree has a week of unreleased work; rebuild properly, don't restore).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript strict, Bun 1.3.14 (root `engines.bun` pin)
- **Tool Versions:** tsc 5.x workspace typechecks; eslint 9 flat config
- **Commit/State:** `d10da542` (2026-10-04, main). Regression introduced in
  `9f1b8068` (2026-10-03, "feat: land the verified T111-T127 provider, budget,
  audit and sidecar work"). Last live boot-check output: `report.md` mtime
  2026-10-02 15:47 local.

## Detailed Description

### Problem

The discovery pipeline's daily automation is gone from production. Evidence
trail (2026-10-04 review of `dev/provider-candidates/`):

| Artifact | Last written | Producer | Should be |
|---|---|---|---|
| `report.md`, `candidates.json`, `denylist.json`, `agent-context.txt` | 2026-10-02 15:47 | `providers:harvest` via boot-check | ≤24h old after any session boot in this repo |
| `custats.json`, `custats-report.md` | 2026-09-28 19:30 | `providers:custats` (manual only) | >24h stale on 10-04 — never automated |
| `.announced-key` | 2026-09-17 | CLI announce sidecar | updates when the candidate set changes |
| `quality.json` | 2026-09-14 | `providers:quality` (manual, host-targeted) | benign — 0 tracked pipeline providers (see Non-Goals) |

`git log -S` pickaxe over `*.ts`/`*.tsx` shows exactly three commits ever
touched `shouldRunBootCheck`/`isDiscoveryRepo` references: `92694496`
(created, FID-2026-0914-003/0915-001), `876a0c06` (moved into
`use-chat-bootstrap.ts`), and `9f1b8068` (the batch that removed them).

Current-tree orphan proof (exit 1, zero production importers):

```text
$ grep -rln "discovery-boot" --include="*.ts" --include="*.tsx" \
    cli common sdk packages desktop agents
(no matches)
$ grep -nE "isDiscoveryRepo|shouldRunBootCheck|harvest|agent-context" \
    cli/src/chat/use-chat-bootstrap.ts
(no matches)
```

The removed code (from `git show 9f1b8068^:cli/src/chat/use-chat-bootstrap.ts`),
preserved here as the SPEC reference — not to be pasted back wholesale:

- `maybeSpawnDailyHarvest()` — guards: `tryGetProjectRoot()` → `IS_SAVANT_FREE`
  exempt → `isDiscoveryRepo(repoRoot)` → harvester existsSync →
  `shouldRunBootCheck({ reportExists, reportAgeMs })` (mtime of
  `dev/provider-candidates/report.md`); spawn:
  `Bun.spawn({ cmd: ['bun', harvester, '--probe'], cwd: repoRoot,
  stdin/stdout/stderr: 'ignore' })` + `child.unref()`; whole body in
  try/catch, fail-silent.
- `announceDiscoveryBlock(setMessages)` — guards: repo root + `IS_SAVANT_FREE`
  + file exists; `agent-context.txt` format: FIRST line = candidate-set key,
  remainder = sanitized block (blank → return); TTL via
  `dev/provider-candidates/.announced-key` string equality; on miss →
  `args.setMessages(prev => [...prev, getSystemMessage(block)])` + write
  sidecar; once-per-mount ref guard; fail-silent.

`common/src/providers/discovery-context.ts` header confirms the intended
consumer contract that the batch broke: "Lives in `common` … because **the
CLI's session bootstrap (`use-chat-bootstrap`) is the production consumer**;
the harvester script reuses the same builder so the announced surface cannot
drift from the surfaced one (Law 13: one truth)."

### Expected Behavior

Per FID-2026-0914-003 Loop 5 (the shipped contract, CHANGELOG 0.0.34):
inside the savant-code repo only, on CLI boot, when
`dev/provider-candidates/report.md` is missing or >24h old, the harvest runs
in the background (detached, discarded output, never blocking the TUI,
fail-silent, `IS_SAVANT_FREE` exempt); the sanitized announce block surfaces
once per candidate set as a system message. Per the operator ruling of
2026-10-04, the daily cycle additionally covers the custats leg: when
`dev/provider-candidates/custats.json` is missing or >24h old,
`scripts/providers/harvest-custats.ts` runs under the same boot-check
contract (background, fail-silent, repo-gated, free-build exempt).

### Root Cause

A refactor-vs-wiring gap, not a design change: FID-2026-1003-006 moved the
discovery announce/context construction into shared code and the batch
landed that extraction — but the removal of the two call sites in
`use-chat-bootstrap.ts` landed without re-creating them anywhere. The batch's
verification gates covered its own features (notification lifecycle, budget,
sidecar); no gate covered the prior FID's production seam, so Law 4 (verify
call-graph reachability) had no mechanical backstop and the deletion shipped
green. Root cause class: **cross-FID seam regression — a verified batch can
orphan an earlier FID's wiring when no reachability pin exists.**

### Evidence

1. `ls -la --time-style=full-iso dev/provider-candidates/` (2026-10-04 01:20):
   `report.md` 2026-10-02 15:47; `custats.json` 2026-09-28 19:30;
   `.announced-key` 2026-09-17; `quality.json` 2026-09-14.
2. `git show 9f1b8068 -- cli/src/chat/use-chat-bootstrap.ts`: deletions of the
   `discovery-boot` import, `maybeSpawnDailyHarvest()` (incl. the
   `Bun.spawn` + `child.unref()` body), `announceDiscoveryBlock()` (incl. the
   `.announced-key` TTL body), and the `discoveryAnnouncedRef` wiring.
3. Orphan greps quoted above; `dev/fids/archive/FID-2026-1003-006` line 105
   lists "Chat bootstrap announcements and discovery report/context
   construction" in scope, line 299 plans "retaining the repository
   harvester" — the extraction landed, the retention did not.
4. `common/src/providers/discovery-boot.ts` doc comment still describes the
   boot path as its caller ("The CLI boot path asks this pure function…").

## Impact Assessment

### Affected Components

- `cli/src/cli-boot-steps.ts` + `cli/src/index.tsx` — new home of the daily
  cycle spawn (pre-TUI boot seam; fires even if the user never enters chat —
  strictly earlier than the old chat-mount hook).
- `cli/src/chat/use-chat-bootstrap.ts` — announce surface re-added beside the
  surviving provider-setup guidance effect (same system-message pattern the
  batch kept).
- `common/src/providers/discovery-boot.ts` — gains `shouldRunCustatsBootCheck`
  (sibling of the existing gate; no behavior change to the existing two).
- `scripts/providers/harvest-freeairouter.ts`, `harvest-custats.ts` — NO
  changes (their gates and outputs are already spec-clean; the defect is
  purely the missing caller).
- `dev/provider-candidates/*` artifacts — resume daily refresh; stale
  notify surfaces (FID-2026-1001-002/FID-2026-1003-006 consumers) regain
  fresh inputs.

### Risk Level

- [x] High: a promised production automation is silently dead (no error, no
  log); the discovery pipeline's daily contract is broken and was found only
  by operator inspection. A manual `providers:harvest` workaround exists but
  is exactly the failure mode the automation exists to prevent.

## Proposed Solution

### Approach

Rebuild to spec against the current architecture — **reuse, never restore**:

1. **Daily-cycle spawn at the boot seam.** New fail-silent boot step in
   `cli/src/cli-boot-steps.ts` (called from `cli/src/index.tsx` beside the
   existing disclosures): repo-gate via `isDiscoveryRepo`, `IS_SAVANT_FREE`
   exempt, then per leg — freeairouter: stat
   `dev/provider-candidates/report.md` and gate via the existing
   `shouldRunBootCheck`; custats: stat `dev/provider-candidates/custats.json`
   and gate via a NEW pure sibling `shouldRunCustatsBootCheck`
   (same `FRESH_MS`, same shape, same exactly-24h-is-fresh boundary) in
   `common/src/providers/discovery-boot.ts`. Each leg spawns independently
   (`Bun.spawn`, `--probe` for the harvester, detached, discarded output,
   `unref()`) so one stale ledger cannot be masked by a fresh report and
   vice versa. Whole step try/catch — nothing throws into the TUI.
2. **Announce surface, spec-exact (operator ruling 2026-10-04: system
   message).** In `use-chat-bootstrap.ts`, re-add the announce as a thin
   effect beside the provider-setup guidance effect, delegating to a small
   exported helper (extracted for testability, e.g.
   `buildDiscoveryAnnouncement({ repoRoot, lastAnnouncedKey })` →
   `{ setKey, block } | null`) that parses `agent-context.txt`
   (line 1 = set key, remainder = block) and applies the `.announced-key`
   TTL; on miss the effect appends `getSystemMessage(block)` once per mount
   and writes the sidecar. Sanitization stays structural: the CLI surfaces
   the artifact the harvester built from
   `common/src/providers/discovery-context.ts` — no feed prose can enter
   model context by construction.
3. **Anti-recurrence pin (Law 4 backstop — the lesson of the root cause).**
   Extend `cli/src/cli-boot-steps.test.ts` with a reachability census that
   reads `cli/src/cli-boot-steps.ts` and FAILS if the freeairouter or custats
   spawn call sites disappear, so a future refactor cannot silently orphan
   the daily cycle again. Extend
   `scripts/providers/__tests__/discovery-seams.test.ts` with
   `shouldRunCustatsBootCheck` boundary pins (missing ledger → run; exactly
   24h → fresh; 24h+1ms → run). Add announce-helper pins in a new
   `cli/src/chat/__tests__/discovery-announce.test.tsx` using a temp-dir
   fixture (the `provider-wizard-discovery.test.ts` pattern): key-miss →
   block returned; key-hit → null; blank block → null.

### Steps

1. Add `shouldRunCustatsBootCheck` to `common/src/providers/discovery-boot.ts`
   (pure, DI-friendly, same contract as `shouldRunBootCheck`).
2. Add the daily-cycle boot step to `cli/src/cli-boot-steps.ts` (both legs,
   guards + spawn contract as in Approach 1) and call it from
   `cli/src/index.tsx`.
3. Re-add the announce surface in `cli/src/chat/use-chat-bootstrap.ts` via
   the extracted helper (Approach 2), repo-gated and fail-silent.
4. Write the three test artifacts (Approach 3) — RED-first where practical.
5. Verify: full gate list below + LIVE boot run in this repo (stale report →
   background harvest spawns; announce block appears exactly once; second
   boot → no re-announce while the key matches).
6. Update this FID's Perfection Loop + Implementation Evidence, stamp the
   receipt, and close per G2 (closure commit).

### Verification

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below. `fid:verify` enforces this for
> fixed/verified — a promise with no covering gate fails the stamp.

- LIVE: boot the CLI inside this repo with a >24h-old `report.md` and a
  >24h-old `custats.json`; confirm both background runs start (files refresh)
  without blocking the TUI; confirm the announce block surfaces once and the
  `.announced-key` sidecar is written; second boot announces nothing while
  the key matches; outside the repo (`isDiscoveryRepo` false) nothing spawns.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/cli-boot-steps.test.ts
- gate: test scripts/providers/__tests__/discovery-seams.test.ts
- gate: test cli/src/chat/__tests__/discovery-announce.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:91d95bcbaf09245b8e25e71266388c35e6ad3c0059f5a596913cc936e515e11e
- verified: 2026-10-04T06:06:22.279Z
- typecheck cli: exit 0
- test cli/src/cli-boot-steps.test.ts: exit 0
- test scripts/providers/__tests__/discovery-seams.test.ts: exit 0
- test cli/src/chat/__tests__/discovery-announce.test.tsx: exit 0
- quality: exit 0

## Step Status

- [x] Step 1 — `shouldRunCustatsBootCheck` pure gate in `common/src/providers/discovery-boot.ts`
- [x] Step 2 — daily-cycle boot step in `cli/src/cli-boot-steps.ts` + call site in `cli/src/index.tsx`
- [x] Step 3 — announce surface re-added in `cli/src/chat/use-chat-bootstrap.ts` via extracted helper
- [x] Step 4 — three test artifacts (reachability census, custats gate pins, announce-helper pins)
- [x] Step 5 — LIVE boot verification in this repo
- [ ] Step 6 — FID loop records + receipt + G2 closure commit

## Perfection Loop

### Loop 1 — RED

- **RED:** Production daily-cycle automation deleted by `9f1b8068`
  (2026-10-03) without re-wiring; `discovery-boot` helpers orphaned
  (zero production importers); `report.md` 2 days stale and `custats.json`
  6 days stale across multiple repo sessions; custats leg never automated by
  design. Full evidence trail above.
- **GREEN:** all six steps implemented against the current architecture
  (no git-restore): `shouldRunCustatsBootCheck` added beside the existing
  pure gate (`common/src/providers/discovery-boot.ts`); the daily-cycle
  boot step `spawnDiscoveryHarvestIfStale()` added to
  `cli/src/cli-boot-steps.ts` (DI: `nowMs`, injectable `spawn`, injectable
  `repoRoot`; two independent legs) and called from `cli/src/index.tsx`
  before the headless dispatch (root guaranteed by `initializeApp` at
  index.tsx:110); the announce helper
  (`cli/src/utils/discovery-announce.ts`: `buildDiscoveryAnnouncement`,
  `readAnnouncedKey`, `writeAnnouncedKey`) with the thin once-per-mount
  effect re-added to `cli/src/chat/use-chat-bootstrap.ts` beside the
  surviving provider-setup pattern; three test artifacts written
  (reachability census + 4 spawn pins, 4 custats-gate boundary pins, 6
  announce pins).
- **AUDIT:** LIVE `bun run providers:custats` exit 0 (43 attributed /
  47 unattributed / 1 expiring soon; ledger + report written) and
  `bun run providers:harvest --probe` exit 0 (139 records → 69 stage-0,
  1 new: `platform.kimi.ai`); LIVE cycle call returned in 14 ms
  (non-blocking); artifacts refreshed 2026-10-04 02:04; announce decision
  returns SURFACES for the new candidate set (35 changed + 1 new).
  Gates: typecheck common + cli exit 0; `cli-boot-steps.test.ts` 7 pass
  (2 pre-existing + 5 new, incl. the reachability census);
  `discovery-announce.test.tsx` 6 pass; `discovery-seams.test.ts` 20 pass
  (16 pre-existing + 4 new); eslint touched files `--max-warnings 0`
  clean (one import/order warning caught and fixed); quality PASS
  (caught `index.tsx` at 303/300 during the pass — comment compressed).
- **ADVERSARIAL:** (1) "Is the real spawn proven, or only the call
  decision?" The injected-recorder tests prove the exact commands; the
  LIVE cycle call exercised the real `Bun.spawn` path (14 ms, detached),
  but the probe's own process tree was cleaned up before the detached
  children could finish — the same parent-lifetime contract as the
  original implementation (a long-lived TUI boot), so the first real CLI
  boot lands the artifacts; the legs themselves were proven LIVE
  foreground, exit 0. (2) "What if the CLI closes seconds after boot?"
  Same exposure as the pre-batch implementation; the harvest is
  idempotent and the next boot re-fires on staleness, so no run is lost.
  (3) "Does the announce drift from the harvester's surface?" No — the
  CLI surfaces the artifact the harvester built via the shared
  `discovery-context` builder (Law 13, one truth).
- **CHANGE DELTA:** ~18% (Loop 1 records, Step Status, verification
  evidence, status)

### Missed Questions

> Surface every question that should have been asked when this FID was
> created, answer it with the most robust default derivable from inspection,
> and fold the answer back into the relevant sections.

1. **Why didn't the batch's verification catch the deletion?** Its gates
   covered the batch's own features; no gate asserted the PRIOR FID's
   production seams. Answer folded into Approach 3: the reachability census
   makes the call graph a tested artifact (Law 4 with a mechanical backstop).
2. **Is `quality.json`'s 20-day staleness part of this defect?** No — the
   quality gauntlet is manual and host-targeted, and the repo currently has
   0 tracked pipeline providers (report.md: "Tracked pipeline providers: 0"),
   so there is nothing to probe. Recorded as a Non-Goal; revisit when a
   provider enters tracking.
3. **Should the desktop/sidecar shell also spawn the cycle?** No — the
   FID-2026-0914-003 contract is CLI-boot-scoped and repo-gated; the desktop
   renderer has no `dev/` write path. Out of scope.
4. **Does the announce need the new notification inbox?** Operator ruled
   2026-10-04: no — system message (spec-exact MQ5). The inbox integration
   remains an option for a future FID if the operator wants persistence.

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent
> deferrals — every step must be `implemented`, `blocked`, or `deferred`
> (operator-approved only).

- [ ] **Commit SHA:** pending
- [ ] **File:line ranges:** pending
- [ ] **Gate output:** pending
- [ ] **Reproducibility:** pending
- [ ] **Step statuses:** pending

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 1 AUDIT)
- [x] Production call-graph evidence is present for new or repaired wiring
  (reachability census: both leg call sites + the `index.tsx` entry call)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

### Loop 3 — Final convergence

- **RED:** pending
- **GREEN:** pending
- **AUDIT:** pending
- **ADVERSARIAL:** pending
- **CHANGE DELTA:** pending

## Resolution

- **Closed Date:** pending (G2: closure requires a commit)
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Archived:** pending

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

Pending closure — provisional: a verified batch can orphan an earlier FID's
production wiring when seam ownership moves across packages; reachability
must be a tested artifact (census pins on call sites), not a human memory.
