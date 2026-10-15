# FID: Graph-Export File Decomposition — template.ts + export-serializer.ts

**Filename:** `FID-2026-0809-011-graph-export-file-decomposition.md`
**ID:** FID-2026-0809-011
**Severity:** low
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified

---

## Summary

The 2026-08-09 deep audit flagged two oversized source files well above the
advisory 300-line quality bar (`protocol.config.yaml` → `quality.max_file_lines`,
advisory only): `cli/src/commands/graph-export/template.ts` (1,883 lines) and
`packages/knowledge-graph/src/export-serializer.ts` (1,096 lines). This FID
documents the decomposition plan for both. It is a maintainability plan only —
no behavior change is proposed, and no implementation is performed here.

## Environment

- **OS:** Windows 11 (win32) / bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** working tree at pending `0.0.23`

## Detailed Description

### Problem

Both files exceed the advisory quality bar and concentrate a large surface in a
single module:

- `cli/src/commands/graph-export/template.ts` — 1,883 lines. One exported
  function (`buildGraphExportHtml`, lines 77–1876) plus `UNIVERSE_CSS` (1877).
  The single ~1,800-line function assembles the entire Code Universe HTML
  artifact: graph payload serialization handoff, layout invocation, document
  embedding, HTML assembly, and a large inline browser `<script>` containing the
  whole Sigma/Graphology universe app (state machine, planet effects, audio,
  search, tooltips, keyboard nav — ~40 inline functions inside one template
  literal).
- `packages/knowledge-graph/src/export-serializer.ts` — 1,096 lines. ~25
  exported interfaces/types (26–270), constants (272–302), ~20 private helpers
  (304–903), and two exported entry points (`readFilePreview` 904,
  `serializeGraphForExport` 937).

### Expected Behavior

Maintainable files at or near the advisory 300-line bar with clear module
boundaries, without changing the exported contract (`buildGraphExportHtml`,
`serializeGraphForExport`, `readFilePreview`, all exported types).

### Root Cause

Organic growth: the Code Universe feature (FIDs 0806-017/018, 0807-001…024)
accumulated features directly into the existing template/serializer modules
rather than decomposing as it grew. The advisory quality gate has no
enforcement, so nothing stopped the drift.

### Evidence

```text
$ find ... | xargs wc -l | sort -rn | head
  1883 cli/src/commands/graph-export/template.ts
  1096 packages/knowledge-graph/src/export-serializer.ts

template.ts structure (grep of top-level decls):
  20  function buildAmbientSpaceMarkup(): string
  58  function envPositiveInt(name: string): number | undefined
  77  export async function buildGraphExportHtml(...)   <- lines 77-1876
  1877 const UNIVERSE_CSS = `...

export-serializer.ts structure:
  26-270  ~25 exported interfaces/types
  272-302 constants
  304-903 ~20 private helpers
  904     export function readFilePreview
  937     export function serializeGraphForExport
