# FID: Recorder relay guard missed SDK-absolutized writes — successful CREATE falsely relayed as stall

**Filename:** `FID-2026-0823-014-recorder-relay-guard-path-form-mismatch.md`
**ID:** FID-2026-0823-014
**Severity:** high
**Status:** closed
**Created:** 2026-08-23 22:12 EDT
**YAGNI-Compliance:** Pending

---

## Summary

The FID-2026-0823-008 relay guard (`checkRecorderOutcome`) classified a
SUCCESSFUL Recorder `write_file` as a stall because its allowed-target check
compared the RAW path string against relative prefixes
(`path.startsWith('dev/fids/')`). SDK-side resolution absolutizes write paths
(`C:\Users\…\dev\fids\x.md`), so every absolutized write — the common live
form — was invisible to the guard. Observed live 2026-08-23 during the
CREATE-shape probe: the child wrote `dev/fids/FID-2026-0823-013-…md`
successfully (disk ground truth + `"processFileBlock: Created new file"`
log line) yet the spawn relayed
`{ errorMessage: "Recorder stalled: read without write" }`. Fix (rev 1):
canonicalize before matching scoped to the repo root. Rev 2 (same day, after
a live post-restart probe re-falsified): make the match CWD-INDEPENDENT —
rev 1's `canonicalizePath('.')` scoping baked in the CLI's launch-dependent
working directory and missed legit writes whenever cwd ≠ repo root.

## Environment

- **OS:** Windows (Git Bash / MSYS); Bun 1.3.14; stealth/ox-alpha
- **Commit/State:** working tree @ v0.0.27 + unreleased hardening
- **Related records:** FID-2026-0823-008 (guard origin, closed+archived),
  FID-2026-0823-015 (canonicalization lesson + utility),
  FID-2026-0823-011/-012 (probe context); packages/agent-runtime/src/tools/
  handlers/tool/recorder-stall-check.ts; packages/agent-runtime/src/echo/
  path-canonicalization.ts

## Detailed Description

### Problem

`isAllowedWritePath` matched raw spellings:

1. Child calls `write_file` with an SDK-absolutized absolute path.
2. Guard checks `path.startsWith('dev/fids/')` → false → tool-call never
   registered as an allowed write.
3. Even though the write succeeded (`processFileBlock: Created new file`),
   `successfulAllowedWrites` stays empty → guard returns not-ok.
4. Parent receives `{ errorMessage: "Recorder stalled: …" }` for a run that
   actually fulfilled its contract — a false retry signal that (with the
   -012 ladder live post-restart) would waste a corrective re-spawn.

### Evidence (live probes, debug/cli.jsonl)

Probe A (02:04 UTC, pre-fix): child runId 187b129e / MYKnwSR7RW0 — write
succeeded via absolutized path (`processFileBlock: Created new file`),
relay falsely reported a stall; single child-run pair (ladder not loaded).

Probe B (02:31–02:32 UTC, post-restart with -012 ladder + -014 rev 1):
attempt 1 (runId 0316bf1c / MZw3XiXLAPI, contextTokenCount 26185,
messageCount 2→12) performed a SUCCESSFUL absolutized write
(`processFileBlock: Created new file …FID-2026-0823-013-…` census hit);
the freshly-loaded guard STILL relayed not-ok → ladder fired attempt 2
(runId 48ca4250 / MZyUfGISaMU, +2, no write) → exhaustion → false stall
relay. Ladder mechanics proven correct; guard rev 1 falsified in production.

Probe C (02:48 UTC, post-restart with -014 rev 2): child runId 35f70698 /
MasAmFbRPA4 — write succeeded via absolutized path and the canonicalized
guard COUNTED it: the spawn relayed normally (no stall errorMessage), no
corrective retry needed. See LIVE CONFIRMATION below.

### Root Cause (two layers)

