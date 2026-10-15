# FID: docs/providers.md as a generated full-registry reference

**Filename:** `FID-2026-1005-004-provider-registry-reference.md`
**ID:** FID-2026-1005-004
**Severity:** low
**Status:** closed (implemented + verified, 2026-10-05, commit 7da0a55f)
**Created:** 2026-10-05 00:55
**Automation level:** 3
**YAGNI-Compliance:** Yes — extend the existing generated-surface mechanism and one focused pin suite.

> **Operator directive (verbatim):** *"audit docs/providers.md, enhance it to
> full registry"*. Design decisions confirmed by the operator via structured
> question: **generated** — a 4th byte-exact surface in the provider-docs
> generator, not a hand-written table — and **full registry table +
> notable-provider notes**, not a subsection per provider.

## Summary

`docs/providers.md` is the human-facing provider reference, and it documented
**4 of the 24** registry providers (CodeCraft, xKiro, Clean APIs, Intern
InkStone). Before this partial implementation, it was the **only**
provider-doc surface with no drift guard:
`scripts/provider-docs-drift.ts` pins 13 tokens across README (3),
README.zh-CN (4), `cli/release/README.md` (1), `docs/index.md`,
`docs/sdk-overview.md` (2), `docs/installation.md` and `docs/features.md` —
and `docs/providers.md` appears in neither `WINDOW_CHECKS` nor `FILE_CHECKS`.
That is *how* it reached 4/24: a provider could land without touching it, with
no gate failing.

Fix: add a **4th byte-exact generated surface** — a registry table rendered
from `PROVIDER_REGISTRY` between markers in `docs/providers.md` — plus the
notable-provider notes. Drift becomes structurally impossible, matching the
mechanism that already owns `.env.example`, `cli/release/README.md` and
`README.md` (the last of which drifted two releases behind until a generator
owned it — FID-2026-0913-005).

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `scripts/generate-provider-reference.ts` (the generator),
  `docs/providers.md` (the doc), a new `scripts/__tests__/provider-registry-doc.test.ts`
- **Governance:** ECHO Protocol v0.2.0, FID-bound, Laws 1/3/4

## Detailed Description

### The audit — four findings

1. **Coverage 4/24.** Absent: `openrouter`, `tokenrouter`, `tokenharbor`,
   `nvidia`, `commandcode`, `nous`, `cloudflare`, `ollama`, `kiosapi`,
   `apinex`, `orcarouter`, `bai`, `hcnsec`, `tokenbom`, `infron`,
   `unorouter`, `bazaarlink`, `atria`, `openai`, `vercel`.
2. **No passing drift guard.** The historical hand-surface checks omit
   `docs/providers.md`. The working-tree generator now registers it as a
   fourth surface, but `--check` fails because the document has no markers.
3. **Missing registry dimensions.** Nothing on `kind` (gateway vs local), the
   dual-credential seam (Cloudflare), the OpenRouter resolver chain,
   multi-protocol dispatch (CommandCode / TokenRouter / xKiro), catalog
   source (`static` / `live` / `none`), or the local runtime (Ollama).
4. **Structural.** The heading `## CodeCraft API, xKiro, CleanAPIs, and
   Intern InkStone` is a grab-bag that grew one provider at a time.

In-pass repair already applied: the "Adding another provider" section linked
`archive/design/Adding%20New%20Providers.md` — the **archived, superseded**
runbook — instead of the live `adding-a-provider.md`.

### Why generated, not hand-written

The generator's own header states the rule: *"Hand-maintained surfaces cannot
be byte-rendered."* The measured precedent is `README.md`'s provider table,
which **drifted two releases behind the registry** because no generator owned
it (FID-2026-0913-005). A hand-written 24-row table would become the 21st
unguarded surface and repeat that failure on a larger scale.

### Adjacent finding, recorded not fixed

`scripts/__tests__/` is referenced by **no** chain: `package.json`,
`scripts/validation-gates.ts`, `scripts/validation-manifest.ts` and
`.githooks/pre-push` all return nothing for `scripts/__tests__`. The 28 suites
there (including `provider-docs-drift.test.ts`) are orphaned — they run only
when a FID declares one as a `gate: test`. This FID's new suite is therefore
declared as a gate so it has a real execution path.

