<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z Parallel-Worktrees Harness Live Test — Run Report (run 3)

**Archived:** 2026-10-18, promoted from
`dev/scratchpad/az-parallel-worktrees-live-test-report.md`.
**Predecessors:** run 1 `2026-10-17-parallel-worktrees-live-test-report.md`,
run 2 `2026-10-17-parallel-worktrees-live-test-report-run2.md` (same directory).
**Run date:** 2026-10-18
**Harness:** Savant interactive CLI (`bun dev`), operator-driven. The original
instrument authorized `kiosapi` / `step-5-preview`; this run was executed on the
operator's live session, whose model row was not surfaced — recorded as
"operator session".
**Start HEAD:** `abe727a76ad6af373a6a629d708cda349e8b60b3`
**End HEAD:** `abe727a76ad6af373a6a629d708cda349e8b60b3` (unchanged — no merge
occurred; see §5.12+ NOT-RUN)
**`bun --version`:** `1.3.14`
**Baseline `git status --short`:** empty (clean) at run start
**Overall call:** **DEFECTS FOUND** (see BLOCKER-1 and the §5 instrument
defects)

---

## 1. Verdict summary

| Verdict | Count |
|---|---|
| PASS | 20 |
| FAIL | 1 (§5.11) |
| OPERATOR-CONFIRMED | 4 (§5.4, §5.11, and the two operator confirmations recorded) |
| NEEDS-REVIEW | 2 (§5.9a, §5.10) |
| SKIP | 0 |
| NOT-RUN | 9 (§5.12, §5.13, §5.14, §5.15, §5.16a, §5.16b, §5.17a, §5.17b, §5.17c, §6.1) |

**FAIL list:** §5.11 (dirty-disposal refusal did not fire).

**Instrument defects (not code defects):**

1. §5.9a/§5.10 are structurally unfalsifiable because
   `docs/design/parallel-worktrees-lane-proof.md` is **already tracked on
   `main`** (commits `3d24daf9`, `01763f17` from prior runs). The lane, created
   from `abe727a7`, therefore contains a clean tracked file at the target path,
   so a fresh covered write cannot be distinguished and the "dirty lane"
   expectation cannot hold.
2. §5.11 expects a `dirty` refusal but the lane was clean, so `dispose`
   succeeded.
3. §2's "baseline `git status --short` MUST be empty" is validated only at start
   and is not continuously enforced — a concurrent operator session mutated the
   tree mid-run (see BLOCKER-1).

---

## 2. §3 — Phase 0 (exposure and identity)

| Row | Verdict | Evidence |
|---|---|---|
| 0.1 | PASS | `git grep -n "fid_worktree" -- agents` → `agents/savant/savant.ts:140` (`!analyzeOnly && !planOnly && 'fid_worktree',`), `agents/types/tool-name.ts:13` (`| 'fid_worktree'`), `agents/types/tool-params-map.ts:19` (`fid_worktree: FidWorktreeInput`). No other agent role file lists it. |
| 0.2 | PASS | `bun --version` → `1.3.14`; start HEAD `abe727a76ad6af373a6a629d708cda349e8b60b3`; `git status --short` empty; provider/model: operator session. |

---

## 3. §4 — Phase 1 (automated gate matrix)

| Row | Gate | Verdict | Duration | Evidence |
|---|---|---|---|---|
| 4.1 | root typecheck | PASS | 72s | `bun run typecheck` → `=== EXIT=0 DURATION=72s ===`; 16 `tsc --noEmit` invocations, zero diagnostics. |
| 4.2 | provision suite | PASS | 2s | `10 pass / 0 fail`, 29 expect() calls. |
| 4.3 | dispose suite | PASS | 2s | `5 pass / 0 fail`, 20 expect() calls. |
| 4.4 | merge suite | PASS | 16s | `5 pass / 0 fail`, 16 expect() calls. |
| 4.5 | environment suite | PASS | 7s | `3 pass / 0 fail`, 20 expect() calls. |
| 4.6 | tool suite | PASS | 9s | `7 pass / 0 fail`, 47 expect() calls. |
| 4.7 | law2 jurisdiction | PASS | 7s | `5 pass / 0 fail`, 13 expect() calls. |
| 4.8 | params schema | PASS | 1s | `3 pass / 0 fail`, 24 expect() calls. |
| 4.9 | sdk ripgrep pin | PASS | 2s | `15 pass / 0 fail`, 40 expect() calls. |
| 4.10 | lane probe | PASS | 10s | `EXIT=0`; `PASS — two isolated lanes, lane scope, WAL snapshot, CLI fast-forward, graph refresh, divergence refusal, dispose and self-heal held`. |
| 4.11 | repository validation | PASS | 12s | `EXIT=0`; `Provider docs counts match the registry; no unevidenced fact drift.` + `validation: PASS`. |

