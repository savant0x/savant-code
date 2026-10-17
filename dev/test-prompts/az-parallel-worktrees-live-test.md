<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z Parallel-Worktrees Harness Live Test — execute inside the running CLI

**Version:** acceptance run for FID-2026-1017-008.
**Date:** 2026-10-17 (record the actual run date; adjust wording if executed later).
**Target:** the FID-bound parallel worktree system (FID-2026-1017-007, archived)
in this repository, live-accepted under FID-2026-1017-008. The delta under test
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
   - the single lane commit (§5.12) and the merge to main (§5.13), each after
     operator confirmation;
   - the two probe write ATTEMPTS in §5.9b/§5.9c — these are expected to be
     BLOCKED; if one somehow lands, follow the cleanup instruction in its row;
   - the report file in `dev/scratchpad/` (§8) and nothing else.
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

## 2. Preconditions (verify first; any failure = STOP and report)

- `git branch --show-current` prints `main`.
- Record the baseline `git status --short`. Allowed at baseline: the untracked
  file `docs/design/Savant-Code Parallel Architecture Blueprint.md`. Anything
  else: note it and ask the operator before continuing.
- Record `git rev-parse HEAD` (this is the "start HEAD" for the whole run and
  the expected lane `baseSha`).
- `dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md` exists,
  contains a line `**Status:** converged`, and is committed:
  `git log --oneline -1 -- dev/fids/FID-2026-1017-008-live-parallel-worktree-acceptance.md`
  returns a commit.
- `git worktree list` shows exactly one entry (this checkout, on `main`).
- `.savant/worktrees` contains no lane directories (it may be absent; a
  `.records` directory may exist).
- `.savant/fid-worktree.lock` does not exist.
- `git check-ignore -q .savant/worktrees/` exits 0 (the managed root is
  ignored).
