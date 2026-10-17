# FID: FID-bound parallel worktrees — one linked checkout per FID lane

**Filename:** `FID-2026-1017-007-fid-bound-parallel-worktrees.md`
**ID:** FID-2026-1017-007
**Severity:** high
**Status:** closed
**Created:** 2026-10-17 15:10
**Archived:** 2026-10-17
**Automation level:** 3
**YAGNI-Compliance:** Verified — reuses git's own worktree primitive, the
recorded release-checkout lifecycle (`scripts/public-release/clean-checkout.ts`),
the existing Law 2 register/gate and the existing spawn fan-out; no new
dependency, daemon, database or service.

---

## Summary

ECHO has no filesystem isolation between FIDs. Every phase writes into the one
checkout, so two FIDs cannot be implemented concurrently without racing the git
index and reading each other's half-written trees, and Forge's output is visible
on `main` before Verifier has audited it. This FID gives each FID an ephemeral
linked git worktree under the already-gitignored `.savant/worktrees/`, provisions
it from the converged FID, links the hoisted Bun `node_modules` instead of
installing again, makes the Law 2 write gate resolve worktree-relative paths back
to their repo-relative targets, exposes provision/list/dispose/merge as a
host-owned tool, and disposes through `git worktree remove` plus a verified
absence check — never the `rm -rf` teardown the research blueprint proposes,
which is the exact ordering that produced the recorded orphaned-Temp-worktree
incident.

Terminology is fixed in this FID: **working tree** (Law 15, the checkout you are
in) and **FID worktree** (a linked checkout, `git worktree add`). No existing
`worktree-*` module is renamed; the new modules are `fid-worktree-*`.

## Environment

- **OS:** win32 (Git Bash), Git 2.52
- **Language/Runtime:** TypeScript strict, Bun 1.3.14, Bun workspaces (hoisted
  linker)
- **Tool Versions:** repository pin per `package.json` / `bun.lock`
- **Commit/State:** `main` @ `79782b57`; worktree clean except the operator's
  untracked blueprint

## Detailed Description

### Problem

1. **One working tree, one index.** All native writes, both agents' edits and
   every `git` call share `.git/index.lock`. Two concurrent FIDs in one checkout
   either block or corrupt each other's index; a Scout reading mid-refactor
   ingests broken imports.
2. **Pre-audit exposure.** Forge writes straight into the checkout that ships.
   Until Verifier and Adversary pass, unreviewed code sits on `main`, and a
   rejected implementation must be unwound by hand.
3. **No provisioning exists.** The only `git worktree` calls in the tree belong
   to the release pipeline's clean checkout, and that module's header records why
   naive teardown is dangerous: a failed gate run left an orphaned Temp
   worktree that git reported as removed while the directory survived, and no
   git command can clear an unregistered orphan
   (`scripts/public-release/clean-checkout.ts:1-19`).
4. **The Law 2 gate has no worktree concept.** Jurisdiction is
   `process.cwd()`: a target outside it is skipped, and a target inside it is
   matched as a repo-relative path. A worktree at `.savant/worktrees/<fid>/`
   is therefore matched as `.savant/worktrees/<fid>/cli/src/x.ts`, which no
   register item covers — every write inside a worktree is blocked as
   out-of-scope (`packages/agent-runtime/src/echo/pre-write-gates-law2.ts:85-105,117-160`).
5. **The name already means something else.** Law 15's `worktree-*` modules are
   working-tree baseline and reconciliation
   (`packages/agent-runtime/src/echo/enforcement/worktree-git.ts:1-13`). A new
   subsystem that reuses the word without a qualifier will be misread.
6. **The blueprint's teardown and provenance claims are wrong for this repo.**
   It recommends bypassing `git worktree remove` with `rm -rf` + `prune` (the
   incident ordering), and it assumes provenance receipts bind a commit SHA and
   are invalidated by rebase. They bind content: `changeHash` is the sha256 of
   the post-write file, and `path` is project-relative
   (`common/src/types/provenance.ts:51-68`). A merge does not invalidate them.

