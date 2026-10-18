# FID-bound parallel worktrees

Each active converged FID can get a linked git checkout at
`.savant/worktrees/<FID-ID>` on `savant/<FID-ID>`. The default ceiling is four
active lanes. Git gives each lane a separate index and working directory;
uncommitted lane changes stay off main and out of other lanes.

## Use from the Orchestrator

The `fid_worktree` tool accepts `create`, `list`, `merge` and `dispose`.
Effectful Orchestrator variants expose it; plan/analyze modes and the
Forge, Scout, Verifier and Adversary do not. The handler also checks the role.

1. Commit the converged FID and its approved scope on main before creating a
   lane. Create with `{"action":"create","fid_id":"FID-2026-1017-007"}`.
2. Give child agents absolute file paths under the returned `record.path`.
   Set terminal cwd explicitly to that directory. Spawn defaults still point
   at the host project: creating a lane does not automatically reroute spawns.
3. Run commands needing isolated environment variables through the operator
   `exec` command below. It starts a child with the lane cwd and overrides;
   the host's environment is unchanged.
4. Run the FID's verification gates inside the lane and review its changes.
   Commit only approved lane files. The merge gate enforces git topology and
   cleanliness; it does not certify that the FID's tests or review passed.
5. Request `merge`, inspect the result, then `dispose` after acceptance.
   Merge never disposes automatically; refused lanes survive for inspection.

For the complete runtime bookkeeping, launch the CLI/SDK with its project
root set to the lane (CLI `exec` supplies that cwd). Absolute lane paths from
a child still rooted on main permit scoped file access, but do not rebind
provenance, graph-query or verification contexts. Those callers must select
the lane as their project root; this tool does not rewrite spawn contexts.

`list` reports the FID, branch, recorded base SHA, creation time, dependency
links, stable execution slot, git registration and dirty state. Disposal
refuses uncommitted changes unless `discard_changes: true` explicitly permits
their removal. Committed branches remain after disposal so work can be recovered.

## Operator commands

Run these from the primary repository root:

```bash
bun scripts/worktree.ts create --fid FID-2026-1017-007
bun scripts/worktree.ts list
bun scripts/worktree.ts exec --fid FID-2026-1017-007 -- bun run typecheck
bun scripts/worktree.ts merge --fid FID-2026-1017-007
bun scripts/worktree.ts dispose --fid FID-2026-1017-007
```

`exec` uses executable/argv without a shell and propagates the command's exit
code. It inherits the SDK's shell-environment allowlist plus the declared lane
overrides; provider credentials are not forwarded. For shell syntax, invoke the
shell explicitly. It does not print the
injected environment. `--discard-changes` applies only to `dispose` and loses
uncommitted lane changes; it is never the default.

## Write authority

Law 2 maps a managed lane's absolute targets back to lane-relative names and
reads that lane's own `SCOPE.md`. It works when the host cwd is main or inside
the lane. A missing lane register, missing record, malformed or redirected
record path, missing git registration, or path escaping through a symlink or
junction refuses authority. Hand-created directories under the managed root
gain nothing. An inherited `writeScope` still narrows the approved patterns.
Governance exemptions retain their existing behavior inside a valid lane.

Records live outside the checkout at `.savant/worktrees/.records/<FID>.json`.
Creation verifies an active converged FID, the primary main checkout, ignored
managed storage and an unredirected root. Lifecycle mutations take one
cross-process lock at `.savant/fid-worktree.lock`; concurrent requests refuse
with `busy` and can retry. After a host crash, inspect git and the managed
records before removing only that empty lock directory. Never clear a lock
while a host operation is active.

## Environment and dependencies

Each lane keeps the lowest free positive execution slot allocated at creation.
Disposing another lane never renumbers a live lane.

| Variable | Lane value |
| --- | --- |
| `SAVANT_WORKTREE_ROOT` | Absolute lane directory |
| `WORKTREE_INDEX` | Persisted positive execution slot |
| `PORT` | Host port (default 3000) + slot × 100; invalid ranges refuse |
| `COMPOSE_PROJECT_NAME` | Sanitized host name (default `savant`) + `_wt<slot>` |
| `DATABASE_URL` | When configured: PostgreSQL/MySQL database name + `_wt<slot>`, or lane-local SQLite file URL |
| `SAVANT_CODE_GRAPH_DB_PATH` | Lane `.savant/graph.db` |

Unsupported database URLs refuse creation/execution instead of sharing the
host database silently. Remote databases and containers are not created;
provision the named test database separately if the project needs one. Database
credentials are used only in the child environment, never returned in tool JSON.

Root and workspace `node_modules` directories are linked from main, using
junctions on Windows. No dependency install runs per lane. Links are shared:
do not run installs or dependency-changing commands through them. Detach the
links and install separately for a dependency-changing lane. A failed link
returns a warning. Graph initialization failure rolls back the new checkout.

An existing main `.savant/graph.db` is copied with SQLite `VACUUM INTO`, which
includes committed WAL pages. Lane graph queries can use this independent
snapshot. A successful merge refreshes the main graph; a failed refresh is a
warning on the successful merge and requires `/graph refresh` before trusting
the graph. Refused merges never refresh main.

## Integration and cleanup

Both checkouts must be clean, including untracked files. Main must still be at
the recorded base. The host runs `git merge-tree --write-tree` first, names
conflicts, rechecks main HEAD, and uses `git merge --ff-only` with the captured
lane SHA. It never auto-resolves or rebases. A moved main refuses even when
changes are disjoint: reconcile the lane from the new base and reverify before
trying again. Host merge calls enter Law 15 mutation reconciliation.

Disposal first unlinks junctions and symbolic links inside the lane without
following their targets. This is required on Windows: Git's recursive worktree
removal can otherwise delete shared dependency contents through a junction.
If link inspection or unlinking fails, cleanup refuses and retains the lane
and record for inspection. The same protection applies to initialization
rollback and crashed-lane cleanup, even without a persisted record.

After detachment, disposal runs `git worktree remove --force`, verifies absence, uses bounded
filesystem cleanup for survivors and then prunes git metadata. Cleanup warnings
remain visible; a surviving checkout keeps its record. Git branches are retained.

## Evidence and limits

Run `bun scripts/probes/fid-worktrees.ts` for a real-git/SQLite check of two
simultaneous lanes, independent changes, lane scope, WAL snapshots, CLI
fast-forward, main graph refresh, stale-base refusal and disposal/self-heal.
The focused workspace suites additionally pin role restrictions, dirty/conflict
refusals, slot reuse, explicit execution and symlink escapes.

A lane is a directory, not a sandbox. A shell can still reach absolute host
paths, linked dependencies are shared, and another process can bypass host
lifecycle locking with raw git. This feature provides explicit lane lifecycle
and governed paths; it does not add automatic scheduling, automatic spawn
routing, structural conflict resolution or a measured speedup.
