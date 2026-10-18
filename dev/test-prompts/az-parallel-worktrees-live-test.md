<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z Parallel-Worktrees Harness Live Test — execute inside the running CLI

**Version:** run-4 instrument with post-run corrections (FID-2026-1018-005).
**Historical vehicle:** run 4 completed. After FID-2026-1017-008 is archived,
this prompt MUST NOT run unchanged. A future run needs separate authorization,
a new active converged FID and matching scope grant, with every vehicle id/path
below updated before execution. Existing branch and prep stash remain preserved.
**Date:** 2026-10-18 (record the actual run date; adjust wording if executed later).
**Target:** the FID-bound parallel worktree system (FID-2026-1017-007, archived)
in this repository, demonstrated by run 4 under FID-2026-1017-008. The delta under test
is the whole lane lifecycle: `fid_worktree` tool + operator CLI, lane
provisioning (linked checkout, dependency junctions, graph snapshot, isolated
environment), the Law 2 lane jurisdiction mapping, refusal paths, the
fast-forward-only merge with main-graph refresh, and disposal (including the
explicit-discard path).
**Execution model:** THIS PROMPT RUNS INSIDE THE HARNESS. The agent currently
executing it IS the harness (`bun dev`, interactive CLI), with the operator at
the keyboard driving the session. Every test must be performed with the
harness's own tools from the live session. Do NOT use tmux, do NOT build a
binary, do NOT create an isolated repository copy, and do NOT leave the session
for any phase. Rows marked OPERATOR (and every ⌘-marked mutation) need the
operator's hands or an operator shell; everything else the agent executes
itself.
**Inference note:** paid inference for this acceptance run was explicitly
authorized by the operator (provider `kiosapi`, model `step-5-preview` at
authorization time). Record the session's actual provider/model in the report.

**Purpose:** prove the parallel-worktree update works end-to-end in the real
repository, with a concrete trigger path per row so no row degrades to
`NEEDS-REVIEW` when a path exists, and produce a short report per §8 whose
evidence becomes FID-2026-1017-008's acceptance record.

---

## 1. Execution contract

1. Read this whole prompt first. Create a todo list with one item per phase
   (§3–§7) and work in order.
2. Verdict vocabulary per row: `PASS` / `FAIL` / `OPERATOR-CONFIRMED` /
   `SKIP` / `NEEDS-REVIEW`. Record evidence for every row: the exact tool call
   or command and its essential output (trim boilerplate, never trim away the
   verdict-bearing lines). Record the wall-clock duration of every §4 gate row.
3. **Mutation policy — the ONLY things you may write or change in this run:**
   - the `fid_worktree` lifecycle actions for FID-2026-1017-008 (§5), each
     after operator confirmation;
   - the single lane-proof file inside the lane (§5.9a);
   - a covered modification of that same lane proof (§5.17a), discarded only
     after confirmation;
   - the single lane commit (§5.12) and the merge to main (§5.13), each after
     operator confirmation;
   - the two probe write ATTEMPTS in §5.9b/§5.9c — these are expected to be
     BLOCKED; if one somehow lands, follow the cleanup instruction in its row;
   - the report file in `dev/scratchpad/active/` (§8) and nothing else.
   Do NOT modify source files, do NOT commit on main yourself, do NOT push or
   tag, do NOT close FID-2026-1017-008, do NOT edit `CHANGELOG.md` or
   `SCOPE.md`, do NOT create new FIDs.
4. Before each ⌘-marked action (create, commit, merge, either dispose, and the
   §6.1 lock step): state the exact action and ask the operator to confirm
   (`ask_user`). Record the confirmation.
5. If a terminal command is refused by a hook or gate (e.g. the
   mutating-terminal guard), record the refusal verbatim and use the row's
   operator fallback: the operator runs the exact command in a separate
   terminal and the agent records the output. Do not retry around a refusal
   with a different command shape.
6. Never print credentials. The §5.8b environment row prints only the named
   keys plus a COUNT of `KEY|TOKEN|SECRET`-shaped variables; nothing else.
7. If a precondition (§2) fails, STOP before any mutation, report the failing
   check, and ask the operator. Do not improvise.
8. Harness steering the run raises (Law 15 verification nudges, receipts,
   advisories) is part of the observed behavior: record it, comply when the
   harness demands a verification step, continue.