## Impact Assessment

### Affected Components

- `scripts/generate-provider-reference.ts` — new `renderRegistryTable()`,
  the 4th `SURFACES` entry, and an `import.meta.main` guard so the render
  function is importable without executing the writer
- `docs/providers.md` — restructured: generated registry table + notable notes
- `scripts/__tests__/provider-registry-doc.test.ts` — new pin suite

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] **Low** — additive doc generation. The generator's three existing
  surfaces are untouched; `main()` still runs when the script is invoked
  directly (`import.meta.main` is true under `bun run`).

## Proposed Solution

### Steps

1. Add `renderRegistryTable()` to `scripts/generate-provider-reference.ts`,
   rendering one row per registry entry from `ProviderConfig` alone:
   label, id, kind, credential env var(s), API root, protocol (with the
   protocol-map name where one applies), and catalog source (with the static
   model count via `MODEL_CATALOGS`).
2. Register the 4th surface: `docs/providers.md` between
   `<!-- GENERATED:registry-table-start -->` and
   `<!-- GENERATED:registry-table-end -->`.
3. Guard `main()` with `if (import.meta.main) main()` and export the renderer
   so a test can pin it.
4. Restructure `docs/providers.md`: keep the intro, replace the grab-bag
   section with a `## Built-in provider registry` section carrying the
   generated table plus notable-provider notes, and preserve the existing
   model-picker / model-information / SDK-hosts / runbook sections.
5. New pin suite `scripts/__tests__/provider-registry-doc.test.ts`.
6. Correct the generator comment that still says “three” byte-exact surfaces,
   then run generation and verify that all 24 registry rows, credentials,
   protocols, and catalog source values come from the registry.

### Verification

`bun run generate:provider-docs` (regenerate), `generate:provider-docs:check`
(the validation gate at `scripts/validation-gates.ts:239`), `bun test` on the
new suite, `bun run typecheck:scripts`, `lint:md`, `prettier --check`,
`validate:repository`.

## Verification Gates

- gate: typecheck common
- gate: test scripts/__tests__/provider-registry-doc.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Catalogued before any edit. (a) 4 of 24 providers documented.
  (b) `docs/providers.md` is absent from both `WINDOW_CHECKS` and
  `FILE_CHECKS` in `scripts/provider-docs-drift.ts`, so it is the only
  unguarded provider-doc surface. (c) `scripts/__tests__/` is unreferenced by
  `package.json`, `validation-gates.ts`, `validation-manifest.ts` and
  `.githooks/pre-push`. (d) The "Adding another provider" section linked the
  archived runbook (repaired in-pass).
- **GREEN:** Pending implementation.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** n/a (initial authoring).

### Loop 2 — partial-implementation audit, 2026-10-05

- **RED:** `scripts/generate-provider-reference.ts` now contains an exported
  `renderRegistryTable()`, a fourth `SURFACES` entry, and an
  `if (import.meta.main) main()` guard. `docs/providers.md` still has no
  generated markers, and the proposed pin test file does not exist. The
  generator's “three byte-exact surfaces” comment is stale. Registry count
  remains 24.
- **GREEN:** Finish the document markers/table/notes and the pin suite using
  the existing generator. Update the stale count comment, generate the file,
  and keep the original three surfaces byte-identical. Retain the already
  repaired runbook link.
- **AUDIT:** `bun run generate:provider-docs:check` **fails (exit 1)** with
  `STALE: docs/providers.md — Markers not found`; this is the decisive
  implementation gate. `bun run typecheck:scripts` passes. Existing
  `provider-docs-drift.test.ts` has **4 pass, 0 fail**, but cannot settle the
  ungenerated fourth surface. The new pin suite is absent, so no test result
  is claimed for it.
- **ADVERSARIAL:** Registering a surface is not a completed drift guard while
  markers are absent. The old `WINDOW_CHECKS`/`FILE_CHECKS` absence explains
  historical drift but is no longer the whole current state. A generated
  24-row table still needs a test that distinguishes registry values from
  hard-coded strings and preserves notable behavior outside the table.
