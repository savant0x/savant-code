# FID: Managed temporary scratchpad

**ID:** FID-2026-1012-006
**Severity:** high
**Status:** closed
**Created:** 2026-10-12
**Closed:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The operator authorized stale scratchpad cleanup and clarified that automatic
management must ship as a Savant-Code feature, including headless/embedded runs.
Scratch files are temporary, including those under the legacy archive directory.

## RED — Current evidence

- **Commit/State:** `57d1d06dd7e7d8865e1537904dce6f393a7e79e3`; G2 field
  reconciled 2026-10-14 against the scratchpad implementation in Git.

Initial inventory: 162 files, 9,076,029 bytes. Scripts/hygiene.ts only validates
root entry names; it neither expires nested files nor bounds storage. Several
reusable provider probes and the scholarly acceptance report use scratch as their
sole durable location. A Tiarina directory was modified during this audit and
must be preserved. CLI initializeApp runs before both interactive and headless
dispatch; SDK run is the shared execution boundary for native embedded callers.

## GREEN — Proposed solution

1. Share a native filesystem lifecycle manager in common. Default retention is
   24 hours, idle quotas 32 MiB / 1,000 files, and one-hour quota grace. Preserve
   root README/.gitkeep. Never follow links or remove paths outside scratch.
2. Cross-process exclusive coordination protects sweeps and live-run leases.
   A live or uninspectable owner blocks deletion of the entire scratchpad,
   covering legacy flat paths and child tools. Dead owners are reclaimable;
   invalid lease data blocks deletion and produces an explicit diagnostic.
   This conservative protection allows temporary quota overflow during a run.
3. Sweep at CLI startup, every five minutes while idle, and before/after native
   SDK runs. Finally releases protection on success, failure and cancellation.
   Injected filesystems never trigger host disk housekeeping. Housekeeping
   failures report warnings and cannot crash a user run.
4. Ship /scratchpad status and /scratchpad clean in both CLI variants, and
   explain temporary semantics in agent instructions and docs. Clean obeys the
   same safety policy; it is not a force-delete command.
5. Move needed reports to test-prompts and reusable pending probes to scripts;
   update open scope references. Preserve ongoing Tiarina artifacts. Delete
   completed logs, snapshots and dated scratch archives, recording counts and
   evidence disposition in a durable session summary.

## Perfection Loop

**RED** is the inventory and the harness gap above (162 files / 9,076,029
bytes; `scripts/hygiene.ts` validated only root entry names and never expired
nested files or bounded storage). **GREEN** is the five-point solution above.

**AUDIT / ADVERSARIAL / SELF-CORRECT.** Two source-grounded review passes
converged before implementation. A dev-only script has no product caller and is
rejected. Merely aging archive into another archive does not bound growth.
Whole-root leases avoid missing terminal-created flat files; PID reuse
conservatively protects rather than deletes. Locks are bounded, exclusive and
owned; dead locks are recoverable. No invented TTL may expire a live owner.
Files changed since scanning are rechecked before deletion. Scans are bounded
and incomplete results are explicit; partial scans cannot claim quota
compliance. README exemptions apply only at root. Native operations must check
ancestor links, not just final file symlinks. No persistent pins.

### Missed Questions

1. **Where does the manager live — a dev script or the product?** The product:
   the operator's clarification is that scratch management must ship in
   Savant-Code, headless/embedded runs included, so the manager is a native
   `common` module with the SDK as the shared embedded boundary. A dev-only
   script has no product caller and was rejected.
2. **Does a live run lose its own temporary files?** No: a whole-root lease,
   not a per-file pin, protects the whole scratchpad while an owner is live,
   which also covers terminal-created flat files the sweep never scanned. A
   conservative protection may overflow quota during a run; that is preferred
   over deleting a running agent's work.
3. **What happens to a stale lease — PID reuse, malformed data, dead owner?**
   Dead owners are reclaimable; a reused PID conservatively protects rather
   than deletes; malformed coordination data **blocks** deletion and produces an
explicit diagnostic instead of guessing.
4. **Is `archive/` still a durability guarantee?** No. Scratch files are
   temporary *including* the legacy archive directory, which is why "age archive
   into a deeper archive" was rejected as a non-solution.
5. **Can a scan under-count and still claim compliance?** No: scans are
   bounded, and an incomplete scan is reported as incomplete and cannot claim
   quota compliance.
6. **Which reports must survive the cleanup?** Anything cited as evidence by an
   open task moves to a durable location first (`dev/test-prompts/archive/`,
   `dev/session-summaries/`), and reusable pending probes move into the
   typechecked `scripts/` tree. The Tiarina artifacts in flight during the audit
   were preserved for exactly that reason.

## Verification

Hermetic real-filesystem tests cover expiry, quotas/grace, current and dead PID
leases, malformed coordination, link escape, no-scratch roots and scan limits.
SDK wrapper tests prove lease lifetime and injected-filesystem isolation. Verify
production callers, root typecheck/eslint/Markdown/format/quality/repository gates,
SDK tests/build and local CLI build. Existing aggregate CI blocker remains T122.

