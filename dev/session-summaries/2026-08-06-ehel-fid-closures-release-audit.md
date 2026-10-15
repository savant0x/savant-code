# Session 2026-08-06: EHEL FID Closures + Release Audit + Graph Export Testing

## Scope

Release audit + repo-wide consistency pass: close stale FIDs, verify the
CHANGELOG and version tracking, test the `/graph-export` feature end-to-end,
and validate every hard gate.

## FID tracking closed (3 → archived)

- **FID-2026-0805-005 (MiMo V2.5 context window):** already `closed` with a
  full Resolution — was never moved to the archive. Added `Closed`/`Archived`
  metadata and archived.
- **FID-2026-0805-006 (Divergent context window data path):** status was
  `created` but the fix shipped in CHANGELOG v0.0.22 (`resolvedContextWindow`
  unified through `send-message-fn.ts` + `send-message-monitors.ts`). Filled
  in the Resolution from code-grep evidence, set `closed`, archived.
- **FID-2026-0805-007 (ECHO Harness Enforcement Layer):** status was
  `analyzed` but the layer was fully implemented (`packages/agent-runtime/src/echo/`,
  9 modules + `native.ts` wiring) and shipped in v0.0.22, with three follow-up
  fixes landed 2026-08-06 (Law 1 gate new-file/hybrid fix, actual-law advisory
  emission, ECHO_STEERING injection). Filled the Resolution with implementation
  + test evidence, set `closed`, archived.

Remaining active FIDs are legitimately open: 0805-004 (design-only
`analyzed`, awaiting operator authorization to implement) and 0806-001
(constitution pending user review).

## FID archive audit (follow-up, 2026-08-06)

- **FID-2026-0805-003 (File-Length Deconstruction Program) closed + archived:**
  all 10 phases were verified complete (production program finished) but the
  status was still `in-progress (Phase 10 complete)` and the file sat in the
  active dir. Marked `closed` with `Closed`/`Archived` 2026-08-06 metadata,
  the final typecheck/test checkbox checked (evidence: release-audit gates),
  Lessons Learned filled in, and moved to `dev/fids/archive/`.
- **Two stale `analyzed` statuses normalized to `closed` in the archive:**
  FID-2026-0803-009 (ECHO doc drift — all 4 findings fixed + double-audit
  evidence present) and FID-2026-0803-011 (build artifact hygiene — audit
  results present) were archived under the wrong status. Both now `closed`
  with a normalization note.
- **Older-convention statuses normalized to `closed`:** 12 archived FIDs that
  used the pre-`closed` terminal vocabulary (`verified`, `complete`,
  `verified (archived)`) — 0802-008, 0803-001..007, 0803-010, 0803-012..014 —
  were updated to the canonical `closed` status per `ECHO.md` line 471.
  Result: **all 33 archived FIDs read `closed`**; only 2 active FIDs remain,
  both legitimately open (0805-004 design-only, 0806-001 pending review).
- Validation: `bun run lint:md` exit 0 (0 errors) after the edits.

## EHEL follow-up fixes (2026-08-06, all in v0.0.23 Fixed)

1. **Law 1 pre-write gate** no longer blocks new-file writes / hybrid mode —
   new files exempt; hybrid is inert (the non-blocking `EchoComplianceTracker`
   owns the advisory). Fixed the two pre-existing agent-runtime failures
   (`main-prompt write_file`, `echo-compliance-wiring` law1 receipt).
2. **Advisory warnings emit their actual law** — `ComplianceWarningLaw`
   (`law7`/`law8`) wire type, `buildComplianceWarningChunks`, strict-mode
   receipts surfaced before the block error.
3. **Strict Law 7/8 blocks steer the agent** — budgeted `ECHO_STEERING`
   corrective text injected into message history (search-first / intent-first).

## Graph export testing (release-audit follow-up)

- **End-to-end smoke (`cli/scripts/graph-smoke.ts`):** drives the REAL
  `/graph refresh` + `/graph-export` handlers over the actual repo —
  incremental refresh (6718 nodes · 7755 edges · 414 clusters), `--full`
  reindex determinism check, and a branded offline HTML written to disk
  (2.9 MB). Kept as a reusable smoke utility.
- **Cluster-count stat bug fixed:** `stats.clusterCount` counted cluster
  *assignments* (1975 for 1995 files) instead of distinct clusters —
  `computeClusters` was also passing no `resolution` (default 1.0), so the
  FID's inverse-resolution requirement was dropped. `update.ts` now counts
  distinct cluster ids and `clusters.ts` computes `defaultResolution` scaled
  by node count (clamped); new tests at
  `packages/knowledge-graph/src/__tests__/clusters.test.ts` + a consistency
  assertion in `update.test.ts`. Corrected stat verified live: 414 clusters.
- **Browser verification:** offline HTML opened in Chrome — no console
  errors, Savant logo/header render, Cytoscape canvas shows the monorepo
  graph, fuzzy-search input present.
- **Missing workspace dependency declarations fixed:** `cli/package.json`
  and `packages/agent-runtime/package.json` imported
  `@savant-code/knowledge-graph` without declaring it (resolved only via
  root hoisting). Both now declare `"@savant-code/knowledge-graph":
  "workspace:*"`; `bun install` refreshed `bun.lock`.

## Release audit — consistency check results

- `VERSION` = 0.0.23, all 12 workspaces at 0.0.23, `protocol.config.yaml`
  version aligned.
- CHANGELOG v0.0.23 covers knowledge-graph (Added), version unification
  (Changed), and the three EHEL fixes (Fixed); verification numbers updated
  (agent-runtime 685 pass / 0 fail).
- Root `typecheck`/`test` scripts + `protocol.config.yaml` cover the
  10-workspace set.
- `.gitignore` + `.savantignore` exclude `.savant/`; `savant-graph-*.html`
  export artifacts excluded from git + prettier.
- No stray probe/temp files in the feature workspaces (only pre-existing
  `resources/` research probes).
- **lint:md now fully clean repo-wide:** the pre-existing MD013/MD022/MD032/
  MD040 failures in untracked Nova inbox/outbox correspondence and the new
  design docs were reflowed (word-boundary wrap at 120 cols, blank lines
  around lists/headings, `text` on bare fences) via a temporary reflow
  utility (removed after use). The only tracked file touched by the sweep
  (a trailing-newline-only diff on the 08-04 signoff request) was restored.

## Validation

- Typecheck ×10: exit 0, 0 errors.
- agent-runtime 685 / 0 · cli 2852 / 0 · common 523 / 0 · sdk 439 / 0 ·
  knowledge-graph 17/17.
- ESLint `--max-warnings 0` clean · `bunx prettier --check .` clean ·
  `bun run lint:md` clean (0 errors across the whole repo).