- `bun --version` recorded.
- The `fid_worktree` tool is present in your tool set (it will be exercised in
  §5).

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
| 5.2   | Invalid FID id refusal                            | LIVE       | `create` with `fid_id: "FID-9999"` → refusal `invalid-input` ("Invalid action or FID id"). No side effects.                                                                                                                                                                                                             |
| 5.3   | Not-converged refusal                             | LIVE       | `create` with `fid_id: "FID-2026-1017-999"` (well-formed, absent) → refusal `not-converged` ("Create requires exactly one active converged FID"). Verify no branch `savant/FID-2026-1017-999` and no lane directory were created.                                                                                        |
| ⌘ 5.4 | Create the lane for FID-2026-1017-008             | LIVE       | OK result with a `record`: `fidId` = FID-2026-1017-008; `relativePath` = `.savant/worktrees/FID-2026-1017-008`; `branch` = `savant/FID-2026-1017-008`; `baseSha` == start HEAD (§2); `worktreeIndex` = 1; `dependencyLinks` = record actual list; `createdAt` an ISO timestamp. Record the full record JSON.        |
| 5.5a  | Lane exists on disk + record file                 | EXECUTABLE | `<repo-root>\.savant\worktrees\FID-2026-1017-008` exists; print `.savant/worktrees/.records/FID-2026-1017-008.json` and check it matches the tool's `record` fields.                                                                                                                                                    |
| 5.5b  | Git registration + branch                         | EXECUTABLE | `git worktree list --porcelain` includes main AND the lane path; `git -C .savant/worktrees/FID-2026-1017-008 rev-parse --abbrev-ref HEAD` = `savant/FID-2026-1017-008`.                                                                                                                                                 |
| 5.5c  | Dependency links are junctions                    | EXECUTABLE | For each entry in `dependencyLinks`, confirm the lane copy is a directory link to the main checkout (Windows: `Get-Item "<lane>\<entry>" \| Format-List LinkType,Target` shows `Junction`; use the shell's equivalent on other platforms). Record the full link list.                                                   |
| 5.5d  | Graph snapshot in the lane                        | EXECUTABLE | Main `.savant/graph.db` exists, so the lane snapshot is expected: `<lane>\.savant\graph.db` exists (record size). If absent, record and classify in §7.                                                                                                                                                                  |
| 5.5e  | Main checkout stays clean around provisioning     | EXECUTABLE | `git status --short` matches the §2 baseline (the lane is invisible to main status).                                                                                                                                                                                                                                    |
| 5.6   | Duplicate create refusal                          | LIVE       | `create` again for FID-2026-1017-008 → refusal `fid-in-use` ("FID-2026-1017-008 already has a managed FID worktree"). Nothing mutated.                                                                                                                                                                                  |
| 5.7   | `list` with a live lane                           | LIVE       | One lane row: `registered` = true, `dirty` = false; record JSON.                                                                                                                                                                                                                                                        |
| 5.8a  | CLI mirror parity                                 | EXECUTABLE | repo root: `bun scripts/worktree.ts list` → exit 0; JSON matches the §5.7 tool result (same record fields, registered/dirty). Record both.                                                                                                                                                                              |
| 5.8b  | `exec` environment isolation                      | EXECUTABLE | repo root: `bun scripts/worktree.ts exec --fid FID-2026-1017-008 -- bun -e "console.log(JSON.stringify({root:process.env.SAVANT_WORKTREE_ROOT,index:process.env.WORKTREE_INDEX,port:process.env.PORT,compose:process.env.COMPOSE_PROJECT_NAME,graph:process.env.SAVANT_CODE_GRAPH_DB_PATH,secretVars:Object.keys(process.env).filter(k=>/KEY\|TOKEN\|SECRET/i.test(k)).length}))"` — expect: `root` = absolute lane path; `index` = `1`; `port` = `3100` (stride: parent PORT or 3000, plus 100×index — record the actual); `compose` = `savant_wt1`; `graph` = `<lane>\.savant\graph.db`; `secretVars` = `0`. Record the exact command that ran. |
| 5.8c  | `exec` exit-code propagation                      | EXECUTABLE | `bun scripts/worktree.ts exec --fid FID-2026-1017-008 -- bun -e "process.exit(7)"` → the command's exit code is 7. Record the reported exit code.                                                                                                                                                                       |
| 5.9a  | Covered lane write (register leg)                 | LIVE       | Write file `write_file` with path `<record.path>\docs\design\parallel-worktrees-lane-proof.md` (absolute) and EXACTLY this content: a heading `# Lane proof — FID-2026-1017-008`, then one paragraph: "This file was written inside the managed FID worktree `.savant/worktrees/FID-2026-1017-008` (branch `savant/FID-2026-1017-008`) during the A–Z live acceptance run of the FID-bound parallel worktree system, then committed in the lane and merged to main through the mechanism under test (fast-forward only). It is acceptance evidence for FID-2026-1017-008." EXPECTED: write succeeds — the lane's own register covers this repo-relative target via FID-2026-1017-008. If BLOCKED with a governance refusal: record it verbatim, mark FAIL, STOP the write rows, and ask the operator. Verify the file exists afterwards. |
| 5.9b  | Uncovered main write is blocked                   | LIVE       | `write_file` path `az-out-of-scope-probe.txt` (repo root, relative) with any short content. EXPECTED: BLOCKED by the Law 2 write-scope gate; record the refusal verbatim (expected wording: no approved scope item covers the target). Verify the file was NOT created. If it lands: FAIL — note it, delete it immediately, re-run `git status --short` to prove restoration (if the delete is itself gated, ask the operator to remove it), and classify in §7. |
| 5.9c  | Unregistered lane-shaped path is blocked          | LIVE       | `write_file` path `.savant/worktrees/AZ-NOT-A-LANE/probe.txt`. EXPECTED: BLOCKED because the target is not inside a registered FID worktree (refusal wording: target is not inside a registered FID worktree with its own SCOPE.md). Nothing created. Record verbatim.                                                      |
| 5.10  | Lane is dirty after the write                     | EXECUTABLE | `git -C .savant/worktrees/FID-2026-1017-008 status --porcelain` shows the new proof file as untracked (`?? docs/design/parallel-worktrees-lane-proof.md`).                                                                                                                                                              |
| ⌘ 5.11 | Dirty disposal is refused                          | LIVE       | `dispose` (no flag) → refusal `dirty` ("Commit lane changes or explicitly authorize discard_changes"). Lane survives.                                                                                                                                                                                                    |
| ⌘ 5.12 | Commit the lane proof inside the lane              | EXECUTABLE | `git -C .savant/worktrees/FID-2026-1017-008 add docs/design/parallel-worktrees-lane-proof.md` then `git -C .savant/worktrees/FID-2026-1017-008 commit -m "docs(echo): lane proof for parallel-worktree acceptance (FID-2026-1017-008)"`. Record the commit SHA (`git -C <lane> rev-parse HEAD`) and confirm the lane is clean (`status --porcelain` empty). If the terminal refuses these, use the operator fallback.                             |
| ⌘ 5.13 | Merge (fast-forward only)                          | LIVE       | `merge` for FID-2026-1017-008 → OK with `head` = the §5.12 lane SHA and `warnings: []`. If `warnings` is non-empty (e.g. graph refresh failure), record it verbatim and continue; classify in §7.                                                                                                                         |
| 5.14  | Merge verification                                 | EXECUTABLE | Main `git rev-parse HEAD` == the `head` from §5.13 (fast-forward equality); `git log --oneline -1`; the proof file exists on main (`docs/design/parallel-worktrees-lane-proof.md`); main `git status --short` is clean; the lane is still clean and still exists.                                                        |
| 5.15  | Main graph refreshed with the merged file          | EXECUTABLE | repo root: `bun -e "import {Database} from 'bun:sqlite';const d=new Database('.savant/graph.db',{readonly:true});const rows=d.query('SELECT path FROM files').all();console.log(JSON.stringify(rows.filter(r=>String(r.path).includes('parallel-worktrees-lane-proof'))))"` — expect one row naming `docs/design/parallel-worktrees-lane-proof.md`. If empty and §5.13 carried no warning: wait 5 s, retry once; if still empty, mark FAIL and classify in §7. If the shell mangles quoting, adapt while keeping the query semantics and record the exact command used. |
| 5.16a | Re-create refusal after merge                      | LIVE       | `create` again → `fid-in-use` (lane still managed). Record.                                                                                                                                                                                                                                                             |
| 5.16b | Re-merge refusal (diverged)                        | LIVE       | `merge` again → refusal `diverged`: detail names `main HEAD <sha> differs from recorded base <baseSha>`. Record verbatim.                                                                                                                                                                                               |
| 5.17a | (OPERATOR) Plant a stray in the lane               | OPERATOR   | Operator, in their own shell: `Set-Content .savant\worktrees\FID-2026-1017-008\az-stray.tmp 'stray (operator-created for the discard-path test)'`. Agent confirms the file exists.                                                                                                                                      |
| ⌘ 5.17b | Dirty disposal refused again                       | LIVE       | `dispose` → `dirty` refusal. Record.                                                                                                                                                                                                                                                                                    |
| ⌘ 5.17c | Explicit-discard disposal                          | LIVE       | `dispose` with `{ "discard_changes": true }` → OK, `removed` = true; record warnings (expect none). The stray is discarded with the lane.                                                                                                                                                                               |
| 5.18  | Post-disposal state                                | EXECUTABLE | Lane directory gone; `git worktree list` shows only main; `.records/FID-2026-1017-008.json` gone; branch `savant/FID-2026-1017-008` RETAINED (by design) — record `git branch --list savant/FID-2026-1017-008`; `.savant/fid-worktree.lock` absent; `list` → empty lanes.                                                       |
| 5.19  | Final checkout state                               | EXECUTABLE | `git status --short` (expect clean; note the untracked blueprint); record end HEAD and state the by-design delta from start HEAD: exactly the lane-proof merge commit.                                                                                                                                                   |

## 6. Phase 3 — recovery surfaces and residuals

| #   | Test                               | Type     | Expected / trigger path                                                                                                                                                                                                                                    |
| --- | ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Busy-lock refusal (OPERATOR step)  | OPERATOR | Operator: `New-Item -ItemType Directory .savant\fid-worktree.lock` (empty directory), confirm with agent. Agent: attempt any lifecycle mutation, e.g. `create` → refusal `busy` whose detail names the `.savant/fid-worktree.lock` recovery. Operator: `Remove-Item .savant\fid-worktree.lock`. Record all three steps. If the operator declines this row, mark `SKIP` ("operator-declined") and continue. |

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

Write the report to `dev/scratchpad/az-parallel-worktrees-live-test-report.md`
(untracked scratch; the closure session promotes it). Structure:

1. Header: title; run date; provider/model actually used; start HEAD; end
   HEAD; `bun --version`; baseline `git status --short`.
2. Verdict summary table (counts per verdict; list any FAIL with its row
   number).
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
- [ ] `git status --short` matches §5.19; untracked blueprint still present.
- [ ] Report written to `dev/scratchpad/az-parallel-worktrees-live-test-report.md`.
- [ ] Start HEAD / merge commit SHA / end HEAD recorded in the report.

---

> This run validates FID-2026-1017-008's acceptance surface. Findings requiring
> code changes become a separate implementation FID authored by the closure
> session — do not open one yourself. End the run by telling the operator the
> report path and the overall call.
