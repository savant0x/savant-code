# FID housekeeping closure — 2026-10-08

## Authorization and intent

Resumed from `dev/scratchpad/active/provider-catalogs-2026-10-03/pass.md`.
Operator requested review, closure, CHANGELOG updates and physical archival of
completed FIDs, then approved the presented plan: "a, accept all suggestions".
Single-agent ECHO v0.1.2, strict mode, automation level 3.

Complete the six already-written archive records, re-run their declared gates
and stamp receipts at the archived paths, remove the six active duplicates,
update both FID indexes and CHANGELOG, and repair the open-work register.
Document five deliberately non-context KiosAPI ids in the fallback-table
header and align the telemetry FID's stale status prose with `analyzed`.
All file changes use direct patches after full reads; no scripted edits.

## Implementation evidence and open boundaries

| FID | Implementation commits | Declared gates |
| --- | --- | --- |
| `FID-2026-1007-013` | `8ead0378` | 5 |
| `FID-2026-1007-015` | `4eaf57cc` | 5 |
| `FID-2026-1008-001` | `4e1ab59b` | 4 |
| `FID-2026-1008-002` | `d6d544b4`, `742d919f` | 3 |
| `FID-2026-1008-004` | `742d919f` | 5 |
| `FID-2026-1008-005` | `9a07792e`, `32b222ff` | 7 |

The remaining active records are `FID-2026-1007-011`, `-012`, `-014` and
`-016`. Closure of the six records preserves three open boundaries in
`SCOPE.md`: `T164-D` needs a named external consumer, eval billing keys and
wire-stage ratification; `T171` needs the harvested-candidate verdict and
consent rulings; `T173` needs vendor-published windows for five exact ids.

## Verification and staging

All six `bun run fid:verify <archived-path> --write` runs returned exit 0:
29/29 declared gate executions PASS. Receipts were refreshed at the archived
paths on 2026-10-09 UTC (2026-10-08 local time). Each closed record retains
its earlier implementation and verification history.

```text
FID-2026-1007-013: 5/5 PASS — receipt stamped
FID-2026-1007-015: 5/5 PASS — receipt stamped
FID-2026-1008-001: 4/4 PASS — receipt stamped
FID-2026-1008-002: 3/3 PASS — receipt stamped
FID-2026-1008-004: 5/5 PASS — receipt stamped
FID-2026-1008-005: 7/7 PASS — receipt stamped
scope-register PASS (0 issues)
Provider docs counts match the registry; no unevidenced fact drift.
validation: PASS
markdownlint .: exit 0
All matched files use Prettier code style!
```

Repository validation also printed a sandbox permission warning while git
tried to read `C:/Users/spenc/.config/git/ignore`; validation itself exited 0.
The warning is recorded, not reported as a clean warning-free run.

Production reachability re-confirmed: `transition-phase.ts:45,83` and
`pre-write-gates-law3.ts:205`; runtime `step.ts:166` and eval
`trace.ts:179,220` / `runners/savant.ts:54,96`; KiosAPI registry URL at
`registry-partitioned.ts:29`; `use-chat-bootstrap.ts:122` calls the digest;
`free-options.ts:194,235` consumes the deadline count;
`model-provider-commands.ts:72` opens cache-first;
`use-chat-pickers.ts:234` stages auto-wire and
`route-masked-key-setup.ts:106` completes it.

The four retained records were checked against the tree: the drain directory
entry exists but its coverage test is absent; telemetry type and storage are
absent; release pre-audit modules contain no G2/G5 checks; the matrix runner
still calls `runIdentityGauntlet` without controls. The telemetry record's
header, gates explanation and evidence prose now agree on `analyzed`.

Five active/archive pairs matched after trailing-newline normalization. The
sixth (`-005`) differs by the approved blocked-remainder wording in its
Summary. Active duplicates were removed with direct delete-file patches;
no shell move/delete or scripted transform was used. Completed scope items
and grants were removed; the remaining three blocked boundaries carry level
1 because the next action requires external information or operator rulings.
An additional stale `T170` grant was found and removed: that FID was already
closed and archived, with its CHANGELOG evidence preserved.

Every approved housekeeping step is implemented: six archive records and
receipts, duplicate removal, table-header documentation, both indexes,
CHANGELOG, open-register cleanup, telemetry prose repair, this summary and
the declared checks. No runtime behavior or fallback value changed this pass.

The implementation commits already exist; the closure documentation remains
working-tree work. Operator staging plan, limited to this closure:

```powershell
git add -A -- `
  CHANGELOG.md `
  SCOPE.md `
  common/src/constants/context-window-table-kiosapi.ts `
  dev/fids/README.md `
  dev/fids/archive/README.md `
  dev/fids/FID-2026-1007-012-model-compliance-telemetry.md `
  dev/session-summaries/2026-10-08-fid-housekeeping-closure.md `
  dev/fids/FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md `
  dev/fids/FID-2026-1007-015-atria-harness-friction-p1-p5.md `
  dev/fids/FID-2026-1008-001-kiosapi-full-square-catalog.md `
  dev/fids/FID-2026-1008-002-free-provider-launch-and-autowire.md `
  dev/fids/FID-2026-1008-004-free-provider-followups.md `
  dev/fids/FID-2026-1008-005-model-picker-swr-gauntlet-docs-autowire.md `
  dev/fids/archive/FID-2026-1007-013-eval-runner-model-override-and-usage-telemetry.md `
  dev/fids/archive/FID-2026-1007-015-atria-harness-friction-p1-p5.md `
  dev/fids/archive/FID-2026-1008-001-kiosapi-full-square-catalog.md `
  dev/fids/archive/FID-2026-1008-002-free-provider-launch-and-autowire.md `
  dev/fids/archive/FID-2026-1008-004-free-provider-followups.md `
  dev/fids/archive/FID-2026-1008-005-model-picker-swr-gauntlet-docs-autowire.md
git diff --cached --check
git diff --cached --stat
```

No commit or push was authorized or performed in this resumed pass.