- **CHANGE DELTA:** Corrected historical/current guard language, recorded the
  failing check, and added the stale-comment and registry-value checks.

### Loop 3 — concurrent working-tree update and re-audit, 2026-10-05

- **RED:** While this audit ran, `docs/providers.md` gained the markers,
  24-row table, and notable-provider notes; the new pin suite appeared.
  `scripts/generate-provider-reference.ts:258` still says “three” surfaces
  although `SURFACES` now has four.
- **GREEN:** Keep the generated document and pin suite. Correct the stale
  generator comment and strengthen the pin suite or static audit so changes
  to credential, API root, protocol, kind, and catalog source are checked
  against registry values, not only label/ID and overall generated equality.
- **AUDIT:** Repeated `bun run generate:provider-docs:check`: **exit 0**,
  “Provider reference docs are up to date.” New
  `provider-registry-doc.test.ts`: **4 pass, 0 fail**; scripts typecheck:
  **exit 0**. Full root typecheck and Markdown lint also pass. The suite
  checks row count, label/ID, singular/plural, and committed generated
  equality; it does not independently assert each remaining column.
- **ADVERSARIAL:** A byte-exact comparison to a generator can pass while
  the generator maps a registry field incorrectly. Source inspection shows
  `renderRegistryTable()` uses `ProviderConfig` and `MODEL_CATALOGS`, but
  a direct field-level assertion would keep that contract from regressing.
  The stale comment is small but contradicts the four-surface design.
- **CHANGE DELTA:** Replaced the transient missing-marker failure with the
  current passing result and narrowed the remaining review items.

### Missed Questions

1. **Why not simply extend `handSurfaceDrift()` to cover this file?** Because a
   token-presence window proves only that a provider's name appears — it
   cannot verify the base URL, protocol, or catalog source, which are the
   columns that make this a *registry* reference. The generator's byte-exact
   comparison covers the whole table.
2. **Does adding a 4th surface risk the existing three?** No: `renderBetween`
   is per-surface, and a missing marker throws for that surface only. The
   markers are added to `docs/providers.md` in this change.
3. **Does `import.meta.main` change how the npm script runs?** No — it is true
   under `bun run scripts/…`, so `generate:provider-docs` and its `--check`
   variant behave identically. It only stops an `import` from executing the
   writer.
4. **Is `MODEL_CATALOGS` importable from a script?** Yes —
   `common/package.json` exports `"./*": "./src/*.ts"`, so
   `@savant-code/common/providers/model-catalogs` resolves.
5. **Is the wide table MD013-safe?** Yes — `.markdownlint.json` sets
   `MD013.tables: false` and `default: false`, so table rows are exempt.

### Loop 4 — completion audit and closure, 2026-10-05

- **RED:** The Loop 3 remaining items were (a) the stale generator comment
  saying "three" surfaces and (b) field-level pin coverage. Re-grepped
  `scripts/generate-provider-reference.ts` and `scripts/provider-tables.ts`
  for "three" — **zero matches**; the header and the `SURFACES` comment
  both already say "four". The stale-comment item was already resolved
  in the working tree and the FID's claim was outdated.
- **GREEN:** Strengthen the pin suite so each registry dimension is asserted
  against the registry value, not only label/ID and overall generated
  equality. Added a per-row test iterating `orderedProviders()` (the
  existing typed accessor — `Object.values(PROVIDER_REGISTRY)` yields
  literal types that lack optional fields) asserting kind, credential env
  var(s) (or the em dash for keyless Ollama), API root, protocol +
  dispatch-map name, and catalog source + model count.
- **AUDIT:** `bun test scripts/__tests__/provider-registry-doc.test.ts`:
  **5 pass, 0 fail** (181 expect calls) including the new field-level test.
  `bun run typecheck:scripts`: **exit 0**. `bun x eslint` on the changed
  files: **0 warnings**. `bun x prettier --check`: **clean**.
  `bun run generate:provider-docs:check`: **exit 0**, "Provider reference
  docs are up to date."
