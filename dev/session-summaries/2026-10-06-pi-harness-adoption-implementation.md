# Pi-harness adoption program: implementation + closure (T150 / `FID-2026-1006-002`)

**Date:** 2026-10-06 · **Scope:** T150 (operator request, verbatim: "write a fid to implement all
of the features found + run the full perfection loop on the fid then present it", followed by
resume directives driving implementation)
**Nature:** Implementation session. Twelve adopted work packages implemented, verified and closed;
the FID is archived.

## What was done

Implementation of all twelve work packages of
`FID-2026-1006-002-pi-harness-adoption-program`, in declared order, each slice verified before the
next:

- **WP1–WP4, WP10, WP12** (implemented earlier in the session): steering rules with audited
  override; the durable-race catalog + write-order conformance tiers; tool-outcome durability; the
  atomic transition rule + per-path file-mutation queue + serialized database mutation line; the
  adaptive publisher; marker-based prompt isolation in evals.
- **WP5** (this pass): `cut-points.ts` — turn segmentation, a boundary that never sits on a tool
  result, and an over-budget boundary turn that splits into two summaries which merge;
  `file-tracking.ts` — the cumulative newest-first file ledger folded across successive
  compactions; `phases.ts`/`state.ts` extended (`CompactionMessage_.findPreviousKeptBoundary`,
  `FileTracking`, `MAX_CUMULATIVE_TRACKED_PATHS`) so repeated compaction re-summarizes from the
  previous kept boundary rather than from the previous compaction entry.
- **WP9** (this pass): the `ProjectTrust` hook event and its cli gate. The gate is **veto-only** —
  a hook may deny trust but never grant it, so a repository cannot trust itself through the
  `protocol.config.yaml` it ships. Enforcement sits at the skill-registry load seam: an untrusted
  directory loads global skills only, never its own `.agents/skills/`. Census-verified: 13 fired
  events, `ProjectTrust` classified with reachable site `cli/src/utils/project-trust-gate.ts`.
- **WP11** (this pass): session entry classes — `entry_kind`/`exclude_from_context` columns
  (canonical schema + idempotent migration), `custom` vs `custom_message`, `label` bookmarks,
  `model_change`/`thinking_level_change` audit entries, the exclusion seam, and
  `getInContextMessages`. Tree branching is a recorded deliberate non-adoption.

## Defects found and fixed during verification

1. `findCutPoint` returned an out-of-bounds plan (`cutIndex: 6` for a 2-message array) when
   `windowStart` exceeded the array — found by the WP5 gate, fixed in the module, and pinned as an
   empty-plan contract.
2. A real `common` typecheck error at `project-trust.test.ts:225` (`Promise<string>` vs the
   `ProjectTrustDecider` shape) — fixed with an explicit return type.
3. A cross-file database state leak: the new `entry-classes.test.ts` created sessions in the
   shared connection before `service.test.ts`'s "DB starts empty at first use" assertion. Fixed by
   following the established `durable-races.test.ts` isolation pattern (own temp-file path,
   re-asserted per test, `':memory:'` restored in `afterAll`).
4. The 300-line quality ceiling tripped on three files (306–320 lines). Split into cohesive
   modules rather than exempted: `project-trust.ts` + `project-trust-store.ts` (re-exported, one
   import path for consumers), `project-trust.test.ts` + `project-trust-resolution.test.ts`,
   `history.ts` + `entry-classes.ts`.
5. Six eslint import-order/unused-import warnings on the changed surface — fixed; `eslint
   --max-warnings 0` exit 0.

## Verification evidence

- `bun run fid:verify dev/fids/archive/FID-2026-1006-002-… --check` → **22/22 PASS**, receipt
  `fingerprint: sha256:b1a3f13c7fa33e485ca6bbffeb366226be2a1a3470d06341651d87c95b50a8c0`
  (5 workspace typechecks + 16 named test gates + `quality: PASS (1498 baselined files)`).
- New suites: `compaction-cut-points.test.ts` 14 pass; `compaction-file-tracking.test.ts` 14 pass;
  `entry-classes.test.ts` 13 pass; `project-trust.test.ts` + `project-trust-resolution.test.ts`
  21 pass; database package 51 pass.
- `bun run typecheck` (13 workspaces + scripts) exit 0; `bun x eslint <changed surface>
  --max-warnings 0` exit 0; `bun run lint:md` exit 0; `bun run validate:repository` →
  `validation: PASS`; `bun run scripts/hook-events-check.ts` → PASS.

## Closure

Status `verified` → `closed`; the record moved to `dev/fids/archive/` (the active queue is now
empty); `CHANGELOG.md` carries the entry with the gate result; `SCOPE.md` T150 is marked completed
with the evidence above; `dev/fids/README.md` reflects the empty active queue.

## Limitations, stated

- **Three modules are library-complete with no production call path yet** — WP5
  (cut points / file tracking), WP7/WP8 (loop guard rails / preset validation) and WP11 (entry
  classes). For WP5 and WP7 the FID's declared deliverable is the module + tests; WP11 follows the
  WP4-database-half precedent. This is a stated limitation in the record, not reported as
  reachability.
- **No commit was executed** (protocol G1/G2: the agent never runs git). No push, no tag, no
  release. The path-scoped staging plan is prepared for the operator.
- The FID's stored receipt fingerprint predates the closure edits (status flip and the
  `- **Archived:**` line), which the protocol documents as expected for closed records: the
  receipt is the record of the verification that earned the status, not a claim about the closed
  bytes.

## Path-scoped staging plan (operator executes)

FID closure / records:

- `dev/fids/archive/FID-2026-1006-002-pi-harness-adoption-program.md` (moved from `dev/fids/`)
- `SCOPE.md`, `CHANGELOG.md`, `dev/fids/README.md`, `dev/session-summaries/2026-10-06-pi-harness-adoption-implementation.md`

WP5 (compaction):

- `packages/agent-runtime/src/context-compactor/cut-points.ts` (new),
  `packages/agent-runtime/src/context-compactor/file-tracking.ts` (new),
  `packages/agent-runtime/src/context-compactor/phases.ts`,
  `packages/agent-runtime/src/context-compactor/state.ts`,
  `packages/agent-runtime/src/__tests__/compaction-cut-points.test.ts` (new),
  `packages/agent-runtime/src/__tests__/compaction-file-tracking.test.ts` (new)

WP9 (project trust):

- `common/src/util/project-trust.ts`, `common/src/util/project-trust-store.ts` (new),
  `common/src/util/__tests__/project-trust.test.ts`,
  `common/src/util/__tests__/project-trust-resolution.test.ts` (new),
  `common/src/types/hooks.ts`, `cli/src/utils/project-trust-gate.ts` (new),
  `cli/src/utils/skill-registry.ts`, `protocol.config.yaml`

WP11 (entry classes):

- `packages/database/src/entry-classes.ts` (new), `packages/database/src/history.ts`,
  `packages/database/src/index.ts`, `packages/database/src/service.ts`,
  `packages/database/src/__tests__/entry-classes.test.ts` (new)

Suggested message: `feat(harness): implement pi-harness adoption program (FID-2026-1006-002)`
