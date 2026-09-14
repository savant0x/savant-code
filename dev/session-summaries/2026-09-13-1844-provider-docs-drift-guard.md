# Session Summary: 2026-09-13 18:44

**Session ID:** 2026-09-13-1844-provider-docs-drift-guard
**Status:** completed

---

## Initial State

- **OS:** Windows (Git Bash)
- **Branch:** main (clean at session start; v0.0.31 just pushed)
- **Last Commit:** docs(fid): close out FID-2026-0913-004

### Operator Request

Post-0.0.31-release: "looking at the readme, it did not update all the
providers."

---

## Planned Work (intent log — ECHO Law 8)

1. [x] RED: catalog provider-surface drift vs `PROVIDER_REGISTRY` (16 providers)
2. [ ] GREEN: extend `scripts/generate-provider-reference.ts` to render the
   top-level `README.md` provider table between GENERATED markers (third
   generated surface; enriched `TABLE_NOTES` becomes the one truth for both
   tables)
3. [ ] GREEN: hand-sync the surfaces the generator cannot own:
   `README.zh-CN.md` (table, bullet, quick-start), `README.md` bullet +
   quick-start command/env list, `docs/index.md` bullet,
   `docs/sdk-overview.md` dispatch prefixes + env-var row,
   `cli/release/README.md` shell examples (legacy `OPENCODE_GO_API_KEY` →
   canonical `OPENCODE_API_KEY`) + dotenv block
4. [ ] GREEN: fix 4 dead `docs/design/Adding New Providers.md` links
   (moved to `docs/archive/design/` in the v0.0.24 audit)
5. [x] GREEN: drift test `scripts/__tests__/provider-docs-drift.test.ts`
   (4 tests / 45 expects, RED-first: stale-fixture + missing-anchor pins —
   final shape tests the pure `handSurfaceDrift()` module directly rather
   than spawning the generator)
6. [x] FID-2026-0913-005 authored (2 loops) → verified → closed + archived
7. [x] Loop 2: `lint:md` exposed a latent table-token defect — markers
   between the delimiter row and body rows terminate the markdown table
   token (shipped broken in `cli/release/README.md` since the generator's
   introduction, masked by that file's line-1 file-wide MD013 disable);
   fixed by rendering the ENTIRE contiguous table (header + delimiter +
   rows) inside the markers (`renderProviderTable`)

## Work Completed (all verified with tool output)

- `scripts/generate-provider-reference.ts` — 3 GENERATED surfaces
  (SURFACES table), enriched TABLE_NOTES (16 entries, withdrawal-era
  entries dropped), `renderProviderTable()` full-table rendering,
  `--check` runs `handSurfaceDrift()` and exits 1 on any finding
- `scripts/provider-docs-drift.ts` (NEW) — 8 WINDOW_CHECKS + 5
  FILE_CHECKS over every hand-maintained provider-doc surface; missing
  anchors/files reported as drift; injectable root for tests
- `scripts/__tests__/provider-docs-drift.test.ts` (NEW) — 4/4 pass,
  45 expects
- Doc syncs: README.md, README.zh-CN.md, docs/index.md,
  docs/sdk-overview.md, cli/release/README.md (legacy key → canonical,
  dotenv completed), 4 dead runbook links re-pointed
- FID-2026-0913-005: Verifier PASS (8/9 quoted evidence; 1 bookkeeping
  FAIL remediated in Loop 2 self-correct: 69 findings recount, masking
  mechanism named, MQ#3 corrected, status → verified)

## Validation Results

- `bun run generate:provider-docs:check` exit 0 (was 69 findings)
- `bun test scripts/__tests__/provider-docs-drift.test.ts` 4/0 (45
  expects)
- `bun run lint:md` exit 0 (Loop-2 fix); `bun x eslint .
  --max-warnings 0` exit 0; `bunx prettier --check .` exit 0
- `bun run fid:verify ... --write` both gates PASS, receipt re-stamped
  3× (fresh fingerprint each FID edit)
- `bun run validate:repository` PASS

## Lessons Learned

- A drift gate covering only its generator's own surfaces is silent about
  every other surface the registry feeds: every consumer surface is
  either GENERATED (markers) or PINNED (presence tokens between stable
  anchors); "hand-maintained and hope" is the forbidden third category.
- An HTML comment between a markdown table's delimiter row and its body
  rows terminates the table token — GENERATED markers must wrap the ENTIRE
  table. The defect shipped invisibly for two releases behind a file-wide
  lint disable.
- The `fid:verify` gates parser strips fenced blocks and rejects ALL
  prose inside `## Verification Gates` — gates must be plain `- gate:`
  lines (three failed stamp attempts before the shape converged).

## RED Findings (evidence)

Registry ground truth: 16 providers (14 setup-available) in
`common/src/providers/registry.ts` + `registry-partitioned.ts`.

| Surface | Missing |
|---|---|
| README.md L159-169 table (9 rows) | KiosAPI, APInex, OrcaRouter, B.AI, HCNSec, TokenBom |
| README.md L513 bullet | OrcaRouter, B.AI, HCNSec, TokenBom |
| README.md L243-253 quick-start cmds/env | 8 providers |
| README.zh-CN.md table + bullet + quick-start | same |
| docs/index.md L82 bullet | 4 |
| docs/sdk-overview.md L279 prefixes + L291 env row | 4 prefixes + 4 env vars |
| cli/release/README.md shell examples | legacy OPENCODE_GO_API_KEY as primary; dotenv "complete surface" block missing 6 gateways |
| 4 dead links | docs/design/Adding New Providers.md → docs/archive/design/ |

Root cause: generator covers only `.env.example` + `cli/release/README.md`;
every other surface hand-maintained (matches LEARNINGS 2026-08-10
generator-not-mirrors rule).

Current/no-action: `.env.example`, generated release table,
`docs/installation.md`, `docs/features.md`.

## Approval

Operator selected **Sync + generator guard** (ask_user, this session).