9. In the report, do not introduce `Task NN` / `TNN-X` references; reference
   FIDs by id only.
10. **Exclusive main checkout:** before starting, the operator confirms no other
    session will edit, stage, commit, switch refs, restore a stash or refresh
    generated tracked files in this checkout until §9 finishes. Other sessions
    must pause mutations here or use another checkout. Repeat main status/HEAD
    checks before every lifecycle mutation. Before the merge, main HEAD must
    still equal start HEAD; afterwards it must equal the recorded merge SHA.
    Any unexpected change means STOP before the next mutation and preserve the
    lane for inspection. Do not commit or stash another session's changes.

### Pre-run preparation — separate from the measured run

Keep `savant/FID-2026-1017-008` and the named prep stash. Do not delete the
branch or force-reset it. Provisioning records the current main base and refuses
an old retained branch behind it (`branch-exists`). If preflight finds that
case, stop and ask the operator to prepare it before restarting §2. When the
branch tip is provably an ancestor of main, the operator may explicitly approve
this normal fast-forward in their shell:

```text
git merge-base --is-ancestor refs/heads/savant/FID-2026-1017-008 refs/heads/main
git fetch . refs/heads/main:refs/heads/savant/FID-2026-1017-008
git rev-parse refs/heads/main refs/heads/savant/FID-2026-1017-008
```

Run the fetch only if the ancestry command exits 0; the final SHAs must match.
There is no force flag and no branch deletion. A divergent branch requires an
operator ruling, not an improvised repair. This preparation happens before
start HEAD is captured. Do not apply/pop the prep stash during the run; record
its SHA and restore only after the operator explicitly chooses to do so.

## 2. Preconditions (verify first; any failure = STOP and report)

- `git branch --show-current` prints `main`.
- Record the operator's confirmation of exclusive main-checkout access (§1.10).
- Locate the existing prep stash by description
  `parallel blueprint - restore with git stash pop (A-Z re-run prep)` and record
  its SHA. Preserve it. If absent, record that fact and ask the operator before
  any proposed restoration; do not manufacture a replacement or pop another stash.
- Record the baseline `git status --short`. It MUST be empty. The merge gate
  runs `git status --porcelain --untracked-files=normal` on BOTH checkouts, so
  any entry — tracked or untracked — makes §5.13 impossible. Stash or commit
  approved work before starting, outside the measured run. Preserve the existing
  prep stash; do not restore the blueprint until after the final clean check.
- Record `git rev-parse HEAD` (this is the "start HEAD" for the whole run and
  the expected lane `baseSha`).
- If `refs/heads/savant/FID-2026-1017-008` exists, its SHA MUST equal start HEAD.
  If not, STOP before create and use the separately confirmed preparation above.
- Generate and record one **run stamp** using
  `bun -e "console.log(Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8))"`.
  Derive **proof-relative-path** as
  `docs/design/parallel-worktrees-lane-proof-<run-stamp>.md` and **report-path** as
  `dev/scratchpad/active/FID-2026-1017-008-<run-stamp>-live-test-report.md`.
  Substitute these exact recorded strings throughout this run; do not regenerate
  the stamp. Verify the proof is absent on disk and
  `git ls-files --error-unmatch -- <proof-relative-path>` is nonzero. If either
  exists, STOP and allocate a fresh stamp before restarting preflight. Verify
  the committed SCOPE.md grant for FID-2026-1017-008 includes
  `docs/design/parallel-worktrees-lane-proof-*.md`.
- `dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md` exists,
  contains a line `**Status:** converged`, and is TRACKED:
  `git ls-files --error-unmatch dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md`
  exits 0 and `git log --oneline -1 -- <that path>` returns a commit. `/dev` is
  gitignored, so a path-scoped `git add` silently skips the record: it must be
  force-added (`git add -f`) in a commit before the run.
- `git worktree list` shows exactly one entry (this checkout, on `main`).
- `.savant/worktrees` contains no lane directories (it may be absent; a
  `.records` directory may exist).
- `.savant/fid-worktree.lock` does not exist.
- `git check-ignore -q .savant/worktrees/` exits 0 (the managed root is
  ignored).