Totals: **53 tests, 0 failures across 8 suites**; both root gates exit 0.

---

## 4. §5 — Phase 2 (live lane lifecycle)

| Row | Verdict | Evidence |
|---|---|---|
| 5.1 | PASS | `{ "action": "list" }` → `{"ok":true,"lanes":[],"warnings":[]}`. |
| 5.2 | PASS | `{"action":"create","fid_id":"FID-9999"}` → schema refusal before dispatch: `the arguments failed the tool schema at: fid_id — invalid_format`. No side effects. |
| 5.3 | PASS | `{"action":"create","fid_id":"FID-2026-1017-999"}` → `{"ok":false,"reason":"not-converged","detail":"Create requires exactly one active converged FID"}`. Verified no branch `savant/FID-2026-1017-999` and no lane directory. |
| ⌘ 5.4 | PASS (operator-confirmed) | `{"action":"create","fid_id":"FID-2026-1017-008"}` → `ok:true`, record: `fidId` `FID-2026-1017-008`; `relativePath` `.savant/worktrees/FID-2026-1017-008`; `branch` `savant/FID-2026-1017-008`; `baseSha` `abe727a76ad6af373a6a629d708cda349e8b60b3` (== start HEAD); `worktreeIndex` `1`; `dependencyLinks` = `["node_modules","cli/node_modules","common/node_modules","sdk/node_modules","evals/node_modules","desktop/node_modules"]`; `createdAt` `2026-10-18T19:14:14.690Z`; `warnings: []`. |
| 5.5a | PASS | Lane dir exists; `.savant/worktrees/.records/FID-2026-1017-008.json` matches the tool `record` field-for-field (7 fields identical). |
| 5.5b | PASS | `git worktree list --porcelain` lists main AND the lane path; `git -C <lane> rev-parse --abbrev-ref HEAD` → `savant/FID-2026-1017-008`. |
| 5.5c | PASS | All six links are directory links to the main checkout: `node_modules -> /c/Users/spenc/dev/savant-code/node_modules` (and `cli/`, `common/`, `sdk/`, `evals/`, `desktop/` equivalents). Git Bash renders them as `lrwxrwxrwx`; on this platform the managed dependency links present as symlinks rather than NTFS junctions. |
| 5.5d | PASS | Lane `.savant/graph.db` exists, 7,180,288 bytes (main `.savant/graph.db` 7,704,576 bytes). |
| 5.5e | PASS | Main `git status --short` empty immediately after provisioning. |
| 5.6 | PASS | Second `create` → `{"ok":false,"reason":"fid-in-use","detail":"FID-2026-1017-008 already has a managed FID worktree"}`. Nothing mutated. |
| 5.7 | PASS | `list` → one lane: `registered: true`, `dirty: false`, `warnings: []`. |
| 5.8a | PASS | `bun scripts/worktree.ts list` → exit 0; JSON matches §5.7 (same record fields, registered true / dirty false). |
| 5.8b | PASS (retry) | First attempt **corrupted by MSYS path translation**: Git Bash rewrote the unquoted regex `/KEY\|TOKEN\|SECRET/i` into `C:/Program Files/Git/KEY\|TOKEN\|SECRET/i`, producing a JS parse error (`Expected ")" but found ":" at .../[eval]:1:254`). Retried with `MSYS_NO_PATHCONV=1` + `MSYS2_ARG_CONV_EXCL='*'` and single-quoted payload: `{"root":"C:\\Users\\spenc\\dev\\savant-code\\.savant\\worktrees\\FID-2026-1017-008","index":"1","port":"3100","compose":"savant_wt1","graph":"C:\\Users\\spenc\\dev\\savant-code\\.savant\\worktrees\\FID-2026-1017-008\\.savant\\graph.db","secretVars":0}` — all values as expected. |
| 5.8c | PASS | `bun scripts/worktree.ts exec --fid FID-2026-1017-008 -- bun -e "process.exit(7)"` → reported exit code `7`. |
| 5.9a | NEEDS-REVIEW | `write_file` to `<lane>\docs\design\parallel-worktrees-lane-proof.md` was **blocked by Law 1** (target unread). The subsequent read showed the file already present with the exact expected content, and `git -C <lane> status --porcelain` was **empty** — the file is tracked at HEAD because it is already committed on `main` (`3d24daf9`, wrapped `01763f17`). A fresh covered write therefore cannot be distinguished from the pre-existing file. **No write of mine landed; nothing was corrupted.** |
| 5.9b | PASS | `write_file` to `az-out-of-scope-probe.txt` → BLOCKED: `Law 2: no approved scope item covers "C:\Users\spenc\dev\savant-code\az-out-of-scope-probe.txt"; present it first (FID-2026-1001-003 step 5a).` Verified the file was NOT created. |
| 5.9c | PASS | `write_file` to `.savant/worktrees/AZ-NOT-A-LANE/probe.txt` → BLOCKED: `Law 2: target is not inside a registered FID worktree with its own SCOPE.md.` Verified nothing created. |
| 5.10 | NEEDS-REVIEW | `git -C <lane> status --porcelain` → **empty**, not the expected `?? docs/design/parallel-worktrees-lane-proof.md`. The file is tracked (see §5.9a), so the lane was clean rather than dirty. |
| ⌘ 5.11 | **FAIL** (operator-confirmed) | `dispose` (no flag) → `{"ok":true,"removed":true,"warnings":[]}` — the dispose **succeeded** instead of refusing with `dirty`. Cause: the lane was clean (§5.10), because the proof file was already tracked. This is an **instrument precondition defect**, not a lifecycle defect: a clean lane is legitimately disposable. |
| ⌘ 5.12 | NOT-RUN | Lane was disposed by §5.11 before this row could execute. |
| ⌘ 5.13 | NOT-RUN | No live lane. |
| 5.14 | NOT-RUN | No merge occurred. |
| 5.15 | NOT-RUN | No merge occurred. |
| 5.16a | NOT-RUN | No live lane. |
| 5.16b | NOT-RUN | No merge occurred. |
| 5.17a | NOT-RUN | Operator declined after the §5.11 disposal. |
| ⌘ 5.17b | NOT-RUN | No live lane. |
| ⌘ 5.17c | NOT-RUN | No live lane. |
| 5.18 | PASS (partial, observed via §5.11 disposal) | Lane directory gone; `git worktree list` shows only main; `.records/FID-2026-1017-008.json` gone (`.records/` empty); branch `savant/FID-2026-1017-008` RETAINED by design; `.savant/fid-worktree.lock` absent; `list` → `{"ok":true,"lanes":[],"warnings":[]}`. |
| 5.19 | PASS (with caveat) | End HEAD `abe727a7` == start HEAD (no merge commit — by design, since §5.13 did not run). `git status --short` is **NOT clean**: entries belong to a concurrent operator session (see BLOCKER-1). |