- **ADVERSARIAL:** A byte-exact comparison to a generator can pass while
  the generator maps a field incorrectly; the new per-row assertions close
  that gap by checking each column against the registry value directly.
  The stale-comment claim was verified against the tree before being
  marked resolved — FID metadata is a claim, code is ground truth.
- **CHANGE DELTA:** Closed the field-level pin gap; verified (rather than
  assumed) the stale-comment item was already fixed.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `7da0a55f` — docs(providers): add runbook and registry table
- [x] **File:line ranges:** `scripts/__tests__/provider-registry-doc.test.ts`
      (new field-level pin test, lines 86-127);
      `scripts/generate-provider-reference.ts` (renderRegistryTable +
      4th surface, from Loop 2/3); `docs/providers.md` (generated table,
      from Loop 3).
- [x] **Gate output:** 5/5 pin-suite tests pass; typecheck:scripts exit 0;
      eslint 0 warnings; prettier clean; generate:provider-docs:check
      exit 0.
- [x] **Reproducibility:** `bun run generate:provider-docs:check` is the
      deterministic drift guard; the pin suite is hermetic.
- [x] **Step statuses:** all steps complete (see Step Status).

### Code Verification Evidence

> Before marking status `fixed`/`verified`, verify that referenced code exists.
> FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist — verified against the
      working tree (Loop 4 re-grep for the stale comment: zero matches).
- [x] Implementation matches the Proposed Solution — generator,
      4th surface, markers, notable notes, and pin suite all present;
      field-level pins added in Loop 4.
- [x] Typecheck/tests/lint pass with pasted tool output — 5/5 tests,
      typecheck exit 0, eslint 0, prettier clean, docs check exit 0
      (Loop 4 AUDIT).
- [x] Production call-graph evidence is present for new or repaired wiring
      — `renderRegistryTable` is called by the 4th SURFACES entry in
      `generate-provider-reference.ts` and imported by the pin suite.
- [x] FID status reflects the actual implementation state — `closed` with
      implementation evidence and passing gates.

## Step Status

- [x] `renderRegistryTable()` added and exported (working tree)
- [x] 4th generated surface registered for `docs/providers.md` (working tree)
- [x] `main()` guarded with `import.meta.main` (working tree)
- [x] `docs/providers.md` restructured with markers + notable notes
- [x] New pin suite authored
- [x] Correct stale generator comment and pin every registry dimension
      (completed as the two verbatim items below; the unchecked duplicate was
      stale — both halves verified 2026-10-05)
- [x] Regenerate + verify (docs check, test, typecheck, lint:md, prettier)
- [x] Correct stale generator comment (verified already fixed via grep)
- [x] Pin every registry dimension (field-level per-row test added)

## Resolution

- **Closed Date:** 2026-10-05
- **Fix Description:** `docs/providers.md` now carries a generated 24-row
  registry table (label, id, kind, credential, API root, protocol, catalog
  source) between markers, rendered from `PROVIDER_REGISTRY` by the 4th
  generator surface. The pin suite asserts every registry dimension per row
  against registry values, and `generate:provider-docs:check` fails closed
  on drift.
- **Tests Added:** `scripts/__tests__/provider-registry-doc.test.ts` —
  5 tests incl. the field-level per-row dimension pin.
- **Verification Evidence:** 5/5 tests pass; typecheck:scripts exit 0;
  eslint 0 warnings; prettier clean; generate:provider-docs:check
  exit 0; full root typecheck and lint:md pass.
- **Archived:** 2026-10-05 (moved to `dev/fids/archive/`).

## Lessons Learned

- **An unguarded doc surface documents whatever it documented the day it was
  written.** `docs/providers.md` was not wrong — it was *unwatched*, and 20
  providers landed without it. The absence of a gate is the finding.
- **The generator's own header had already stated the fix.** "Hand-maintained
  surfaces cannot be byte-rendered" is the rule this file was silently exempt
  from; the README table's two-release drift (FID-2026-0913-005) is the
  measured cost of that exemption.