- `bun --version` recorded.
- The `fid_worktree` tool is present in your tool set (it will be exercised in
  §5). Record the tool's advertised parameters: its provider-facing schema must
  be an object naming `action`, `fid_id` and `discard_changes`. The tool is
  exposed only on the effectful Orchestrator variants (`agents/savant/savant.ts`
  gates it on `!analyzeOnly && !planOnly`), so a PLAN or ANALYZE session can
  never satisfy this row — stop before §5 if the schema is missing or empty.

## 3. Phase 0 — exposure and identity

| #    | Test                                    | Type   | Expected / trigger path                                                                                                                                                                         |
| ---- | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | Tool exposure is Orchestrator-only      | STATIC | `git grep -n "fid_worktree" -- agents` shows it in `agents/savant/savant.ts` (the Orchestrator tool list) and `agents/types/*`; NO other agent role file lists it. Record the matches.            |
| 0.2  | Repository identity                     | LIVE   | Record: `bun --version`, start HEAD, `git status --short`, and the provider/model the session reports (if visible), else "operator session".                                                     |

## 4. Phase 1 — automated gate matrix (re-run of the declared surface)

Run each row exactly as given; record duration and the final summary lines.
`bun test` path arguments are SUBSTRING filters — always run suites from the
workspace directory shown (never from the repo root).

| #    | Gate                                                                                | Command (from shown cwd)                                                                                                | Expected                          |
| ---- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 4.1  | Full root typecheck (chains all workspaces + scripts)                               | repo root: `bun run typecheck`                                                                                          | exit 0                            |
| 4.2  | Lane provisioning suite                                                             | `packages/agent-runtime`: `bun test src/__tests__/fid-worktree-provision.test.ts`                                       | all pass                          |
| 4.3  | Lane disposal suite                                                                 | `packages/agent-runtime`: `bun test src/__tests__/fid-worktree-dispose.test.ts`                                         | all pass                          |
| 4.4  | Merge gate suite                                                                    | `packages/agent-runtime`: `bun test src/__tests__/fid-worktree-merge.test.ts`                                           | all pass                          |
| 4.5  | Lane environment suite                                                              | `packages/agent-runtime`: `bun test src/__tests__/fid-worktree-environment.test.ts`                                     | all pass                          |
| 4.6  | Tool surface suite                                                                  | `packages/agent-runtime`: `bun test src/__tests__/fid-worktree-tool.test.ts`                                            | all pass                          |
| 4.7  | Law 2 lane-jurisdiction suite                                                       | `packages/agent-runtime`: `bun test src/echo/__tests__/law2-worktree-jurisdiction.test.ts`                              | all pass                          |
| 4.8  | Tool parameter schema suite                                                         | `common`: `bun test src/tools/__tests__/fid-worktree-params.test.ts`                                                    | all pass                          |
| 4.9  | SDK ripgrep regression pin                                                          | `sdk`: `bun test src/__tests__/ripgrep.test.ts`                                                                         | all pass                          |
| 4.10 | Real-git/SQLite lane probe                                                          | repo root: `bun scripts/probes/fid-worktrees.ts`                                                                        | exit 0; PASS summary line         |
| 4.11 | Repository validation (register, FID headings, scope coverage)                      | repo root: `bun run validate:repository`                                                                                | validation: PASS                  |

## 5. Phase 2 — live lane lifecycle (the core; ⌘ = operator-confirmed mutation)

All `fid_worktree` calls are JSON arguments to the harness tool, e.g.
`{ "action": "list" }` → `{ "action": "create", "fid_id": "FID-2026-1017-008" }`
→ `{ "action": "merge", "fid_id": "FID-2026-1017-008" }` →
`{ "action": "dispose", "fid_id": "FID-2026-1017-008" }` (and the
`discard_changes: true` variant in §5.17). Record every result JSON verbatim.

