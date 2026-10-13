# Session summary — gate repair, module-state cures, exposure receipts (2026-10-13)

This pass closed `FID-2026-1012-024`'s refusal/exposure work and then owned three findings
discovered while verifying it. All three were opened, completed and evicted from `SCOPE.md`
in the same pass, per the protocol rule that no finding inside the project is out of scope
and the register's own contract that a closed item's evidence is retained here rather than
left sitting in the register as completed work.

Commits this pass: `69a61f08` (exposure receipts + refusal channel), `7e0a00cc` (the
web-search reset seam and the register reconciliation), `1842ea84` (the register eviction
and this record). Nothing was pushed.

One consequence of the numbering hazard described below is visible in this pass's own
history: `7e0a00cc`'s subject cites the task id that the eviction retired, so that id is a
dangling reference in the log. It is recorded here rather than corrected, because amending a
commit on `main` is a history rewrite this protocol does not authorize.

## 1. `FID-2026-1013-003` was unverifiable and held a gate that could never run

Two separate defects in one record:

- **No `### Code Verification Evidence` section.** `scripts/fid-ledger.ts:34` requires that
  heading on **every** active FID, so its absence alone was the only red in
  `bun run validate:repository` (`[fid.structure.heading]`).
- **An invalid gate declaration.** `- gate: test scripts/window-coverage-check.ts` cannot
  ever execute: `fid:verify` rejects a `gate: test` path that does not match
  `/\.test\.(ts|tsx)$/`. That script is probe-shaped — `if (import.meta.main) main()`, exit 0
  clean / 1 naming its issues — so it is now declared `- gate: probe`, which is the
  documented route for proving a repo-gate check.

Fixed: the gate line was corrected, all **eleven declared gates were then run live and every
one exited 0**, and the record now carries the pasted results, the fourteen-path existence
check, the Law-4 call-graph grep (`gateway-live-results.ts:18,52,107,166-168`,
`gateway-catalog-merge.ts:57`, `gateway.ts:16`) and a stamped receipt. **No source change was
made to that lane's implementation.** The verification was performed by this pass and
recorded as such.

**Where the fix lives:** `dev/fids/FID-2026-1013-003-apixo-provider-integration.md` is an
**untracked** file owned by the provider-parity lane's pending commit, so no commit from this
pass contains it. The gate is green in the working tree and the record travels with that
lane's commit.

## 2. Two module-scope registries had no reset in the isolation preload

`bun scripts/module-state-check.ts` reported two uncured mutable containers. The probe is not
wired into `validate:repository`, which is why the repository gate never surfaced either.

- **`packages/agent-runtime/src/tools/handlers/tool/web-search.ts:23` (`noticeLogs`).** A real
  isolation defect, not a formality: the per-session notice cache lives at module scope, and
  `bun test` loads every file of the workspace into ONE process, so a shared fixture session id
  could make a suite's verdict depend on which files ran first — the exact shape
  `FID-2026-1007-001` was filed for. Cured with a same-file `resetWebSearchNoticeLogs()` seam,
  now called from `packages/agent-runtime/test/setup-test-isolation.ts`. Tracked and committed.
- **`scripts/providers/audit-probes/parity-tier1-catalog-probe.ts:294` (`measurements`).** Its
  measurement loop ran at module top level, so importing the file fired eighteen live network
  probes as a side effect and left process-lifetime state behind. Cured with a guarded
  entrypoint, the same shape as its sibling `scripts/window-coverage-check.ts`. The file sits
  **exactly at the 300-line ceiling**, so the guard is net-zero lines and the wider rationale
  lives in this summary rather than in the file.

Re-measured after both cures: `module-state: PASS (2,615 files; 192 of 197 resettable bindings
wired)`, `quality: PASS`, and the full agent-runtime workspace suite **2,103 pass / 0 fail**.

**Where the fix lives:** the two workspace files are tracked and committed by this pass;
`parity-tier1-catalog-probe.ts` is **untracked** (the provider-parity lane's artifact), so its
guard travels with that lane's commit and the `module-state: PASS` result is a working-tree
result until then.

## 3. `FID-2026-1012-024`'s write targets lagged work already committed under it

The exposure-receipt slice (`69a61f08`) wrote `common/src/types/hooks.ts` (the builtin-action
allowlist), `protocol.config.yaml` (the `PostToolUse` hook declaration) and
`packages/agent-runtime/test/setup-test-isolation.ts` (the cache-reset registration), and the
record's register target line named none of them. The work is approved in scope and recorded in
the record itself; the target line was corrected in the same pass so the register's authority
matches the work instead of lagging it. The correction stays in the register because the item
is still open.

## How the three items were registered, and the numbering hazard found on the way

The three findings were registered in `SCOPE.md` with their automation levels and evidence,
then evicted on closure in the same pass — which is what the register's header requires: it
lists active work only, and a closed item's evidence is retained here instead. This pass
allocated the next three task ids from the register's visible maximum, and on eviction
discovered that the first of them had been used before and retired:
`dev/fids/archive/FID-2026-1011-004-install-independent-undeclared-import-guard.md:1` and
`dev/session-summaries/2026-10-11-undeclared-import-guard-t188.md:1` both name `T188` for the
2026-10-11 undeclared-import guard, an item the register no longer holds. The eviction removed
the overlap, so no id currently carries two meanings; the underlying hazard — a closed item's
number returns to the pool with nothing to notice it — is registered as its own blocked item
(automation level 1, because the fix changes a governance surface the operator owns). No live
item was renumbered and no retired id is cited in this summary.

## Observation for `FID-2026-1012-019` (host resolver class)

`code_search` failed repeatedly during this pass with
`Failed to execute ripgrep: ENOENT: no such file or directory, uv_spawn 'C:\Users\spenc\.config\manicode\rg.exe'`
— the vendored ripgrep is absent from the host, so the tool could not run at all and the
session fell back to shell `grep`. That is a live instance of the
`code_search:search-executable-missing` class that record already attributes to the **host**
resolver rather than to repository code, and it is recorded here as evidence feeding that
lane. No repository change is implied or claimed.

## Verification at the committed state

`bun run validate:repository` **PASS** (was FAIL on the missing heading) · `bun run typecheck`
exit 0 · repo-wide `eslint . --max-warnings 0` exit 0 · `bun run lint:md` exit 0 ·
`bun run fid:verify --check` **PASS** · `quality:report` PASS (1,502 files) ·
`module-state-check` **PASS** (was FAIL, 2 uncured) · `scope-register-check` PASS (0 issues) ·
census `586 records / 57 stable classes / 0 issues` · agent-runtime suite **2,103 pass / 0 fail**.

Two results depend on untracked artifacts named above; everything else is committed.
