# FID: Install-independent undeclared-import guard (T188)

**Filename:** `FID-2026-1011-004-install-independent-undeclared-import-guard.md`
**ID:** FID-2026-1011-004
**Severity:** high
**Status:** closed
**Created:** 2026-10-11 00:00
**Automation level:** 2

> Operator ruling received in-session: "Build the install-independent
> undeclared-import guard (T188) so this class can't reach a release again."
> That ruling is what T188 was blocked on (`SCOPE.md`), so the gate is added to
> the fail-closed release validation battery under the T186 precedent.

**YAGNI-Compliance:** Verified

---

## Summary

The repository's only defense against an undeclared dependency is the
`cli-bundle-resolution` gate, which runs `bun build` against whatever
`node_modules` exists on the machine. A contaminated or stale install therefore
defeats it — and did: at v0.0.35 every local gate was green while
`packages/connectors` imported `ajv/dist/2020.js` without declaring `ajv`, and a
leftover v8 `dist/` tree in the developer's root `node_modules` satisfied a
resolution no manifest described. CI, resolving the committed lockfile, found
only ajv 6 and failed `Could not resolve: "ajv/dist/2020.js"`.

This FID adds `undeclared-imports`: a release gate that reads only TRACKED state
(the 26 manifests and `bun.lock`) and never touches `node_modules`. It fails
when a tracked source imports a package no manifest declares and only a
transitive dependency hoists. It also clears the four real gaps it found.

## Environment

- **OS:** win32 (Windows)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Commit/State:** `main` at `ce0552da` + the working tree described below
- **Gate surface:** `scripts/validation-gates.ts` root gate contract

## Detailed Description

### Problem

Two shipped incidents, one class:

- **v0.0.24** — an undeclared `@noble/hashes` that "only resolved from a
  `node_modules` outside the repo" (`docs/public-release.md`).
- **v0.0.35** — `packages/connectors/src/engine/validate.ts:1` imported
  `ajv/dist/2020.js` while `packages/connectors/package.json` declared neither
  `ajv` nor `ajv-formats`. The only hoistable ajv was 6.15.0 (from eslint),
  which ships no `dist/2020.js`.

In both cases the local gates passed and a published artifact was broken. The
gate the repository added after v0.0.24 cannot see the class: it resolves
imports from the local `node_modules`, so a mutated one produces a green run —
which is exactly what happened at v0.0.35.

### Expected Behavior

A gate that answers the question from tracked state alone, so its verdict is
identical on a developer's machine, in a clean CI checkout and in a published
tarball. It must fail on an import nothing declares, and it must not fail on the
ordinary shapes this monorepo relies on (cross-workspace imports, a root
devDependency used by a workspace, Node/Bun builtins).

### Root Cause

Manifest membership was never checked at all. Nothing in the repository compared
an import specifier against the dependency list of the package that imports it;
the only check was the bundler's, and the bundler reads the installed tree.

### Evidence

The gate's own development trace, in the order the defects were removed:

```text
# naive import extraction (no comment/string awareness, no lockfile):
undeclared-imports FAILED — 146 undeclared registry import(s)
  ... cli/src/constants/sigma-runtime-chunks/chunk-7.ts:31  (minified payload)
  ... desktop/.../office-lazy.test.tsx:31  (regex literal)

# after the tokenizer + the tracked-lockfile provider index:
undeclared-imports FAILED — 10 import(s) of 4 package(s) no manifest declares:
- .agents/skills/savant-motion/scripts/verify/assertions.ts:9 (playwright-core)
- cli/scripts/hud-preview-browser-check.ts:6 (playwright)
- cli/src/cli-boot-steps.ts:9, cli-command-dispatch.ts:2,
  headless-outcome.ts:15, index.tsx:21 (picocolors)
- desktop/src/lib/__tests__/fixtures/{compliance,provider-notices}-browser-smoke.mjs:6
- eslint.config.js:4 (globals)

# after declaring them:
undeclared-imports PASS — every import in tracked sources is declared by a
manifest or linked by the workspace install.
```

`picocolors` is the sharpest finding: four files in `cli/src` import it, they are
bundled into the shipped binary, and no manifest declared it. Only a transitive
dependency of `pino` supplied it.

## Impact Assessment

### Affected Components