```

## Impact Assessment

### Affected Components

- `cli/src/commands/graph-export/template.ts`
- `packages/knowledge-graph/src/export-serializer.ts`
- `packages/knowledge-graph/src/index.ts` (re-exports `export * from './export-serializer'`, line 22)
- `cli/src/commands/__tests__/graph-export.test.ts` (41 tests / 428
  assertions — the actual serializer + HTML contract surface; there is **no**
  dedicated serializer test file under
  `packages/knowledge-graph/src/__tests__/`, which contains only
  clusters/schema/update tests)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach — Phase A: `export-serializer.ts` (lower risk, pure functions)

Split by cohesion into three modules under `packages/knowledge-graph/src/export/`:

1. `export/types.ts` — the ~25 interfaces (GraphPosition … GraphExportOptions),
   re-exported from the package index for backward compatibility.
2. `export/helpers.ts` — the ~20 private helpers (stableHash, regionPath,
   regionId, folderId, truncateUtf8, readProbeBytes, readBinarySignature,
   positiveLimit, countLines, unavailableDocument, hasSignature, fileDocument,
   buildHierarchy, buildUniverse).
3. `export/serialize.ts` — `serializeGraphForExport` + constants, importing
   helpers/types. **Correction from Loop-2 RED:** `readFilePreview` moves to
   `export/helpers.ts` instead, because it is called from inside the private
   helper region (export-serializer.ts:822, inside a per-node loop) as well as
   from `serializeGraphForExport` (line 1048). Placing it in `helpers.ts`
   avoids a circular `helpers → serialize → helpers` import.

Backward compatibility: keep `export-serializer.ts` as a thin re-export barrel
so all existing imports (`@savant-code/knowledge-graph/export-serializer` or
internal relative paths) keep working — Law 4 reachability preserved.

### Approach — Phase B: `template.ts` (higher risk, generated artifact)

The 1,800-line `buildGraphExportHtml` mixes three concerns:

1. **Pipeline orchestration** (lock, index refresh, serialize, layout, embed,
   assemble, progress) — extract to a `build-graph-export.ts` orchestrator that
   calls the existing serializers.
2. **HTML shell + CSS** — `UNIVERSE_CSS` already exists; extract static shell
   sections (head, header, status bar, panels) into builder functions or a
   `html-template.ts` module.
3. **Inline browser app script** — the ~40 functions inside the template literal
   are a separate browser-side app. Extract to a dedicated module
   `universe-app-script.ts` that exports the script as a string constant
   (template-literal-safe; reuse the pattern already proven by
   `cli/src/constants/cytoscape.ts` / generated `character.ts` for embedding
   large script payloads), then `buildGraphExportHtml` interpolates it. This is
   the highest-value slice: it removes ~1,200 lines from the file.

Explicitly out of scope: no runtime behavior change, no CSS visual change, no
script logic change. Each slice must be verified by the existing 40+ graph-export
tests (deterministic artifact regeneration) before the next slice lands.

### Steps

1. Phase A-1: move types → `export/types.ts` + barrel re-export; run
   knowledge-graph typecheck + serializer tests.
2. Phase A-2: move helpers → `export/helpers.ts`; re-run tests.
3. Phase A-3: move `serializeGraphForExport` + constants → `export/serialize.ts`;
   run knowledge-graph suite **and** the CLI graph-export suite (41 tests / 428
   assertions — the serializer's only direct tests live in the CLI package,
   `cli/src/commands/__tests__/graph-export.test.ts`, not under
   `packages/knowledge-graph/src/__tests__/`) + `generate:provider-docs:check`
   unaffected (no shared surface).
4. Phase B-0: pre-audit the inline script for `${...}` interpolations that
   reference `buildGraphExportHtml` scope (embedded graph JSON payload, layout
   options, progress callbacks) — the script sits inside the template literal
   at template.ts:77–1876 and performs the "graph payload serialization
   handoff". If any interpolations exist, define the seam first (placeholder
   tokens interpolated at the call site, or a function that takes the payload),
   *then* lift the static remainder to `universe-app-script.ts`. Only claim
   "zero runtime change" after this pre-audit passes.
5. Phase B-1: extract browser script to `universe-app-script.ts`; regenerate the
   deterministic artifact and diff byte-for-byte.
6. Phase B-2: extract orchestration + shell builders; re-run CLI graph-export
   suite (40+ tests, 428+ assertions) and Chrome `file://` probe.
7. Each phase: typecheck (cli + knowledge-graph), eslint, prettier,
   markdownlint.

### Verification

- `bun run --cwd=packages/knowledge-graph typecheck && bun test`
- `bun run --cwd=cli typecheck && bun test` (graph-export focused)
- `bun x eslint . --max-warnings 0`; `bunx prettier --check .`
- Deterministic artifact regeneration: double export SHA-256 equality
- `git grep` for the old module paths → only the new barrel re-exports

## Perfection Loop

### Loop 1

- **RED:** Two files exceed the advisory 300-line bar; 1,883-line single
  function and 1,096-line module confirmed by line-count evidence.
- **GREEN:** Decomposition plan above; backward-compatible barrel first,
  script-extraction highest-value slice.
- **AUDIT:** Plan verified against actual file structure (top-level decls greps
  above); exported contracts identified and preserved.