| #     | Test                                              | Type       | Expected / trigger path                                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1   | `list` on the clean slate                         | LIVE       | OK result with an empty lane list (`lanes: []`), no error. Record the JSON.                                                                                                                                                                                                                                             |
| 5.2   | Invalid FID id refusal                            | LIVE       | `create` with `fid_id: "FID-9999"` → the harness tool schema refuses BEFORE dispatch: `the arguments failed the tool schema at: fid_id — invalid_format`. That schema refusal is the expected first boundary; the service's `invalid-input` string is covered by the unit suite and is not reachable through the live tool. No side effects.                                                                                                                                                                                                             |
| 5.3   | Not-converged refusal                             | LIVE       | `create` with `fid_id: "FID-2026-1017-999"` (well-formed, absent) → refusal `not-converged` ("Create requires exactly one active converged FID"). Verify no branch `savant/FID-2026-1017-999` and no lane directory were created.                                                                                        |
| ⌘ 5.4 | Create the lane for FID-2026-1017-008             | LIVE       | OK result with a `record`: `fidId` = FID-2026-1017-008; `relativePath` = `.savant/worktrees/FID-2026-1017-008`; `branch` = `savant/FID-2026-1017-008`; `baseSha` == start HEAD (§2); `worktreeIndex` = 1; `dependencyLinks` = record actual list; `createdAt` an ISO timestamp. Record the full record JSON. The `path` may mix separators (`...\savant-code/.savant/worktrees/...`); compare the record fields, never raw path strings.        |
| 5.5a  | Lane exists on disk + record file                 | EXECUTABLE | `<repo-root>\.savant\worktrees\FID-2026-1017-008` exists; print `.savant/worktrees/.records/FID-2026-1017-008.json` and check it matches the tool's `record` fields.                                                                                                                                                    |
| 5.5b  | Git registration + branch                         | EXECUTABLE | `git worktree list --porcelain` includes main AND the lane path; `git -C .savant/worktrees/FID-2026-1017-008 rev-parse --abbrev-ref HEAD` = `savant/FID-2026-1017-008`.                                                                                                                                                 |
| 5.5c  | Dependency directory links                        | EXECUTABLE | For each entry in `dependencyLinks`, confirm the lane copy is a directory link to the corresponding main-checkout directory. Windows: record `Get-Item "<lane>\<entry>" \| Format-List LinkType,Target`; Junction or directory SymbolicLink is valid when its resolved target is correct. Record actual link type and full link list. |
| 5.5d  | Graph snapshot in the lane                        | EXECUTABLE | Main `.savant/graph.db` exists, so the lane snapshot is expected: `<lane>\.savant\graph.db` exists (record size). If absent, record and classify in §7.                                                                                                                                                                  |
| 5.5e  | Main checkout stays clean around provisioning     | EXECUTABLE | `git status --short` matches the §2 baseline (the lane is invisible to main status).                                                                                                                                                                                                                                    |
| 5.6   | Duplicate create refusal                          | LIVE       | `create` again for FID-2026-1017-008 → refusal `fid-in-use` ("FID-2026-1017-008 already has a managed FID worktree"), raised by `provisionFidWorktree` rather than by the service's own reason list. Nothing mutated.                                                                                                       |
| 5.7   | `list` with a live lane                           | LIVE       | One lane row: `registered` = true, `dirty` = false; record JSON.                                                                                                                                                                                                                                                        |
| 5.8a  | CLI mirror parity                                 | EXECUTABLE | repo root: `bun scripts/worktree.ts list` → exit 0; JSON matches the §5.7 tool result (same record fields, registered/dirty). Record both.                                                                                                                                                                              |
| 5.8b  | `exec` environment isolation                      | EXECUTABLE | repo root: `bun scripts/worktree.ts exec --fid FID-2026-1017-008 -- bun -e "console.log(JSON.stringify({root:process.env.SAVANT_WORKTREE_ROOT,index:process.env.WORKTREE_INDEX,port:process.env.PORT,compose:process.env.COMPOSE_PROJECT_NAME,graph:process.env.SAVANT_CODE_GRAPH_DB_PATH,secretVars:Object.keys(process.env).filter(k=>new RegExp('KEY\|TOKEN\|SECRET','i').test(k)).length}))"` — expect: `root` = absolute lane path; `index` = `1`; `port` = `3100` (stride: parent PORT or 3000, plus 100×index — record the actual); `compose` = `savant_wt1`; `graph` = `<lane>\.savant\graph.db`; `secretVars` = `0`. The RegExp constructor avoids Git Bash converting a slash-delimited regex into a Windows path. Record the exact command that ran. |
| 5.8c  | `exec` exit-code propagation                      | EXECUTABLE | `bun scripts/worktree.ts exec --fid FID-2026-1017-008 -- bun -e "process.exit(7)"` → the command's exit code is 7. Record the reported exit code.                                                                                                                                                                       |
| 5.9a  | Covered lane write (register leg)                 | LIVE       | Confirm `<record.path>/<proof-relative-path>` is absent and untracked in the lane. Use `write_file` at that absolute path with the wrapped template below, substituting actual recorded values. Keep every prose line at most 100 columns AFTER substitution (MD013 enforces 120). EXPECTED: write succeeds via the lane's FID-2026-1017-008 grant. If blocked, record the refusal, mark FAIL and STOP before any disposal. Verify the exact content and new file exist. |
| 5.9b  | Uncovered main write is blocked                   | LIVE       | `write_file` path `az-out-of-scope-probe.txt` (repo root, relative) with any short content. EXPECTED: BLOCKED by the Law 2 write-scope gate; record the refusal verbatim (expected wording: no approved scope item covers the target). Verify the file was NOT created. If it lands: FAIL — note it, delete it immediately, re-run `git status --short` to prove restoration (if the delete is itself gated, ask the operator to remove it), and classify in §7. |
| 5.9c  | Unregistered lane-shaped path is blocked          | LIVE       | `write_file` path `.savant/worktrees/AZ-NOT-A-LANE/probe.txt`. EXPECTED: BLOCKED because the target is not inside a registered FID worktree (refusal wording: target is not inside a registered FID worktree with its own SCOPE.md). Nothing created. Record verbatim.                                                      |
| 5.10  | Observe the genuine uncommitted proof              | EXECUTABLE | `git -C <record.path> status --porcelain --untracked-files=normal -- <proof-relative-path>` must show exactly `?? <proof-relative-path>`; `fid_worktree list` must report this lane `dirty: true`. Paste both observations. If either is missing, mark FAIL and STOP before §5.11; a clean lane must never be disposed as a refusal test. |
| ⌘ 5.11 | Dirty disposal is refused                          | LIVE       | Recheck the §5.10 dirty status immediately before calling `dispose` (no flag). With that observed precondition, expect refusal `dirty` ("Commit lane changes or explicitly authorize discard_changes"). Verify lane and proof survive. If not dirty, STOP without calling dispose; if disposal succeeds despite proven dirty state, FAIL and STOP the lifecycle. |
| ⌘ 5.12 | Validate and commit only this run's proof in the lane | EXECUTABLE | From the LANE cwd, first run `bun x markdownlint <proof-relative-path>`; require exit 0. On failure, mark the failed attempt and repair only this covered proof, then repeat the check before staging. Main must remain clean. Then `git -C <record.path> add -- <proof-relative-path>` and `git -C <record.path> commit -m "docs(echo): record lane acceptance proof (FID-2026-1017-008)"`. Record lane SHA, verify `git -C <record.path> diff-tree --no-commit-id --name-only -r HEAD` names only this proof, and confirm lane status is empty. If refused, use the operator fallback. |
| ⌘ 5.13 | Merge with immediate state/ref checkpoint          | LIVE       | AFTER operator confirmation and immediately before `merge`, record `git status --porcelain --untracked-files=normal` on main and `git -C <record.path> status --porcelain --untracked-files=normal`; BOTH must be empty. Main `rev-parse HEAD` must equal start HEAD, lane HEAD must equal §5.12 SHA, and operator confirms exclusivity still holds. If any check fails, STOP without merge and preserve the lane. Otherwise call `merge`: expect OK, `head` = lane SHA, `warnings: []`; record any warning verbatim for §7. |
| 5.14  | Merge verification                                 | EXECUTABLE | Main HEAD equals §5.13 head; `git log --oneline -1`; exact `<proof-relative-path>` exists on main with this run stamp/start HEAD. Main and lane status remain clean; lane still exists. |
| 5.15  | Main graph contains this run's exact proof          | EXECUTABLE | repo root: `bun -e "import {Database} from 'bun:sqlite';const d=new Database('.savant/graph.db',{readonly:true});const rows=d.query('SELECT path FROM files').all();console.log(JSON.stringify(rows.filter(r=>String(r.path).split(String.fromCharCode(92)).join('/')===process.argv[1])))" <proof-relative-path>` — expect exactly one row equal to this run's recorded proof path. Old proofs do not count. If empty and §5.13 carried no warning: wait 5 s, retry once; if still empty, FAIL. Record the exact command and result. |
| 5.15a | Post-merge document gate                           | EXECUTABLE | From repo root, run `bun run lint:md` → exit 0. If it fails, mark FAIL and STOP before §5.16, preserve the lane and request an explicit operator repair/revert decision. The mutation contract does not authorize an automatic second commit on main. Keep the failing output even after repair. Markdown is excluded by `.prettierignore`, so Prettier is not evidence of proof formatting. |
| 5.16a | Re-create refusal after merge                      | LIVE       | `create` again → `fid-in-use` (lane still managed). Record.                                                                                                                                                                                                                                                             |
| 5.16b | Re-merge refusal (diverged)                        | LIVE       | `merge` again → refusal `diverged`: detail names `main HEAD <sha> differs from recorded base <baseSha>`. Record verbatim.                                                                                                                                                                                               |
| 5.17a | Modify and observe the covered tracked proof       | LIVE       | Read the lane proof 0-EOF, then use `write_file` on its absolute path to preserve its contents and append a blank line plus `Disposal probe: <run-stamp>.` This uses the existing grant; never plant an uncovered stray. Verify lane porcelain reports ` M <proof-relative-path>` and `fid_worktree list` reports `dirty: true`. Main proof must remain unchanged and main status clean. Otherwise STOP before disposal. |
| ⌘ 5.17b | Dirty disposal refused again                       | LIVE       | Immediately recheck the tracked proof modification and `dirty: true`, then `dispose` → `dirty` refusal. Confirm lane and modified proof survive. If not dirty, STOP without dispose. |
| ⌘ 5.17c | Explicit-discard disposal                          | LIVE       | `dispose` with `{ "discard_changes": true }` → OK, `removed` = true. Record warnings verbatim: a `git worktree remove … Directory not empty` warning is the bounded filesystem fallback recovering, not a failed dispose — PASS when `removed` is true and §5.18 proves the directory is gone. The lane's uncommitted proof modification is discarded; main's committed proof is unchanged. |
| 5.18  | Post-disposal state                                | EXECUTABLE | Lane directory gone; `git worktree list` shows only main; `.records/FID-2026-1017-008.json` gone; branch `savant/FID-2026-1017-008` RETAINED (by design) — record `git branch --list savant/FID-2026-1017-008`; `.savant/fid-worktree.lock` absent; `list` → empty lanes.                                                       |
| 5.19  | Final checkout state                               | EXECUTABLE | `git status --short` must be empty before any blueprint restoration. Record end HEAD; exactly one new lane-proof commit must descend from start HEAD, containing only this run's proof-relative-path. Any unrelated change means FAIL and an interference report, never automatic staging or stashing. |