- `scripts/undeclared-imports.ts` (new — pure detector)
- `scripts/undeclared-imports-audit.ts` (new — collector + probe)
- `scripts/__tests__/undeclared-imports.test.ts` (new — 24 tests)
- `scripts/validation-gates.ts` (gate + required-label pin)
- `scripts/gate-declarability-registry.ts` (audited entry)
- `package.json` (`deps:undeclared`, `globals`, `playwright`, `playwright-core`)
- `cli/package.json` (`picocolors`)
- `scripts/tmux/package.json` (`js-yaml`, `picocolors`)
- `bun.lock` (regenerated for the declarations above)
- `cli/release-core/launcher.js` + its suite (FID-2026-1011-003 follow-on)

### Risk Level

- [x] High: Major feature broken, no workaround
- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

A pure detector plus a tracked-state collector, wired as a `probe` gate.

The detector (`scripts/undeclared-imports.ts`) makes no I/O: it extracts static
specifiers from one file's text and grades each against a supplied context.
Four tiers, and only two fail:

| Tier | Meaning | Verdict |
|---|---|---|
| `workspace` | a root `workspaces` member; bun links all of them | resolves |
| `declared` | some manifest declares it (or its `@types`) | resolves |
| `transitive` | no manifest names it; the lockfile has it only via another package | **fails** |
| `absent` | not in the lockfile either | **fails** |

`transitive` is the v0.0.35 case exactly and `absent` is the v0.0.24 case.

The collector (`scripts/undeclared-imports-audit.ts`) supplies the two facts the
detector cannot derive from text: the file list (git-tracked `*.ts *.tsx *.js
*.mjs *.cjs`, so ignores and build output are excluded by construction) and the
context (`provided` from the manifests, `installed` from `bun.lock`, `linked`
from the root `workspaces`). Nothing reads `node_modules`.

### Steps

1. Extract specifiers with a single-pass tokenizer that skips comments and
   string bodies and accepts a string as a module id only when an import keyword
   immediately precedes it. `- implemented`
2. Reject every character that can precede an import keyword inside a literal
   (`/`, `|`, `'`, `"` in addition to `\w $ .`) so a regex or a minified payload
   cannot be read as imports. `- implemented`
3. Grade each specifier against the four tiers, using the tracked lockfile as
   the second provider so a transitive dependency is reported as `transitive`
   rather than misread as `absent`. `- implemented`
4. Return `[]` for `workspace`/`declared`; emit `transitive`/`absent` as findings.
   `- implemented`
5. Wire the gate into `repositoryValidationGates`, pin the label in
   `validateGateContract`'s required set, and add the audited entry so the gate
   is declarable on a FID. `- implemented`
6. Declare the four packages the guard found (`picocolors`, `globals`,
   `playwright`/`playwright-core`) and regenerate the lockfile. `- implemented`

### Verification

- `bun scripts/undeclared-imports-audit.ts` exits 0 on the current tree.
- `scripts/__tests__/undeclared-imports.test.ts` pins the rule, the false
  positive classes, and the real-tree verdict (24 tests).
- `bun run validate:repository` accepts the new gate and its declaration.
- `bun run quality:report` passes (all three new files under 300 lines).

## Verification Gates

- gate: probe scripts/undeclared-imports-audit.ts
- gate: test scripts/__tests__/undeclared-imports.test.ts
- gate: test scripts/__tests__/gate-declarability.test.ts
- gate: test cli/src/__tests__/release/wrapper-safety-launcher.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/lockfile-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:339dd8d6636f9acc06066f2d6c7759d83a47859fb1542f8128bd30313fe42dfe
- verified: 2026-10-12T00:16:21.012Z
- probe scripts/undeclared-imports-audit.ts: exit 0
- test scripts/__tests__/undeclared-imports.test.ts: exit 0
- test scripts/__tests__/gate-declarability.test.ts: exit 0
- test cli/src/__tests__/release/wrapper-safety-launcher.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/lockfile-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The rule was first built as "the importing manifest must declare it",
  which is the literal statement of the incident. On the real tree it produced
  146 findings, and the tie between the two provider sources was not modelled:
  `cli` imports `lodash`, the root devDependencies declare it, and that resolves.
  Two false-positive classes were also live — a minified sigma payload inside a
  string literal (`cli/src/constants/sigma-runtime-chunks/chunk-7.ts`) and a
  regex literal asserting on import text
  (`desktop/src/floor/__tests__/office-lazy.test.tsx`).