- **CHANGE DELTA:** 0% (plan only — no code changed).

### Loop 2 (operator-requested perfection-loop run, 2026-08-09)

- **RED (evidence re-verification):**
  - `template.ts` = 1,883 lines; `buildGraphExportHtml` spans 77–1876;
    `UNIVERSE_CSS` at 1877. ✅ Confirmed.
  - `export-serializer.ts` = 1,096 lines; ~25 exported interfaces (26–270),
    constants (272–302), ~20 private helpers (304–903), `readFilePreview` (904),
    `serializeGraphForExport` (937). ✅ Confirmed.
  - Test surface: `cli/src/commands/__tests__/graph-export.test.ts` = **41
    tests, 428 assertions** (verified by grep), and it is the only direct
    consumer of `serializeGraphForExport` in tests (lines 747, 1375, 1468,
    1473). `packages/knowledge-graph/src/__tests__/` contains **no serializer
    tests** (clusters=4, schema=5, update=9). ⚠️ FID claim corrected.
  - `readFilePreview` is called internally at export-serializer.ts:822 (helper
    region) and :1048 (`serializeGraphForExport`). ⚠️ Phase-A placement
    corrected (see Phase A-3).
  - Consumers import the serializer via the package index
    (`export * from './export-serializer'` at index.ts:22); CLI
    `template.ts:3` imports `serializeGraphForExport` by name. ✅ Barrel
    strategy preserves Law-4 reachability.
- **GREEN (converged corrections):** Phase A-3 revised so `readFilePreview`
  lives in `export/helpers.ts`; Affected Components corrected to reflect the
  real test surface; Steps renumbered to add Phase B-0 (interpolation
  pre-audit) and to run the CLI graph-export suite after every Phase A slice.
  Plan otherwise unchanged.
- **AUDIT:** Corrections traced to file:line evidence above; exported contract
  (`buildGraphExportHtml`, `serializeGraphForExport`, `readFilePreview`, all
  exported types) still fully preserved by the barrel. Independent review
  confirmed: (1) serializer tests live only in the CLI suite, so Phase A
  slices must gate on it; (2) the script lift is only "mechanical" after a
  `${...}` pre-audit — both now folded into Steps.
- **CHANGE DELTA:** 0% code (plan-only FID updated with corrected evidence).

### Missed Questions

1. Does any external consumer import the internal helper functions directly? →
   No: `readFilePreview`/`serializeGraphForExport` are the only exports;
   helpers are private (file-scoped). Barrel preserves both entry points. Loop
   2 added: `readFilePreview` has *internal* callers in the helper region, so
   it must ship with helpers to avoid a circular import.
2. Is the inline browser script truly static? → Yes, it is embedded in a
   template literal; extraction is a mechanical string lift with no runtime
   change.
3. Would splitting break the deterministic-artifact gate? → Only if behavior
   changes; byte-diff after each phase catches any drift (same gate the feature
   has used since FID-2026-0807-020).

### Loop 3 (implementation, 2026-08-09, operator automation level 3)

- **GREEN (implementation executed):**
  - **Phase A** — `export-serializer.ts` (1,096 ln) split into
    `export/types.ts` (250 ln), `export/helpers.ts` (691 ln),
    `export/serialize.ts` (196 ln). `export-serializer.ts` is now a
    **restricted barrel** re-exporting only the original public surface
    (payload types + `readFilePreview` + `serializeGraphForExport`) so no
    internal helper symbols leak into `@savant-code/knowledge-graph`.
    `readFilePreview` lives in `helpers.ts` per the Loop-2 circular-import
    correction.
  - **Phase B** — `template.ts` (1,883 ln) split into: `template.ts` (48 ln
    thin entry), `build-graph-export.ts` (orchestrator: lock, index refresh,
    serialize ×2, layout, embed, compress), `html-sections.ts` (shell +
    ambient markup, 158 ln), `universe-css.ts` (CSS), and
    `universe-app-script.ts` (~1,617 ln inline browser app, verbatim lift with
    zero `${`/backticks/backslashes in the region).