### Expected Behavior

- `fid_worktree create --fid <id>` provisions
  `<repoRoot>/.savant/worktrees/<fidId>` on branch `savant/<fidId>` from the
  current `HEAD`, self-heals debris from an earlier crashed run, refuses when
  the FID already has a worktree, when the branch has diverged from the base, or
  when the active cap is reached, and returns the absolute path plus a marker
  record. `node_modules` is linked, never installed.
- Writes inside a managed FID worktree pass the Law 2 gate as their
  repo-relative targets (`cli/src/x.ts`), not as
  `.savant/worktrees/<fid>/cli/src/x.ts`; the register read is the worktree's
  own `SCOPE.md` so a lane cannot borrow another lane's authority.
- `fid_worktree list` reports every managed worktree with FID, branch, base SHA,
  created-at and dirty state.
- `fid_worktree merge` performs an in-memory `git merge-tree --write-tree`
  dry run, then fast-forward only when `main`'s HEAD still equals the recorded
  base; otherwise it refuses with the divergence named and leaves the worktree
  intact. Conflicts refuse; nothing is auto-resolved.
- `fid_worktree dispose` issues `git worktree remove --force`, verifies the
  directory is gone, falls back to bounded filesystem removal for surviving
  files or unregistered debris under the derived managed root, then
  `git worktree prune`; every failure is a structured warning, never a throw
  that hides the removal state.
- A worktree never appears in `git status` of the main checkout: the managed
  root is already ignored (`.gitignore:107`).
- The tool is Orchestrator-only; Forge/Verifier/Adversary/Scout cannot create,
  merge or dispose a lane.

### Root Cause

ECHO's write boundary is logical (phase, agent, FID) and its isolation is
filesystem-free. Every guarantee that depends on "nothing else is writing this
tree" is therefore an assumption, not an invariant: Law 15 reconciliation can
tell you the working tree changed, but not who changed it, and it cannot keep two
FIDs apart. The runtime already has the git enumeration seam, the register
parser, the release checkout lifecycle and a fan-out dispatcher; what is missing
is the composition that maps one FID to one checkout and one write jurisdiction.

### Evidence

```text
.gitignore:107                       .savant/                     (managed root already ignored)
common/src/types/provenance.ts:51-68 TrustReceipt { changeHash, path, fidId, … }  (content-bound)
packages/agent-runtime/src/echo/pre-write-gates-law2.ts:85-105
                                     toRepoRelative() → undefined outside cwd; no worktree mapping
packages/agent-runtime/src/echo/pre-write-gates-law2.ts:117-160
                                     runLaw2Gate(): fail-closed on unmatched repo-relative paths
packages/agent-runtime/src/echo/enforcement/worktree-git.ts:1-13
                                     Law 15 "worktree" = working tree (naming collision)
scripts/public-release/clean-checkout.ts:1-19
                                     v0.0.30 orphaned Temp worktree: git success, directory survived
common/src/constants/agents.ts:94    MAX_SUBAGENT_FAN_OUT = 32
agents/savant/savant.ts:139          Orchestrator toolNames list (spawn_agents, …)
common/src/tools/list.ts:106         spawn_agents params registry (tool surface precedent)
```