- **GREEN:** Replaced regex extraction with a tokenizer that skips comments and
  string bodies; added the tracked lockfile as the second provider so only
  `transitive`/`absent` fail; broadened the import-site character class.
- **AUDIT:** 146 → 10 findings, all four packages real. `mdast` was correctly
  excluded once the `@types/mdast` alias was modelled (the package is not
  installed at all; `cli/src/utils/markdown-inline.ts` imports only its types).
- **ADVERSARIAL:** Is `transitive` too strict for this monorepo? The tree shows
  it is not: exactly four packages fail, and each one is a true statement that a
  manifest should own. Declaring them is the fix; the gate found work, not noise.
- **CHANGE DELTA:** ~100% (new gate, first draft discarded).

### Loop 2 — Independent audit and self-correction

- **RED:** The lockfile parser matched `"sha512-…@1.0.0"`-shaped strings; the
  fabricated integrity value in the unit test caught it. In the real lock no
  integrity value contains `@`, so the defect was latent, not live.
- **GREEN:** Required a semver version in the entry regex and pinned both the
  realistic integrity shape and a `weird@not-a-version` shape as ignored.
- **AUDIT:** 979 names parsed from the real lockfile, none package-shaped
  wrongly; `installedNames` is pinned against losing a name, since a lost name
  reads as `absent` and fails the gate with the wrong reason.
- **ADVERSARIAL:** The gate's verdict is only as good as its provider index. The
  index is derived from `git ls-files`, so an untracked manifest cannot lower the
  verdict, and a missing `bun.lock` fails closed with a stated reason rather than
  reporting an empty (passing) index.
- **CHANGE DELTA:** ~15% (parser + tests).

### Loop 3 — Final convergence

- **RED:** The three new files were checked against the LIVE quality ceilings
  (`protocol.config.yml` → `max_file_lines: 300`). `undeclared-imports-audit.ts`
  reached 324 after formatting and `scripts/validation-gates.ts` reached 306 from
  the gate comment — both over.
- **GREEN:** Trimmed the module header, inlined a one-use helper, and reduced the
  gate comment to its two load-bearing lines; the rationale lives in the module
  docstring and here.
- **AUDIT:** `quality: PASS (1502 baselined files)`; 299 / 263 / 247 lines.
- **ADVERSARIAL:** `quality:report` is a ratchet against a baseline, so a
  too-large file would have been caught rather than silently accepted — it was.
  The `--all` variant of the probe was REMOVED rather than kept: it had no
  caller, and an unused strict mode is a control that looks load-bearing.
- **CHANGE DELTA:** ~10% (ceiling trims).

### Missed Questions

1. **Does a workspace-internal import need a declaration?** No. `bun install`
   links every member of the root `workspaces` into the root `node_modules`
   regardless of which manifest asked, so ~3000 such imports resolve by
   construction. Failing on them would have made the gate unusable — which is
   why the tier exists and why the module documents it.
2. **Is a lockfile-only package installed?** Yes, and that is precisely the
   danger: it resolves today and disappears when someone else's dependency graph
   changes. Modelling it as `absent` would have been a false statement; modelling
   it as resolvable would have hidden the v0.0.35 precondition. It is its own
   tier, and it fails.
3. **Must a type-only import's package be installed?** No — TypeScript resolves
   `import type { X } from 'pkg'` through `@types/pkg`, which is why `mdast`
   typechecks while the `mdast` package is absent. The alias is modelled; the
   leniency for a VALUE import is documented.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** landed in the FID's own commit (see `Resolution`)
- [x] **File:line ranges:** `scripts/undeclared-imports.ts:1-247`,
      `scripts/undeclared-imports-audit.ts:1-299`,
      `scripts/__tests__/undeclared-imports.test.ts:1-263`,
      `scripts/validation-gates.ts:171-186` (gate),
      `scripts/gate-declarability-registry.ts:118-123` (audited entry)
- [x] **Gate output:** pasted under `Code Verification Evidence`
- [x] **Reproducibility:** `bun run deps:undeclared` and
      `grep -rn "undeclared-imports" scripts/ package.json`
- [x] **Step statuses:** all six Proposed Solution steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

Every PASS below is a command run against the working tree, with its exit status
read directly (no pipeline in the measured command):