---

## 5. §6 — Phase 3 (recovery surfaces)

| Row | Verdict | Evidence |
|---|---|---|
| 6.1 | NOT-RUN | Operator stopped the mutation sequence before this row; the busy-lock directory was not planted. |

---

## 6. §7 — Agent View

### 6.1 Divergences between expected and observed

1. **§5.9a expected** "write succeeds" — **observed** file already present and
   clean-tracked; the write attempt was Law 1-blocked. Prompt expectation:
   "EXPECTED: write succeeds — the lane's own register covers this repo-relative
   target via FID-2026-1017-008." Observed status:
   `git -C <lane> status --porcelain` → *(empty)*.
2. **§5.10 expected** `?? docs/design/parallel-worktrees-lane-proof.md` —
   **observed** *(empty)*.
3. **§5.11 expected** `dirty` refusal ("Commit lane changes or explicitly
   authorize discard_changes") — **observed**
   `{"ok":true,"removed":true,"warnings":[]}`.
4. **§5.5c expected** Windows `Junction` link type — **observed** Git Bash
   symlinks (`lrwxrwxrwx ... -> /c/Users/spenc/dev/savant-code/...`).
   Platform-equivalent; the link targets are correct and resolve into the main
   checkout.
5. **§5.8b expected** a single clean invocation — **observed** the first
   invocation was mangled by MSYS path translation of `/KEY|TOKEN|SECRET/i`.
   The instrument permits adapting quoting while keeping query semantics; the
   retry used `MSYS_NO_PATHCONV=1` + `MSYS2_ARG_CONV_EXCL='*'`.

### 6.2 Refusal/failure strings encountered (verbatim)

- `the arguments failed the tool schema at: fid_id — invalid_format`
- `{"ok":false,"reason":"not-converged","detail":"Create requires exactly one active converged FID"}`
- `{"ok":false,"reason":"fid-in-use","detail":"FID-2026-1017-008 already has a managed FID worktree"}`
- `Law 2: no approved scope item covers "C:\Users\spenc\dev\savant-code\az-out-of-scope-probe.txt"; present it first (FID-2026-1001-003 step 5a).`
- `Law 2: target is not inside a registered FID worktree with its own SCOPE.md.`
- `Law 1: Read 0-EOF before touch — "...\docs\design\parallel-worktrees-lane-proof.md" has not been read.`
- `error: Expected ")" but found ":" at ...\.savant\worktrees\FID-2026-1017-008\[eval]:1:254` (plus three further parse errors) — §5.8b first attempt.

### 6.3 Hook/gate refusals of terminal commands

None at the terminal-command level: the mutating-terminal guard did not block
any row. All shell interventions were **write-gate** refusals (Law 1 / Law 2
above) and one **phase-gate** refusal at run start
(`run_terminal_command is only available during AUDIT, GREEN, or SELF-CORRECT
phases. Current phase: idle.`), resolved by transitioning `idle → red → green`.

### 6.4 Rows that ran but were inconclusive

- **§5.9a, §5.10** — inconclusive because the target file is already tracked on
  `main`. The covered-write and dirty-lane behaviors were not genuinely
  exercised.

### 6.5 Paths deliberately NOT covered

- **Child-role-forbidden leg of `fid_worktree`** — only a spawn attempt could
  prove it; not attempted (no child role was spawned with the tool in scope).
- **Active-lane cap** — not exercised (only one lane was created).
- **Merge CONFLICT path** — no conflict was constructed (merge rows did not
  run).
- **Branch-diverged-from-base create refusal** — not exercised.
- **Re-create-after-dispose branch reuse** — not exercised (lane was not
  re-created).
- **§5.12–§5.17, §6.1** — not run because the operator stopped the mutation
  sequence after §5.11 disposed the lane.

### 6.6 BLOCKER — concurrent session mutating the main checkout mid-run

**BLOCKER-1 (live interference).** The §2 precondition requires a clean
`git status --short`. It was clean at run start. During the run the main
checkout acquired changes that **this run did not make**:

```text
 M SCOPE.md
 M cli/src/components/tools/registry.ts
?? cli/src/components/tools/__tests__/fid-worktree.render.test.tsx
```

(later, as the other session progressed: ` M cli/src/components/model-picker.tsx`,
`?? cli/src/components/__tests__/model-picker-load.test.tsx`).

The `SCOPE.md` diff adds two **new** register items, `FID-2026-1018-002`
(worktree result traffic-light rendering) and `FID-2026-1018-003` (model picker
blank screen), and two new FID files appeared in `dev/fids/` at `15:16` — i.e.
two minutes after the lane was created (`15:14`). The operator confirmed:
*"im running another agent alongside you, don't be alarmed, continue your run."*

**Why it is a BLOCKER for this instrument:** §5.13's merge gate runs
`git status --porcelain --untracked-files=normal` on **both** checkouts. Any
concurrent mutation makes the merge impossible even if the lane rows had run,
and it makes §5.19's "clean final checkout" unverifiable. The instrument
validates cleanliness only at §2 and never re-checks it before §5.13. A second
agent sharing the checkout therefore silently invalidates the run.

**Not a code defect in the lane system.** The lane system behaved correctly for
everything it was allowed to do. This is an **instrument/environment hazard**.

### 6.7 Timing observations

- §4.1 root typecheck: 72s (the slowest gate; chains 16 `tsc` invocations).
- §4.4 merge suite: 16s; §4.11 validation: 12s; §4.10 probe: 10s; §4.6 tool
  suite: 9s.
- No gate felt near a timeout.

### 6.8 Surprising tool JSON vs expectations

- `dispose` returning `{"ok":true,"removed":true}` on a lane the instrument
  expected to be dirty (§5.11) — correct behavior for a clean lane; surprising
  only because the instrument assumed dirtiness.
- The `record.path` mixes separators
  (`C:\\Users\\spenc\\dev\\savant-code/.savant/worktrees/...`), as the
  instrument anticipated; comparisons were made on record fields, not raw paths.

---

## 7. §9 — Cleanup checklist (observed state)

- [x] No lane directories remain under `.savant/worktrees/` (only `.records/`,
  empty).
- [x] Branch `savant/FID-2026-1017-008` retained (by design) —
  `git branch --list` shows it; not deleted.
- [x] `.savant/fid-worktree.lock` absent.
- [x] No probe files landed (`az-out-of-scope-probe.txt` absent;
  `.savant/worktrees/AZ-NOT-A-LANE` absent).
- [ ] `git status --short` matches a clean state — **NOT clean**, due to the
  concurrent session's changes (BLOCKER-1). A stash entry exists:
  `stash@{0}: On main: parallel blueprint - restore with git stash pop (A-Z re-run prep)`.
- [x] Report written to `dev/scratchpad/az-parallel-worktrees-live-test-report.md`.
- [x] Start HEAD / merge commit SHA / end HEAD recorded: start `abe727a7`,
  **no merge commit** (merge not run), end `abe727a7`.

---

## 8. Overall call

**DEFECTS FOUND.**

`BLOCKER-1` — a concurrent operator session mutated the shared main checkout
mid-run (new FIDs `FID-2026-1018-002`/`FID-2026-1018-003`, `SCOPE.md` register
additions, CLI render changes), invalidating §5.13/§5.19 and making
§5.9a/§5.10 unobservable.

Additional instrument defects (not lane-system defects): §5.9a/§5.10
unfalsifiable because the lane-proof file is already tracked on `main`; §5.11
expecting a dirty refusal from a clean lane.

**What the run did prove:** the §4 gate surface (53 tests + 2 root gates, all
green); `fid_worktree` tool exposure is Orchestrator-only;
`list`/`create`/`not-converged`/`fid-in-use`/schema-refusal all behave exactly
as specified; lane provisioning produced the recorded base/branch/index/links/
graph snapshot with an isolated environment (index 1, port 3100, compose
`savant_wt1`); the Law 2 gate blocked both probe writes with the expected
wording; disposal removed the lane and retained the branch.

**What the run did NOT prove:** the lane commit, the fast-forward merge, the
merge-time graph refresh, the diverged re-merge refusal, the dirty-disposal
refusal, the explicit-discard disposal, and the busy-lock refusal.

No release, publish or benchmark claim is made.

---

*Findings requiring code or instrument changes become a separate implementation
FID authored by the closure session — none was opened by this run (per the
instrument's closing note).*