### Shell note for the environment probe (§5.8b)

For §5.8b in **Git Bash**, prefix the command with `MSYS_NO_PATHCONV=1`.
Run 4 still needed that prefix with the RegExp constructor; removing slash
delimiters alone did not prevent MSYS conversion. In **PowerShell**, use the
command without that shell-specific prefix. Record the actual shell and command.

### Wrapped proof template (§5.9a)

Substitute the recorded values and keep the explicit line breaks. Wrap again
if any substituted line exceeds 100 columns.

```markdown
# Lane proof — FID-2026-1017-008 — <run-stamp>

Run stamp: <run-stamp>.
Start HEAD: <start-HEAD>.
This file was created inside the managed FID worktree for this acceptance run.
Commit and merge outcomes are recorded separately in the run report.
```

## 6. Phase 3 — recovery surfaces and residuals

| #   | Test                               | Type     | Expected / trigger path                                                                                                                                                                                                                                    |
| --- | ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Busy-lock refusal (OPERATOR step)  | OPERATOR | Follow the named-shell procedure below, from the verified repository root. Record synthetic lock creation, `create` → `busy` with the named lock recovery, and removal of only this run's confirmed synthetic empty lock. If the operator declines this row, mark `SKIP` ("operator-declined") and continue. |

### Named-shell synthetic lock procedure (§6.1)