```text
$ bun scripts/undeclared-imports-audit.ts                    → exit 0
undeclared-imports PASS — every import in tracked sources is declared by a
manifest or linked by the workspace install.

$ bun run deps:undeclared                                    → exit 0 (same gate, contract route)

$ cd scripts && bun test __tests__/undeclared-imports.test.ts → exit 0
 24 pass / 0 fail / 55 expect() calls

$ cd scripts && bun test __tests__/gate-declarability.test.ts \
      validation-manifest.test.ts public-release-gates.test.ts → exit 0
 24 pass / 0 fail

$ cd cli && bun test src/__tests__/release/wrapper-safety-launcher.test.ts → exit 0
 7 pass / 0 fail  (includes 'reports a failed background update instead of
                   swallowing it')

$ bun run typecheck:scripts                                  → exit 0
$ bun run validate:repository                                → exit 0
 validation: PASS
$ bun run quality:report                                     → exit 0
 quality: PASS (1502 baselined files)
$ bun x eslint <changed files> --max-warnings 0              → exit 0
$ bun x prettier --write <changed files>                     → exit 0
$ bun install --frozen-lockfile                              → exit 0
 Checked 957 installs across 1060 packages (no changes)

$ node -e '<name@version set diff, HEAD:bun.lock vs working copy>'  → 1044 / 1044
 ADDED: []   REMOVED: []
 The lockfile change is dependency EDGES (six declarations) plus two hoist
 placements — fsevents 2.3.3↔2.3.2 and js-yaml 5.2.3↔4.3.1. No package or
 version entered or left the graph; both consumers of each pair still resolve
 to the version they require (chokidar/playwright → 2.3.2, rollup/vite →
 2.3.3; markdownlint-cli → 5.2.3, @eslint/eslintrc → 4.3.1), which is
 confirmed by lint:md and eslint passing repo-wide after the install.
```

Call-graph evidence for the new wiring:

```text
scripts/validation-gates.ts:171  label: 'undeclared-imports'
  → invoked by scripts/public-release.ts via repositoryValidationGates
  → invoked by scripts/validate-repository.ts (validateGateContract)
scripts/gate-declarability-registry.ts  declarations: [probe('scripts/undeclared-imports-audit.ts')]
  → validated by scripts/gate-declarability.ts:resolveGate (repo-relative *.ts)
package.json:21  "deps:undeclared": "bun scripts/undeclared-imports-audit.ts"
```

## Resolution

- **Closed Date:** 2026-10-11
- **Fix Description:** Added the `undeclared-imports` release gate (pure
  detector + tracked-state collector + probe), pinned it in the root gate
  contract and the gate-declarability audit, and declared the four packages it
  found (`picocolors` in `cli`, `picocolors` + `js-yaml` in `scripts/tmux`,
  `globals` + `playwright` + `playwright-core` at the root), regenerating
  `bun.lock`. The launcher change from the same session (FID-2026-1011-003
  follow-on) reports a failed background update instead of swallowing it.
- **Tests Added:** Yes — `scripts/__tests__/undeclared-imports.test.ts`, 24
  tests: the incident shape, both false-positive classes, every static import
  form, specifier classification, builtins, the `@types` alias, the lockfile
  parser, the exclusion discipline, and the real-tree verdict.
- **Verification Evidence:** the gate outputs pasted above.
- **Archived:** 2026-10-11

## Lessons Learned

- **A gate that reads the installed tree cannot prove anything about a clean
  one.** `cli-bundle-resolution` was added for exactly this defect class and was
  green at v0.0.35, because it resolved against a leftover directory. The
  durable form of the check reads tracked state — manifests and the lockfile —
  so contamination is not an input.
- **"No manifest declares it" and "nothing installs it" are different facts.**
  Collapsing them produced 146 findings; separating them produced 10 real ones.
  A dependency that only a transitive edge supplies is the interesting middle
  case, and it is what shipped v0.0.35.
- **An import-shaped string is not an import.** The two largest false-positive
  classes were a minified bundle and a regex, both stored as text inside source
  files. Text-level scanning needs the tokenizer, not a better regex; a gate
  that cries wolf in the hardest-to-review files gets switched off.
- **Declaring what you import is cheap; discovering it in a release is not.**
  Four packages, six declaration lines, one lockfile regeneration.