- **AUDIT (independent review):** Two findings fixed — (1) the barrel
  previously leaked 4 internal exports via `export *`; corrected to a
  restricted barrel; (2) the `reportProgress` wrapper was duplicated;
  extracted as shared `reportGraphExportProgress`. All other claims
  confirmed: no import cycles, progress-stage order preserved, no dead code,
  import order per eslint config.
- **Byte-identity proof:** the rendered artifact was generated against the
  original git-HEAD `template.ts` and against the decomposed modules; both
  SHA-256 `6c30836d587778001e0c44b7fc4319eeb8484003fe3cefbfe2180217d65262e2`
  at 1,561,975 bytes (embedded `generatedAt` timestamp normalized).
- **CHANGE DELTA:** 0% behavior — module layout only.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes: knowledge-graph + cli + evals (all exit 0)
- [x] Test gates: graph-export suite 41 tests / 428 assertions, knowledge-graph
      18 tests / 62 assertions, all pass
- [x] Lint gates: eslint `--max-warnings 0` pass, prettier pass
- [x] Deterministic artifact: SHA-256 equality pre/post decomposition
- [x] FID status reflects closed state: `closed (2026-08-09 — independently signed off)`

## Resolution

- **Fix Description:** Both oversized modules decomposed by cohesion with
  zero behavior change (byte-identical artifact proven). Phase A: serializer
  → types/helpers/serialize + restricted barrel. Phase B: template → thin
  entry + orchestrator + shell/css modules + lifted browser app script.
- **Fixed Date:** 2026-08-09
- **Tests Added:** none required — existing suite is the gate (41 tests /
  428 assertions graph-export; 18 tests / 62 assertions knowledge-graph);
  byte-identity SHA-256 comparison executed as the decomposition guard.
- **Commit/PR:** uncommitted working tree (pending 0.0.23)
- **Independent audit:** PASS recorded in
  `dev/nova/inbox/2026-08-09-fid-2026-0809-011-graph-export-file-decomposition-nova-audit-response.md`
  (2026-08-09).
- **Archived:** 2026-08-09 → `dev/fids/archive/FID-2026-0809-011-graph-export-file-decomposition.md`

## Lessons Learned

Oversized single-function modules are a drift tax: every new Code Universe
feature landed in the same template/serializer because the advisory quality gate
is unenforced. Options for prevention: (1) split the advisory `max_file_lines`
into a tracked `DEBT.md`/YAGNI ledger item when a file crosses the bar, or (2)
add a CI warning (not hard gate) that lists files above the bar so growth is
visible. Do not hard-gate without first decomposing the existing outliers.

## Closure Evidence

- **FID:** FID-2026-0809-011
- **Closed:** 2026-08-09 — all review boundaries resolved
- **Implementation audit:** PASS; independent response cited above
  (`dev/nova/inbox/2026-08-09-fid-2026-0809-011-graph-export-file-decomposition-nova-audit-response.md`).
- **Nova verification highlights:** dependency chain strictly acyclic
  (`types → helpers → serialize`); restricted barrel re-exports only the
  original public surface (no leak of `DEFAULT_DOCUMENT_IMAGE_BYTES`,
  `DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES`, `positiveLimit`, `buildUniverse`);
  `readFilePreview` callers resolve within `helpers.ts`; script constant is a
  verbatim lift (zero `${`/backtick interpolations in the 1,606-line body);
  progress-stage ordering preserved (Refresh → Serialize → Layout → Embed →
  Compress → Assembling); `buildGraphExportHtml` exported contract unchanged.
- **Byte-identity gate:** artifact SHA-256
  `6c30836d587778001e0c44b7fc4319eeb8484003fe3cefbfe2180217d65262e2` at
  1,561,975 bytes identical pre/post decomposition (generatedAt normalized).
- **Scope containment:** only the two FID-named files decomposed; no behavior,
  release state, credentials, or remote state changed; no commit, push,
  publication, or deployment performed.
- **Documentation policy:** no-signature/no-attribution policy followed;
  outbox sign-off request archived and audit response recorded in the Nova
  channel.