Layer 1 (-009 class): raw-string guard across the caller-spelling vs SDK-
resolution boundary.
Layer 2 (rev 1's own bug): scoping matches to `canonicalizePath('.')` tied
them to process.cwd() at module load — a LAUNCH-DEPENDENT value
(`--cwd=cli`, launcher contexts). Repo-root unit tests shared the assumption
and could never catch it; only the live probe did.

## Impact Assessment

### Affected Components

- packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts
  (isAllowedWritePath)

### Risk Level

- [ ] Critical
- [x] High: the guard's entire purpose is accurate stall detection; false
      positives erode trust in the errorMessage channel and burn a bounded
      corrective retry on already-successful runs once -012 is live.

## Proposed Solution

### Approach (rev 2 — final)

Canonicalize before matching, CWD-INDEPENDENT:

```ts
function isAllowedWritePath(path: string): boolean {
  const canonical = canonicalizePath(path)
  return (
    canonical.includes('/dev/fids/') || canonical.endsWith('/CHANGELOG.md')
  )
}
```

Both raw spellings converge through canonicalizePath regardless of cwd; any
resolved path containing the `/dev/fids/` segment or ending in
`/CHANGELOG.md` counts. The guard is a relay CLASSIFIER (actual write
enforcement lives in the EHEL exempt-path gates), so the slightly wider
suffix match is the correct trade for never missing a legit write.

Rev 1 (superseded): repo-root-scoped startsWith via
`REPO_ROOT_CANONICAL = canonicalizePath('.')`.

### Verification

typecheck packages/agent-runtime exit 0; focused suites green incl. the
cwd-independence regression net; eslint --max-warnings 0 on touched files.
Live confirmation of the positive path: PASSED 2026-08-23 ~22:48 EDT (see
LIVE CONFIRMATION below).

## Perfection Loop

### Loop 1 — RED (2026-08-23)

- Live contradiction captured: disk ground truth + processFileBlock success
  log vs stall relay (see Evidence).
- Call-graph reachability: checkRecorderOutcome consumed by spawn-agents.ts
  reports mapping only (grep verified earlier this session); the fix is
  local to the matcher.

### Loop 1 — GREEN rev 1 (2026-08-23, SUPERSEDED same day)

- isAllowedWritePath canonicalized per rev-1 Approach;
  REPO_ROOT_CANONICAL computed once at module load.
- Gates green (typecheck exit 0; focused suites 19/0; eslint clean).

### Loop 1 — LIVE PROBE B + GREEN rev 2 (2026-08-23 ~22:30–22:44 EDT)

- Post-restart CREATE-shape probe re-falsified rev 1: the child wrote
  successfully via absolutized path (census hit) and the freshly-loaded
  guard still relayed not-ok; ladder fired and exhausted honestly.
  Provenance proven (ladder live ⇒ fresh modules ⇒ rev 1 was running).
- Root-caused to the cwd-dependence layer (see Root Cause).
- Rev 2 landed: cwd-independent includes()-based matcher per Approach.
- Regression net rebuilt (5 cases): SDK-absolutized FID counted; absolutized
  CHANGELOG counted; **arbitrary NON-cwd root FID counted** (rev-1 blind
  spot); no-dev/fids-segment path rejected; non-CHANGELOG markdown at any
  root rejected.
- Gates: typecheck packages/agent-runtime exit 0; focused suites 21 pass /
  0 fail; eslint --max-warnings 0 on touched files.

### Loop 1 — LIVE CONFIRMATION (2026-08-23 ~22:48 EDT, post-restart rev 2)

- Probe: CREATE-shape Recorder spawn against a recreated ephemeral marker
  (FID-2026-0823-013, deleted same-day after evidence capture).
- Result: **POSITIVE PATH CONFIRMED LIVE.** Child runId 35f70698 /
  MasAmFbRPA4 (debug/cli.jsonl Start/End lines 4497892→4498150,
  02:48:05Z→02:48:45Z, contextTokenCount 26185 bounded, messageCount 2→5 =
  CREATE-shape write pair + final text) wrote via an SDK-absolutized path
  (`C:\…\dev\fids\FID-2026-0823-013-…`) — and the canonicalized guard
  COUNTED it: the spawn relayed NORMALLY (lastMessage output, no stall
  errorMessage), no corrective retry needed (first attempt succeeded).
  Disk ground truth: marker existed byte-exact until same-day deletion.
- Discharges the NEEDS-REVIEW live-confirmation boundary in Step Status.

### ADVERSARIAL

Not run as a separate pass — closed by operator directive 2026-08-23 with
the Verifier AUDIT recorded in the GREEN entries and the live-confirmation
boundary discharged by first-hand relay evidence (Probe C: the spawn's own
return value showed the absolutized write + "Created file successfully" +
normal lastMessage output, no errorMessage).

## Step Status

- [x] RED evidence cataloged (live contradiction: disk + logs vs relay)
- [x] Rev 1 guard canonicalized — SUPERSEDED (cwd-dependent scoping
      falsified live)
- [x] Rev 2 guard: cwd-independent canonical matching
- [x] Regression net rebuilt incl. cwd-independence case (21 pass / 0 fail)
- [x] Gates green — typecheck exit 0; eslint clean
- [x] Receipt stamped; status fixed
- [x] Live confirmation of the positive path post-restart — PASSED
      (2026-08-23 ~22:48 EDT): a real absolutized Recorder CREATE write
      relayed normally under rev 2 (no stall, no retry needed); see LIVE
      CONFIRMATION loop section.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts
- gate: test packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts

### Verification Receipt

- fingerprint: sha256:c24c3e94081a3f7e60a8bde8ed96b6f250213a09bb8d17ad2f1b6060aabecf52
- verified: 2026-08-24T02:51:00Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/spawn-agents-recorder-stall.test.ts: exit 0

## Lessons Learned

1. **Canonicalize at BOTH ends — and never depend on launch environment.**
   Rev 1 fixed the raw-prefix defect but introduced a second latent one of
   the same class: `canonicalizePath('.')` bakes process.cwd() into the
   matcher, and the CLI's cwd is launch-dependent. A guard must match on
   path-intrinsic structure (the `/dev/fids/` segment), not environment
   state.
2. **Unit tests sharing the production assumption cannot catch environment
   dependence.** The cwd-scoped matcher passed every test run from the repo
   root and failed in production. Environment-dependent behavior needs a
   live probe or an environment-varied test matrix — green suites are not
   evidence of production correctness for this defect class.
3. **Live probes are ground truth for guard/relay pipelines.** Probe A
   found the defect, Probe B falsified rev 1 after static gates accepted
   it, Probe C confirmed rev 2 first-hand. Each probe overturned or
   confirmed claims that offline checks had already "verified".
4. **Fix ordering matters when defects compound.** The -008 false positive
   would have wasted -012 corrective retries on already-successful runs —
   landing the guard fix before the ladder went live avoided compounding
   two defects into a third failure mode.