The operator confirms no lifecycle writer is running. Verify current directory
equals `git rev-parse --show-toplevel` and the repo-relative lock is absent.
If it exists, STOP: an empty lock can belong to a live writer. Never reuse it.
Use ONLY the commands for the current shell, all from the repository root:

**PowerShell:**

```powershell
Get-Location
git rev-parse --show-toplevel
Test-Path -LiteralPath .savant/fid-worktree.lock
New-Item -ItemType Directory -Path .savant/fid-worktree.lock
Get-Item -LiteralPath .savant/fid-worktree.lock | Select-Object FullName
Get-ChildItem -Force -LiteralPath .savant/fid-worktree.lock
```

**Git Bash:**

```bash
pwd
git rev-parse --show-toplevel
test -e .savant/fid-worktree.lock
mkdir .savant/fid-worktree.lock
ls -ld .savant/fid-worktree.lock
ls -la .savant/fid-worktree.lock
```

Run one command at a time; require absence (`False` / exit 1) before creation,
and require creation success. Do not use `-Force` or `mkdir -p`. Confirm the
resolved path is under this repository before calling the live tool.
MSYS `/c/...` paths are Git Bash syntax; never paste them into PowerShell.

After capturing the busy refusal, verify no writer started and the synthetic
directory is still empty. Remove ONLY the lock this run created, nonrecursively:
PowerShell `[System.IO.Directory]::Delete((Join-Path (Get-Location).Path '.savant/fid-worktree.lock'))`;
Git Bash `rmdir .savant/fid-worktree.lock`. Both refuse a nonempty directory.
Verify absence afterward. Unexpected contents or ownership means STOP and ask
the operator; never recursively remove a lock.