A whole-source search of `cli/src`, `packages`, `common/src`, `sdk/src`,
`desktop/src`, `scripts`, `agents` for `worktree add|remove|list` returns only
`scripts/public-release/clean-checkout.ts` and its tests: no agent-facing
worktree capability exists today.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/parallel/fid-worktree-git.ts` (new git argv seam)
- `packages/agent-runtime/src/echo/parallel/fid-worktree.ts` (new provision/dispose/list)
- `packages/agent-runtime/src/echo/parallel/fid-worktree-merge.ts` (new merge gate)
- `packages/agent-runtime/src/echo/pre-write-gates-law2.ts` (worktree jurisdiction)
- `common/src/tools/params/tool/fid-worktree.ts` (new tool schema)
- `packages/agent-runtime/src/tools/handlers/tool/fid-worktree.ts` (new handler)
- `common/src/tools/list.ts`, `agents/savant/savant.ts` (tool registration and allowlist)
- `scripts/worktree.ts` (operator CLI mirror for the same module)
- `scripts/probes/fid-worktrees.ts` (durable probe)

### Risk Level

- [ ] Critical
- [x] High — the write boundary and the provenance surface move; a bad dispose
  can delete a checkout, and a wrong jurisdiction mapping can widen Law 2.
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

One checkout per FID, created and destroyed by the host from a converged FID,
with the existing git seam and the recorded cleanup contract. Writes stay
governed by the existing register — the gate learns to map a managed worktree
path back to its repo-relative target and reads that worktree's own register.
Merging is fast-forward-only and refuses rather than resolving. Nothing about
the DAG scheduler, rate limiting or CST merging is required for isolation to be
real, and none of it is claimed here.

### Contracts

**Worktree seam** (`packages/agent-runtime/src/echo/parallel/fid-worktree-git.ts`):

```ts
export type GitResult = {
  status: number | null
  stdout: string
  stderr: string
}
export type GitRunner = (args: readonly string[], cwd: string) => GitResult
export function runGit(run: GitRunner, args: readonly string[], cwd: string): GitResult
```

**Lifecycle** (`.../fid-worktree.ts`):

```ts
export const FID_WORKTREE_ROOT = '.savant/worktrees'
export const FID_WORKTREE_RECORDS = '.savant/worktrees/.records'
export const DEFAULT_MAX_FID_WORKTREES = 4

export type FidWorktreeRecord = {
  fidId: string
  path: string           // absolute
  relativePath: string   // .savant/worktrees/<fidId>
  branch: string         // savant/<fidId>
  baseSha: string
  createdAt: string
  dependencyLinks: string[]
  worktreeIndex?: number // stable positive slot; never renumber live lanes
}

export type ProvisionOutcome =
  | { ok: true; record: FidWorktreeRecord; warnings: string[] }
  | { ok: false; reason: 'invalid-fid' | 'fid-in-use' | 'branch-exists' |
      'cap-exceeded' | 'git-failed'; detail: string }