## Step Status

- [x] 1. Shared native lifecycle manager in `common` (24h retention, 32 MiB /
  1,000-file idle quotas, one-hour grace, root README/.gitkeep preserved, no
  link following, no removal outside scratch) — implemented
  (`common/src/util/scratchpad.ts` + `scratchpad/{paths,scan,coordination}.ts`)
- [x] 2. Cross-process exclusive coordination; live or uninspectable owner
  blocks the whole scratchpad (legacy flat paths and child tools included);
  dead owners reclaimable; invalid lease data blocks with a diagnostic —
  implemented (`scratchpad/coordination.ts`)
- [x] 3. Sweep at CLI startup, every five minutes while idle, and before/after
  native SDK runs; release on success, failure and cancellation; injected
  filesystems never trigger host housekeeping; housekeeping failures warn and
  never crash a run — implemented (`cli/src/init/init-app.ts`,
  `sdk/src/run/execution.ts` + `execution/scratchpad.ts`)
- [x] 4. `/scratchpad status` and `/scratchpad clean` in both CLI variants,
  plus the temporary-semantics wording in agent instructions and docs —
  implemented (`cli/src/commands/scratchpad.ts`, `commands/defs/core.ts`,
  `data/slash-command-core.ts`; the entry rides `CORE_SLASH_COMMANDS`, which
  both variants splice, so there is no second registry to update;
  `packages/agent-runtime/src/templates/strings.ts`, `docs/scratchpad.md`)
- [x] 5. Move needed reports to `dev/test-prompts/` + `dev/session-summaries/`,
  reusable pending probes into `scripts/providers/audit-probes/`, update the
  open scope references, preserve in-flight Tiarina artifacts, and record
  counts + evidence disposition in a durable summary — implemented
  (`dev/session-summaries/2026-10-12-scratchpad-provider-inventory.md`;
  `SCOPE.md` T147's write surface repointed at the probe's new home). The move
  is also what exposed the two move-fallout defects repaired in the closure
  pass: the moved probe had no module marker (TS1375, breaking the `scripts`
  typecheck) and its own header still documented the old scratchpad run path

## Verification Gates

- gate: test common/src/__tests__/scratchpad.test.ts
- gate: test sdk/src/run/execution/__tests__/scratchpad.test.ts
- gate: quality

## Resolution

### Code Verification Evidence

- **Implementation matches the Proposed Solution — yes.** All five GREEN points
  are implemented and reachable from production entry points: the CLI startup
  sweep plus idle interval in `cli/src/init/init-app.ts:52-59`, the SDK
  before/after run lease in `sdk/src/run/execution.ts:12`, the `/scratchpad`
  handler registered in `cli/src/commands/defs/core.ts:37-38` and surfaced by
  `cli/src/data/slash-command-core.ts:14-17`, and the agent-facing semantics in
  `packages/agent-runtime/src/templates/strings.ts:157`. `scripts/hygiene.ts`
  now reports only root-level `scratchpad-clutter`; expiry belongs to the
  runtime manager, not to the lint.
- **Tests with pasted output — yes** (below).
- **Move fallout repaired at the cause** (this record's step 5): the probe that
  moved into the typechecked tree gained the module marker its top-level `await`
  requires, and its documented run path was corrected. `scripts-typecheck-check`
  is green again, which also clears the gate failure it was causing in
  `FID-2026-1012-004`.

Gates on the final tree:

```text
cd common && bun test src/__tests__/scratchpad.test.ts   exit 0  (9 pass / 0 fail)
cd sdk && bun test src/run/execution/__tests__/scratchpad.test.ts
                                                          exit 0  (3 pass / 0 fail)
bun run quality:report                                    exit 0  (quality: PASS, 1502 baselined files)
bun scripts/scripts-typecheck-check.ts                    exit 0  (scripts tree typechecks)
```

- **Closed Date:** 2026-10-12
- **Fix Description:** `dev/scratchpad` is managed temporary storage rather
  than an ad-hoc staging area. A native lifecycle manager expires idle files after 24
  hours and prunes above 32 MiB / 1,000 files with a one-hour grace, protects
  the whole scratchpad while a live run owns a lease, refuses to follow links or
  touch anything outside the scratch root, and surfaces `/scratchpad status`
  and `/scratchpad clean` as the operator's own controls. Legacy archive paths
  are temporary too, and the durable locations for reports and probes are now
  named in both the agent instructions and the docs.
- **Tests Added:** `common/src/__tests__/scratchpad.test.ts` (expiry, quotas and
  grace, current/dead-PID leases, malformed coordination, link escape,
  no-scratch roots, scan limits) and
  `sdk/src/run/execution/__tests__/scratchpad.test.ts` (lease lifetime over a
  run, injected-filesystem isolation).
- **Verification Evidence:** the gate block above.
- **Archived:** 2026-10-12 →
  `dev/fids/archive/FID-2026-1012-006-managed-temporary-scratchpad.md`