## 7. Agent View (mandatory)

After the last phase, write a findings section with each item classified
`BLOCKER` / `NICE-TO-HAVE` / `WATCH`, tagged with its evidence row:

1. Every divergence between an expected value in this prompt and the observed
   value (quote both).
2. Every refusal/failure string encountered, verbatim.
3. Every hook/gate refusal of a terminal command (the mutating-terminal guard,
   Law 1/2/3 interceptions), with the exact command and message.
4. Rows that ran but were inconclusive, and why.
5. Paths deliberately NOT covered and why: the child-role-forbidden leg of
   `fid_worktree` (only a spawn attempt could prove it), the active-lane cap,
   a merge CONFLICT path (no conflict was constructed), a
   branch-diverged-from-base create refusal, and re-create-after-dispose
   branch reuse.
6. Timing observations (which rows were slow; any gate that felt near a
   timeout).
7. Anything surprising in the tool JSON versus this prompt's expectations.

"None observed" is acceptable ONLY for categories with no evidence at all.

## 8. Report contract

Write the report to the exact **report-path** recorded in §2, under
`dev/scratchpad/active/` (untracked scratch; the closure session promotes it).
Keep the scratch root free of report files. Structure:

1. Header: title; run date; provider/model actually used; start HEAD; end
   HEAD; `bun --version`; baseline `git status --short`; run stamp, exact proof
   and report paths, prep stash SHA, and exclusivity confirmation.
2. Verdict summary table derived from unique row ids in the actual row tables;
   the counts must sum to the number of measured rows. Record operator
   confirmations separately from verdicts, without double-counting. List every
   FAIL by row number, including a repaired failure with its repair evidence;
   do not overwrite the failing attempt or label an unmet constraint PASS.
3. One section per phase (§3–§6) containing a row table: `Row | Verdict |
   Evidence` — commands exact, outputs trimmed to the verdict-bearing lines,
   durations for §4 rows.
4. Agent View (§7).
5. Cleanup checklist (§9) with observed state per line.
6. Final line: overall call — `WORKS AS DESIGNED` or `DEFECTS FOUND` plus any
   `BLOCKER` list. No release, publish or benchmark claims.

## 9. Cleanup checklist

- [ ] Lane disposed (§5.17c); no lane directories remain under `.savant/worktrees/`.
- [ ] Branch `savant/FID-2026-1017-008` retained (by design) — note it; do not delete.
- [ ] `.savant/fid-worktree.lock` absent.
- [ ] No probe files landed (`az-out-of-scope-probe.txt` absent; nothing under `.savant/worktrees/AZ-NOT-A-LANE`).
- [ ] `git status --short` matches §5.19 (clean). Keep the prep stash; restore only after a separate explicit operator choice, after recording this clean endpoint.
- [ ] Report written to the §2 report-path under `dev/scratchpad/active/`.
- [ ] Start HEAD / merge commit SHA / end HEAD recorded in the report.

---

> This run validates FID-2026-1017-008's acceptance surface. Findings requiring
> code changes become a separate implementation FID authored by the closure
> session — do not open one yourself. End the run by telling the operator the
> report path and the overall call.