```

`fidId` must match `/^FID-\d{4}-\d{4}-\d{3}$/`; the path is derived, never taken
from input, so a FID id cannot traverse out of the root. Provision order:
validate id → cap check (count managed records) → debris guard
(`git worktree remove --force` then verified absence, warnings only) →
`git worktree add -b savant/<fid> <path> <baseSha>` → link `node_modules`
(junction/symlink; skip when absent) → write the record. A failure after `add`
runs the dispose path before returning `ok: false`.

**Dispose**: `git worktree remove --force <path>` (capture status), verify
absence, bounded filesystem fallback with retries for `EBUSY`/`EPERM`, then
`git worktree prune`; delete the record; return `{ removed, warnings }`.

**Merge** (`.../fid-worktree-merge.ts`): `git merge-tree --write-tree <base>
<branch>`; exit 0 → `git merge --ff-only <branch>` only when
`git rev-parse HEAD` still equals `<base>`; otherwise `ok: false` with
`{ reason: 'diverged', head, base }` or `{ reason: 'conflict', detail }`. Never
rebases, never resolves.

**Law 2 jurisdiction** (`pre-write-gates-law2.ts`): before `toRepoRelative`,
map a canonical target under `<repoRoot>/.savant/worktrees/<fid>/` to its suffix
after that prefix; match against the register at the worktree root; unmapped
targets keep today's behavior. The managed roots come from the records
directory, so an arbitrary `.savant/worktrees/x` directory created by hand does
not gain jurisdiction.

### Steps

1. **Git seam + naming** — add `echo/parallel/fid-worktree-git.ts` (argv only,
   injected runner) and a header stating the working-tree vs FID-worktree rule;
   no existing module renamed. — implemented
2. **Provision** — the contract above: id validation, cap, debris self-heal,
   branch creation, dependency linking, record write, rollback on partial
   failure. — implemented
3. **Dispose + list** — the recorded release lifecycle applied per FID; list
   parses `git worktree list --porcelain` and joins records. — implemented
4. **Law 2 jurisdiction** — map managed worktree targets to repo-relative
   paths and read the worktree register; pin that a hand-made directory and an
   unlisted worktree gain nothing. — implemented
5. **Tool surface** — `fid_worktree` (create/list/dispose/merge) schema in
   `common`, handler in the runtime, registered in `common/src/tools/list.ts`
   and only the Orchestrator's `toolNames`; refusals are typed results, never
   thrown. — implemented
6. **Merge gate** — `merge-tree` dry run + fast-forward-only merge with the
   divergence and conflict refusals above. — implemented
7. **Environment isolation** — inject `SAVANT_WORKTREE_ROOT`,
   `WORKTREE_INDEX` (persisted lowest-free positive slot), `PORT`/`DATABASE_URL`/`COMPOSE_PROJECT_NAME`
   offsets, and copy `.savant/graph.db` into the worktree when present; re-index
   the golden graph only after a successful merge. — implemented
8. **Operator CLI + probe + docs** — `scripts/worktree.ts` mirrors the tool for
   terminal use; `scripts/probes/fid-worktrees.ts` provisions, merges and
   disposes a throwaway FID against a temp repo; document the lifecycle in
   `docs/design/parallel-worktrees.md`; CHANGELOG and README updated at closure.
   — implemented

### Verification

- Provision: invalid id refused (traversal, wrong shape); second create for the
  same FID refused; cap refused at the ceiling; debris from a crashed run
  self-heals; branch exists at a different base refused; `node_modules` is a
  link, not a copy; record matches the returned path.
- Dispose: git removal success with surviving files warns and falls back;
  `git worktree list` no longer contains the path; record deleted; a symlinked
  `node_modules` target is untouched.
- Merge: clean fast-forward lands the commit; diverged head refuses without
  changing anything; conflicting branch refuses with the file names.
- Law 2: a write inside a managed worktree to a covered path passes; an
  uncovered path blocks; a hand-made `.savant/worktrees/fake/...` directory
  gains no jurisdiction; the register read comes from the worktree.
- Tool: Forge/Verifier/Scout's tool lists do not contain `fid_worktree`;
  the Orchestrator's does; each action returns the typed result.

Exposure: `packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts`,
`fid-worktree-dispose.test.ts`, `fid-worktree-merge.test.ts`,
`packages/agent-runtime/src/echo/__tests__/law2-worktree-jurisdiction.test.ts`,
`common/src/tools/__tests__/fid-worktree-params.test.ts`, and
`scripts/probes/fid-worktrees.ts`.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck agents
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-merge.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law2-worktree-jurisdiction.test.ts
- gate: test common/src/tools/__tests__/fid-worktree-params.test.ts
- gate: test sdk/src/__tests__/ripgrep.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:75d0502f64e7444a746173666c0885dbf861e9938e7769442454ad24fd1183f0
- verified: 2026-10-17T20:05:26.111Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck agents: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-dispose.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-merge.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law2-worktree-jurisdiction.test.ts: exit 0
- test common/src/tools/__tests__/fid-worktree-params.test.ts: exit 0
- test sdk/src/__tests__/ripgrep.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Six defects, each with the live line: no isolation between FIDs
  (single index/cwd); pre-audit exposure of Forge output on the shipping branch;
  no provisioning capability at all (search returns only the release checkout);
  the Law 2 gate matches worktree paths as
  `.savant/worktrees/<fid>/…` and blocks every write inside a lane
  (`pre-write-gates-law2.ts:85-105`); Law 15 already owns the word "worktree"
  (`enforcement/worktree-git.ts:1-13`); and the source blueprint prescribes the
  teardown ordering that caused the recorded orphan incident
  (`scripts/public-release/clean-checkout.ts:1-19`).
- **GREEN:** One FID → one linked checkout under the ignored root, provisioned
  and disposed by the host; a jurisdiction mapping so the existing register keeps
  governing lane writes; a fast-forward-only merge with dry run; qualified
  naming (`fid-worktree-*`).
- **AUDIT:** Read `pre-write-gates-law2.ts` end-to-end to confirm the mapping
  point is `toRepoRelative` and that governance exemptions stay intact; read
  `clean-checkout.ts` to reuse the exact removal order; read `provenance.ts` to
  confirm `changeHash` is content, so no re-signing step is needed across a
  merge; read the Orchestrator's `toolNames` and the spawn parameter registry to
  place the tool surface.
- **ADVERSARIAL:** The strongest attack is that a per-FID checkout cannot fix
  what actually hurt: two agents editing the same file still conflict at merge,
  and the FID now pays provisioning cost for a benefit that only appears with
  genuinely disjoint work. The answer is that isolation is a correctness
  property (no index race, no dirty reads, no pre-audit code on the shipping
  tree) and the merge gate refuses rather than pretending; fan-out profitability
  stays unmeasured and is not claimed.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. **Why not `rm -rf` for speed, as the blueprint says?** Because that is the
   recorded incident ordering: git loses the registration while the directory
   survives, and no git command can then clear the orphan. Removal is
   `git worktree remove --force`, verified, then a bounded fallback only for
   survivors.
2. **Does a rebase/merge invalidate provenance receipts?** No. A receipt's
   signed identity is `changeHash` (post-write content) plus the
   project-relative `path` (`common/src/types/provenance.ts:51-68`), not a commit
   SHA, so merging the content lands the same hash. The blueprint's assumption is
   wrong for this repo; no re-signing step is in the FID.
3. **Where do worktrees live?** `.savant/worktrees/<fidId>`, under the existing
   `.savant/` ignore (`.gitignore:107`), so the main checkout stays clean. No
   second ignore entry, no tracked artifacts.
4. **What happens to `node_modules`?** The main checkout's root and workspace
   `node_modules` are linked (junction on Windows, symlink elsewhere); nothing is
   installed per lane. A lane that changes dependencies must run its own install
   and is then responsible for the disk cost.
5. **Does the Law 2 gate get weaker?** No: only directories backed by a managed
   record gain the mapping, the mapped target is the repo-relative path, and the
   register is read from the worktree. A hand-created directory, an unlisted
   worktree, or a path that escapes the lane root still gets today's behavior.
6. **Who may create lanes?** Only the Orchestrator. Forge writes inside a lane
   but cannot create/merge/dispose; Verifier and Adversary are read-only in it
   except for test execution.
7. **What if provisioning fails halfway?** The `add` is followed by linking and
   the record write; any failure runs the dispose path before returning the typed
   refusal, so no half-lane is left registered.
8. **Can two FIDs share one branch?** No. `savant/<fidId>` is derived from the
   id; a pre-existing branch is refused when it does not point at the requested
   base.
9. **What about the cap?** Default 4 active FID worktrees, counted from records;
   the refusal is typed and names the cap. The cap exists because each lane
   duplicates working files and build caches even with linked dependencies.
10. **Is this the DAG scheduler?** No. This FID is isolation, jurisdiction,
    lifecycle and merge discipline. A dependency scheduler, rate limiter, CST
    merge and federated graph are separate work; none is claimed as delivered.
11. **Does the FID worktree need its own `SCOPE.md`?** It carries the same
    commit's register, and the gate reads it from the lane root, so a lane's
    authority is the authority it was created from. If the operator edits scope
    mid-lane, the edit must be committed and merged like any other change.
12. **What stops a runaway `bun test` from writing into the main checkout?**
    Nothing filesystem-level; the lane is a directory, not a sandbox. The FID
    states that limit: path-bound tools point at the lane, and Law 2 governs
    targets; a shell command that ignores its cwd can still reach the repo.
13. **Does the operator's blueprint's Python code get ported?** No. This is a
    TypeScript/Bun monorepo; the blueprint's `asyncio`/LibCST examples are
    design inputs, not code. The FID implements the subset that its contracts
    state.
14. **What about ports and databases?** Step 7 assigns a deterministic
    `WORKTREE_INDEX` and offsets `PORT`, `DATABASE_URL` and
    `COMPOSE_PROJECT_NAME`, and copies the knowledge-graph DB into the lane. It
    does not stand up containers or remote databases.

### Loop 2 — Independent audit and self-correction

- **RED:** The first draft had no worktree concept in the write gate, so every
  lane write would have been blocked as `.savant/worktrees/<fid>/…`. It also
  assumed receipt re-signing after merge, which the receipt schema does not need,
  and it copied the blueprint's `rm -rf` teardown order.
- **GREEN:** The jurisdiction mapping was added as an explicit step with its own
  pins; the provenance step was deleted after reading the receipt type; teardown
  now follows `clean-checkout.ts` (git remove → verify → bounded fallback →
  prune).
- **AUDIT:** `pre-write-gates-law2.ts:85-105` read in full: targets outside cwd
  are skipped, so the mapping must run *before* the cwd comparison and only for
  recorded lanes. `clean-checkout.ts:63-138` read in full: the two-phase contract
  (pre-create guard, finally cleanup with verified absence) is reusable as-is.
- **ADVERSARIAL:** A lane whose record is deleted (crash) becomes an
  unregistered orphan — the exact incident class. Mitigation: records live
  outside the lane, dispose is idempotent, and `list` reconciles
  `git worktree list` against records, surfacing orphans as warnings rather than
  silently ignoring them.
- **CHANGE DELTA:** ~14% (jurisdiction step, dropped re-signing, teardown order).

### Loop 3 — Final convergence

- **RED:** Remaining risks: the tool-surface change touches the shared params
  registry and the agent allowlists; the cap can be bypassed by two concurrent
  creates that both count under the ceiling; Windows junction creation can fail
  on a locked `node_modules`.
- **GREEN:** The tool is one schema + one handler + one list entry + one
  allowlist edit, all covered by the declared gates; the cap is re-counted after
  the record write and a post-write over-cap provision is rolled back; a failed
  link is a warning on the record, not a failed provision, because the lane is
  usable without the link and a silent failure would be worse.
- **AUDIT:** Gate list checked against the allowlist (`typecheck <ws>`,
  `test <path>`, `probe <path>`, `quality`); every promised test path is declared
  as a gate; the probe is scheduled under `scripts/probes/` (durable, never
  scratch).
- **ADVERSARIAL:** The design still permits a lane to run an arbitrary test that
  writes absolute paths into the main checkout — isolation is not a sandbox.
  That limit is stated in the FID and the docs; claiming otherwise would be a
  false guarantee.
- **CHANGE DELTA:** ~4% (cap re-check, link warning, gate list).

### Loop 4 — Handoff contract reconciliation

- **RED:** Steps 1–3 exist at `7618b5b4`, despite the old Resolution wording.
  Record JSON is cast without full validation; sorted indices would move when
  another lane disappears. Missing lane scope, symlink escapes and dirty merges
  need explicit refusal pins before the remaining consumers can be trusted.
- **GREEN:** Validate records against derived paths and git registration; map
  scope from either main or lane cwd and fail closed for absent lane scope.
  Persist lowest-free positive slots. Serialize host lifecycle mutations.
  Expose the same service through the Orchestrator tool and CLI; explicit CLI
  `exec` injects lane cwd/environment without changing the host environment.
  Child file tools use absolute lane paths. No automatic spawn routing is
  claimed. Snapshot SQLite including WAL; refresh main only after merge.
- **AUDIT:** Gate and scope lists extended for the concrete registry, tool and
  environment consumers. Existing scope pins cover normal cwd behavior; new
  tests exercise managed/unmanaged lanes, refusal cases and real git/SQLite.
- **ADVERSARIAL:** A directory is not a sandbox. Explicit cwd/environment cannot
  prevent a shell from reaching absolute host paths. Keep this stated limit;
  preserve refused lanes and report post-merge graph failure as a warning on a
  successful merge, never as a fictional rollback.
- **CHANGE DELTA:** Contract clarification only; all eight steps retained.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Step Status

- [x] Step 1 — Git seam + naming rule — implemented
- [x] Step 2 — Provision — implemented
- [x] Step 3 — Dispose + list — implemented
- [x] Step 4 — Law 2 worktree jurisdiction — implemented
- [x] Step 5 — `fid_worktree` tool surface — implemented
- [x] Step 6 — Merge gate — implemented
- [x] Step 7 — Environment isolation — implemented
- [x] Step 8 — Operator CLI, probe, docs — implemented

## Resolution

Implemented and verified at `11dd667d`, completing the lifecycle foundation
from `7618b5b4`. All eight steps are delivered. The Orchestrator tool and
operator CLI share `runFidWorktreeAction`; explicit child paths and CLI `exec`
select the lane. There is no automatic spawn rerouting or scheduler.

Production wiring, rechecked against committed code:

```text
common/src/tools/list.ts:82                         fid_worktree: fidWorktreeParams
agents/savant/savant.ts:140                         !analyzeOnly && !planOnly && 'fid_worktree'
packages/agent-runtime/src/tools/handlers/list.ts:101 fid_worktree: handleFidWorktree
packages/agent-runtime/src/tools/handlers/tool/fid-worktree.ts:22
                                                    await runFidWorktreeAction(...)
