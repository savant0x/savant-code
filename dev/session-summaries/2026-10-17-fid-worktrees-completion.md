# FID worktrees — handoff continuation

Single-agent ECHO, strict mode, automation level 3. Resume the full approved
FID-2026-1017-007 from implementation commit `7618b5b4`. Preserve the untracked
blueprint and transcript. No release or live inference is authorized here.

## Intended implementation

Complete steps 4–8: lane-aware Law 2 scope matching, host-owned tool and
registration, fast-forward merge refusal, isolated execution environment and
graph snapshot, operator CLI and durable end-to-end probe/docs. The tool and
CLI share one service; child agents use explicit absolute lane paths and
terminal cwd. This does not introduce a scheduler or automatically reroute
every spawn into a lane.

## Review of the inherited contract

- The FID's resolution says implementation has not started although steps 1–3
  exist in the implementation commit. Reconcile at closure with code evidence.
- Records currently trust cast JSON and arbitrary record paths. Validate every
  identity and derived path before it can grant jurisdiction or drive IO.
- Lane scope must fail closed when its register or git registration is absent,
  including when cwd is itself inside a lane. Resolve symlink parents before
  granting authority; a dependency junction must not widen write authority.
- Merge must refuse dirty checkouts, wrong branches and moved HEADs. Serialize
  host lifecycle operations and preserve the lane on refusal. Refresh the
  main graph only after a successful merge; graph failure cannot undo a merge.
- Recomputing sorted lane indices after removal would reuse a live lane's
  ports. Allocate and persist the lowest free positive slot at creation.
- Environment overrides are injected only into explicit lane execution, never
  process.env. Do not expose credential-bearing database URLs in tool output.
- Copy the graph with a SQLite snapshot so WAL-only rows are included.

## Verification plan

Declare tests for merge, lane jurisdiction, tool/schema wiring, environment and
CLI execution, plus the existing provision/dispose suites and real-git probe.
Run the full typecheck, build, repository/quality checks and mandatory push
gates. Re-read implementation against every promised gate before closure.

## Integration findings

- Register the new tool in the safety metadata and agent name/parameter maps,
  not only the runtime handler list. Host merge is a tree mutation for Law 15.
- The SDK declaration build uses a minimal SQLite shim; add the real
  transaction, statement-finalize and strict-close signatures it now consumes.
- Preserve the supplied transcript at its original path; ignore that exact
  local export in git and Markdown lint so it cannot enter a release or be
  reformatted as product documentation.
- The graph snapshot test initially used the schema helper, whose uncached
  prepared statements wait for native finalization on Windows. Use an explicit
  WAL fixture and finalize the snapshot statement deterministically. The real
  CLI probe runs the actual graph indexer and checks its refreshed rows.
- Full-suite load took the multi-process lifecycle integration test just over
  Bun's 5-second default. Give only the real-git service tests a 30-second
  budget; all assertions remain. The inherited FID gate used the invalid
  workspace shorthand `agent-runtime`; correct it to `packages/agent-runtime`
  before stamping the receipt.
- After the SDK build materialized its declaration entry point, ESLint resolved
  the SDK self-import as internal and exposed two import-order warnings in the
  tracked README example. Align that example's imports with its existing
  README source; no behavior changes.
- SDK regression tests reproduced a false failure after a build: the resolver
  correctly selected `sdk/dist/vendor/ripgrep/...`, while the old assertion
  allowed only `sdk/vendor/ripgrep/...`. Accept exactly those two vendor paths
  and verify the resolved binary against its existing SHA-256 pin. PATH binaries
  remain excluded. Add that suite to the FID's declared gates.
- Explicit lane execution uses the existing SDK `buildChildEnv` allowlist,
  plus only the declared lane overrides, preserving the provider-secret boundary.

## Delivered and verified

Implementation commit: `11dd667d`. All eight steps are complete;
FID-2026-1017-007 is closed and archived, with the active SCOPE item and write
targets removed and a CHANGELOG entry added. No release or paid inference ran.

All 15 declared FID gates passed and the receipt was stamped before closure:
four workspace typechecks, eight test suites, the real-git/SQLite probe, the
scripts-tree typecheck probe and quality. The full root `bun run test` chain
completed with exit 0, as did root typecheck (14 workspaces plus scripts),
`bun run ci`, ESLint with zero warnings, Markdown lint, Prettier check and
`validate:repository`. The runtime worktree suites cover 34 tests; schema and
ripgrep suites add 16. Readable evidence is retained in the adjacent
`2026-10-17-fid-worktrees-{gates,tests-final,typecheck}.log` files.

Real probe: two simultaneous lanes kept their changes independent, lane scope
rejected uncovered writes, the SQLite snapshot retained WAL rows, CLI merge
landed exactly the reviewed lane SHA and refreshed main's graph, a stale-base
second lane refused, and disposal/self-heal reconciled git with the filesystem.

Manual audit rechecked every declared test artifact and production caller:
tool params/list/handler/Orchestrator allowlist, Law 2 jurisdiction, Law 15
mutation classification and CLI service/environment calls. Lane creation
refuses nested checkouts; provider-secret inheritance is rejected by a real
CLI child test. The graph indexer is loaded lazily only after a successful
merge. No automatic spawn routing, sandbox guarantee or throughput result is
claimed. The blueprint and original transcript are byte-preserved.