packages/agent-runtime/src/echo/pre-write-gates-law2.ts:125
                                                    resolveFidWorktreeJurisdiction(raw)
packages/agent-runtime/src/echo/enforcement/helpers.ts:230
                                                    fid_worktree merge => tree mutation
scripts/worktree.ts                                 runFidWorktreeAction + buildChildEnv(lane overrides)
```

All 15 declared entries in the Verification Receipt are `exit 0`: four
workspace typechecks, eight test suites, the real-git/SQLite probe, the
scripts-tree typecheck probe and quality. Additional repository gates completed:

```text
bun run typecheck                 exit 0 (14 workspaces + scripts)
bun run test                      exit 0 (full root workspace chain)
bun run ci                        exit 0 (ESM, CJS, SDK declaration bundle)
bun x eslint . --max-warnings 0   exit 0
bun run lint:md                   exit 0
bun x prettier --check .          exit 0
bun run validate:repository       validation: PASS
```

Real probe output:

```text
PASS — two isolated lanes, lane scope, WAL snapshot, CLI fast-forward, graph refresh, divergence refusal, dispose and self-heal held
```

The receipt records verification before closure; the status/archive and
resolution edits change the document fingerprint by design. Root test logs
and the handoff continuation are retained under `dev/session-summaries/`.
No live multi-agent inference, throughput benchmark or sandbox claim is made.

## Known Limits

- A lane is a directory, not a sandbox: a process that writes absolute paths
  outside its cwd can still reach the main checkout.
- Merge conflicts are refused, not resolved; there is no CST/structural merger in
  this FID.
- Fan-out throughput is not measured and no speedup is claimed; the premise is
  correctness and pre-audit containment.
- The knowledge graph is copied per lane and re-indexed after merge; concurrent
  indexing of many lanes is not attempted.
- Runtime provenance, graph queries and verification use their caller's project
  root. Run the CLI/SDK rooted in the lane for that bookkeeping; absolute paths
  alone do not rebind a child spawned on main. Content hashes survive merge,
  but receipt path identity still requires the correct lane project context.

## Lessons Learned

A write boundary needs both a filesystem mapping and its own scope register;
neither a JSON record nor a directory name grants authority. Persist execution
slots instead of sorting live lanes, snapshot SQLite with committed WAL pages,
and keep provider secrets behind the existing child-environment allowlist.
Real git tests need an explicit process budget under full-suite load. SDK
resolver tests must accept the source and built vendor paths while checking
the pinned bytes; a build is not a reason to fall back to PATH.
