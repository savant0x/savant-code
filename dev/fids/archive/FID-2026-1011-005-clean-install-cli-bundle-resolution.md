# FID: cli-bundle-resolution runs against a clean install

**Filename:** `FID-2026-1011-005-clean-install-cli-bundle-resolution.md`
**ID:** FID-2026-1011-005
**Severity:** high
**Status:** closed
**Created:** 2026-10-11 00:00
**Automation level:** 2

> Operator ruling received in-session: "Make `cli-bundle-resolution` run against a
> clean install so the version/subpath half of this class is covered too." That is
> the residual half FID-2026-1011-004 named at closure (its own words: the manifest
> guard "proves a package is *declared or installed*, not that the specific *subpath
> or version* an import needs exists"), so it is built here.

**YAGNI-Compliance:** Verified

---

## Summary

The `cli-bundle-resolution` gate bundled the CLI **in the working tree**, so
`bun build` resolved imports against whatever `node_modules` the machine had. Two
consequences, both measured in this session:

- A package nothing declares and no lockfile installs — `@anthropic-ai/sdk`, present
  only in a stray `C:\Users\spenc\node_modules` — **resolved and the gate exited 0**.
- The same stray install is what supplied `ajv/dist/2020.js` at v0.0.35 while
  `packages/connectors` declared no `ajv`, so every local gate passed and all five CI
  binary jobs failed after npm had published.

The gate now bundles inside a **pristine tree**: the release file set is materialized
from git into a scratch directory, the frozen lockfile is installed there, the release
build's own prebundle steps run there, and the bundler's `--metafile` is read to prove
every module it loaded came from **that tree**. A module resolved from anywhere else —
the ancestor install above the scratch directory — is reported and fails the gate.

## Environment

- **OS:** win32 (Windows)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Commit/State:** `main` at `5db442b4` + the working tree described below
- **Gate surface:** `scripts/validation-gates.ts` root gate contract

## Detailed Description

### Problem

The gate's own verdict was environment-dependent. `bun build` resolves a bare
specifier by walking **up** from each importing file, so every `node_modules` above
the tree participates. Because the gate ran in the repository root, the developer's
profile-level `node_modules` (428 packages) was part of its resolution set while CI's
clean checkout — resolving the committed lockfile — was not. The gate could therefore
pass on a tree whose release cannot build, which is exactly what v0.0.35 was.

The manifest-level guard from FID-2026-1011-004 closes the *declaration* half of this
class from tracked state. It cannot speak to the *resolution* half: whether the version
the lockfile installs actually provides the subpath an import needs.

### Expected Behavior

The gate's verdict must be a property of the lockfile and the tree, not of the machine
running it. The same input set must produce the same verdict on a developer's laptop, in
a clean CI checkout, and in a released tarball.

### Root Cause

The check was expressed as a bundle **in place**, and an in-place bundle inherits the
ambient install. There is no flag that disables ancestor lookup, and no path under a
user profile or the OS temp dir has a `node_modules`-free ancestor chain — so the fix is
not a cleaner location, it is making the location irrelevant: do the install yourself
and refuse any resolution that leaves it.

### Evidence

The mechanism, reproduced on this machine with a package that exists only in the stray
profile install (`@anthropic-ai/sdk`; 372 such packages are installed there and nowhere
in the lockfile):

```text
# 1. inject `import { Anthropic } from '@anthropic-ai/sdk'; console.log(Anthropic)`
#    into cli/src/index.tsx (no manifest declares it; no lockfile install provides it)

$ bun build cli/src/index.tsx --production --target=bun --external '@opentui/core-*' \
      --outdir cli/bin/.resolution-check          # the gate's form until now
OLD GATE EXIT: 0                                  # ← passed, from C:\Users\spenc\node_modules

$ bun scripts/cli-bundle-resolution-check.ts      # the gate now
cli-bundle-resolution: pristine tree at C:\Users\spenc\AppData\Local\Temp\savant-clean-bundle-3660 (5896 files)
cli-bundle-resolution-check FAILED — 28 module(s) resolved OUTSIDE the pristine install:
  ../../../../node_modules/@anthropic-ai/sdk/index.mjs
  ../../../../node_modules/@anthropic-ai/sdk/resources/index.mjs
  … 26 more
NEW GATE EXIT: 1
```

The bundler's metafile is what makes this decidable: outside-tree inputs appear as
relative escapes (`../../node_modules/…`), never as the absolute path, so the check
resolves every input against the tree root rather than pattern-matching a path shape.

## Impact Assessment

### Affected Components

- `scripts/clean-install-bundle.ts` (new — 187 lines: scratch root, tree
  materialization, provenance helpers, the release build's step definitions)
- `scripts/cli-bundle-resolution-check.ts` (rewritten — was a 44-line `runProbe`
  delegation, now 199 lines: the sequence and the verdict)
- `scripts/__tests__/clean-install-bundle.test.ts` (new — 183 lines, 15 tests)
- `scripts/validation-gates.ts` (`cli-bundle-resolution` now runs the probe)
- `scripts/gate-declarability-registry.ts` (`proves` clause restated)
- `package.json` (`bundle:resolution`)
- `docs/public-release.md`, `dev/LEARNINGS.md`, `dev/LEARNING-RULES.md`

### Risk Level

- [x] High: Major feature broken, no workaround
- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Keep the resolution phase identical — same entry, `--production`, `--target=bun`, same
`@opentui/core-*` externals — and change only the environment it runs in, then grade the
result instead of trusting it. Three fail-closed legs:

1. **Pristine input set.** `git ls-files --cached --others --exclude-standard` — the
   files the release would ship, taken from the working tree so uncommitted edits are
   what gets graded. Git is the authority; a filesystem walk would drag the local
   `node_modules` in. `.env*` is excluded by construction (gitignored).
2. **Pristine install.** `bun install --frozen-lockfile --ignore-scripts` in the scratch
   tree, then the release build's own prebundle steps (`sdk` build, then
   `prebuild-agents`) so no bundle input is carried over from the working tree.
3. **Provenance.** `--metafile` records every loaded module; any input resolving outside
   the tree fails the gate, and a metafile that records **no** inputs fails too (an empty
   graph proves nothing).

A scratch tree inside the repository is refused with a reason: `--others` would
enumerate it as release input, so the next run would copy the previous install into
itself.

### Steps

1. Add the engine: scratch-root resolution (+ env override), tree materialization,
   containment, metafile parsing, outside-tree detection, and the refusal guard.
   `- implemented`
2. Rewrite the probe to run the install, the prebundle steps and the bundle through
   `process.execPath`, grade the metafile, and remove the tree in a `finally`.
   `- implemented`
3. Point the root gate contract at the probe (`bun run
   scripts/cli-bundle-resolution-check.ts`) and keep the pin in
   `validateGateContract`'s required-label set. `- implemented`
4. Pin the engine's rules (containment, the v0.0.35 relative-escape shape, builtins,
   the release file set, step order) with a unit suite. `- implemented`
5. Make the gate provable on a FID: `probe scripts/cli-bundle-resolution-check.ts` is
   the audited declaration, already registered in `gate-declarability-registry.ts`.
   `- implemented`
6. Correct the doc surfaces that named the old command. `- implemented`

### Verification

- `bun scripts/cli-bundle-resolution-check.ts` exits 0 on the current tree, resolves
  2784 modules, and reports all of them inside the pristine tree.
- The same probe exits 1, naming the offending module, when an import is satisfied only
  by the stray ancestor install (evidence above).
- `scripts/__tests__/clean-install-bundle.test.ts` pins the engine's rules (15 tests).
- `bun run validate:repository` accepts the contract change and the audit entry.

## Verification Gates

- gate: probe scripts/cli-bundle-resolution-check.ts
- gate: test scripts/__tests__/clean-install-bundle.test.ts
- gate: test scripts/__tests__/gate-declarability.test.ts
- gate: test scripts/public-release-gates.test.ts
- gate: test scripts/validation-manifest.test.ts
- gate: probe scripts/audit-gate-env-parity.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ea7d8087b3c2cd61a378e52100af1fe0dc5df56e3b080cabb6c040259d97be84
- verified: 2026-10-12T01:32:05.729Z
- probe scripts/cli-bundle-resolution-check.ts: exit 0
- test scripts/__tests__/clean-install-bundle.test.ts: exit 0
- test scripts/__tests__/gate-declarability.test.ts: exit 0
- test scripts/public-release-gates.test.ts: exit 0
- test scripts/validation-manifest.test.ts: exit 0
- probe scripts/audit-gate-env-parity.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The first prototype tried to obtain cleanliness by **location** — a scratch
  tree at a node_modules-free root (`C:\savant-bundle-probe`), because `os.tmpdir()` sits
  under `C:\Users\spenc`, whose stray `node_modules` supplied `ajv` to a "pristine" tree.
  It worked, but it wrote to the operator's drive root, and the operator stopped it: an
  agent creating directories outside the repository is not a decision to make silently.
- **GREEN:** Replaced relocation with provenance. The tree may live anywhere; the gate
  reads the bundler's metafile and fails on any module loaded from outside it. This is
  strictly stronger than a clean ancestor chain — an ancestor install is no longer a
  silent rescue but a named failure.
- **AUDIT:** The metafile shape was measured before the check was written: outside-tree
  inputs are relative escapes (`../../node_modules/@anthropic-ai/sdk/index.mjs`), and no
  absolute path appeared in any input key, so resolution against the tree root is the
  correct comparison rather than a path-shape regex.
- **ADVERSARIAL:** Does the gate still need a pristine *install* if provenance is
  checked? Yes — provenance alone would accept a tree with no install at all. The two
  legs are load-bearing together: the install supplies the versions the lockfile names,
  and provenance proves nothing else did.
- **CHANGE DELTA:** ~100% (design replaced after the operator's ruling).

### Loop 2 — Independent audit and self-correction

- **RED:** The first teeth test **passed** while it should have failed: a bare
  `import '@anthropic-ai/sdk'` at the end of `cli/src/index.tsx` added zero modules to
  the graph (2784 inputs before and after), so no outside input was ever recorded. The
  module was tree-shaken before it reached the metafile — a false negative in the test,
  not in the gate.
- **GREEN:** Made the injected import a *used* value import. The gate then failed with 28
  outside inputs, and the old gate form was re-run against the same tree to confirm it
  passed (exit 0) — the two commands disagreeing on identical input is the whole finding.
- **AUDIT:** Both verdicts were re-established after the injection was reverted:
  `git status` shows only the intended files, and the scratch tree is absent from the
  temp dir (the `finally` ran on both the green and the red path).
- **ADVERSARIAL:** Is `--ignore-scripts` hiding a real difference? It skips package
  lifecycle scripts, which the release install *does* run. The boundary is stated rather
  than hidden: this gate resolves the declared dependency graph; a package whose
  postinstall generates the entry it resolves to would behave differently here, and none
  in this graph does. The `lockfile` gate and CI install cover lifecycle execution.
- **CHANGE DELTA:** ~15% (teeth test corrected; no engine change).

### Loop 3 — Final convergence

- **RED:** The three new/changed files were checked against the live ceilings
  (`protocol.config.yaml` → `max_file_lines: 300`). `validation-gates.ts` was at 293 with
  the old eighteen-line gate comment.
- **GREEN:** Reduced the contract comment to its load-bearing lines (the pristine-install
  reason and the pin to the module docs), netting the file to 286 lines.
- **AUDIT:** `quality: PASS (1502 baselined files)`; the new files are 187 / 199 / 183
  (`wc -l`, measured on the committed bytes — the 195 / 153 recorded here during the loop
  were the sizes before the last edits landed, and the closure commit corrected them).
- **ADVERSARIAL:** The cost is real and stated rather than smoothed over: the gate now
  takes **1m49s** (copy ≈8s, full install, SDK build, agent prebuild, bundle ≈2s) against
  ~2s before. It is a release-battery gate, not a pre-push gate — `.githooks/pre-push`
  does not run the contract — so the cost lands where a broken artifact costs more.
- **CHANGE DELTA:** ~8% (ceiling trim).

### Missed Questions

1. **Why not install only production dependencies?** Because the release's own prebundle
   steps are devDependency-backed (`dts-bundle-generator` builds `sdk/dist`, which the
   CLI resolves). A production install would force copying built artifacts out of the
   working tree, which is the impurity this FID exists to remove.
2. **Why is a metafile rather than a bundler plugin the provenance source?** The gate
   must keep running the same `bun build` argv as the release; `--metafile` is part of
   that CLI, and it records the actual loaded modules rather than a second, independent
   resolution implementation that could drift from the bundler's.
3. **What about `os`/`cpu` conditional exports for other platforms?** The bundle uses the
   host's `bun` condition set. The 8 platform-specific `@opentui/core-*` native binaries
   are externalized (only the current OS's is ever installed), and per-platform export
   conditions remain covered by the release workflow's five matrix builds — a stated
   boundary, not a claim.
4. **Does the tree leak into the repository or the release?** No: it is refused inside
   the repository, defaults to `%TEMP%/savant-clean-bundle-<pid>`, is removable by the
   operator via `SAVANT_CODE_CLEAN_BUNDLE_ROOT`, and is deleted in a `finally` with
   Windows-aware retries (a failed removal is reported, not swallowed).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** landed in the FID's own commit — local `ad27c153` (see `Resolution`)
- [x] **File:line ranges:** `scripts/clean-install-bundle.ts:1-187`,
      `scripts/cli-bundle-resolution-check.ts:1-199`,
      `scripts/__tests__/clean-install-bundle.test.ts:1-183`,
      `scripts/validation-gates.ts:189-203` (gate),
      `scripts/gate-declarability-registry.ts:90-95` (audited entry)
- [x] **Gate output:** pasted under `Code Verification Evidence`
- [x] **Reproducibility:** `bun run bundle:resolution` and
      `grep -rn "cli-bundle-resolution" scripts/ docs/`
- [x] **Step statuses:** all six Proposed Solution steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

Every PASS below is a command run against the working tree, with its exit status read
directly (no pipeline in the measured command):

```text
$ bun scripts/cli-bundle-resolution-check.ts                       → exit 0
cli-bundle-resolution: pristine tree at C:\Users\spenc\AppData\Local\Temp\savant-clean-bundle-<pid> (5896 files)
cli-bundle-resolution-check PASS — the CLI entry bundles with every import resolved in a pristine install.
  2784 modules resolved, all inside the pristine tree.
real 1m48.858s

$ cd scripts && bun test __tests__/clean-install-bundle.test.ts     → exit 0
 15 pass / 0 fail / 35 expect() calls

$ cd scripts && bun test __tests__/gate-declarability.test.ts \
      public-release-gates.test.ts validation-manifest.test.ts      → exit 0
 24 pass / 0 fail

$ bun run typecheck:scripts                                        → exit 0
$ bun run validate:repository                                      → exit 0
 validation: PASS
$ bun run quality:report                                           → exit 0
 quality: PASS (1502 baselined files)
```

Teeth evidence (the two commands disagreeing on one tree, as pasted under `Evidence`):
the pre-change gate form exited 0 on an import only `C:\Users\spenc\node_modules`
provides, and this gate exited 1 naming 28 such modules.

Call-graph evidence for the new wiring:

```text
scripts/validation-gates.ts  label: 'cli-bundle-resolution'
  args: ['run', 'scripts/cli-bundle-resolution-check.ts']
  → executed by scripts/public-release/gates.ts:executeGate (release battery)
  → validated by scripts/validate-repository.ts (validateGateContract label pin)
  → audited by scripts/gate-declarability.ts (probe scripts/cli-bundle-resolution-check.ts)
scripts/cli-bundle-resolution-check.ts
  → scripts/clean-install-bundle.ts (scratch root, tree materialization, provenance)
package.json  "bundle:resolution": "bun scripts/cli-bundle-resolution-check.ts"
```

## Resolution

- **Closed Date:** 2026-10-11
- **Closing Commit:** local `ad27c153` (`feat(gates): cli-bundle-resolution runs inside a
  pristine install`). No push was performed — `main` is 8 commits ahead of `origin/main`.
- **Fix Description:** `cli-bundle-resolution` now materializes the release file set into
  a scratch tree, installs the frozen lockfile there, runs the release build's prebundle
  steps, bundles there, and fails when any module the bundler loaded resolved outside that
  tree (or when the module graph records nothing). The root gate contract invokes the
  probe, and the engine's rules are pinned by a 15-test suite.
- **Tests Added:** Yes — `scripts/__tests__/clean-install-bundle.test.ts`, 15 tests:
  scratch-root selection and the in-repository refusal, containment (including the
  `../tree-x` prefix trap and parent directories), runtime-builtin handling, the v0.0.35
  relative-escape violation, the real-tree file set (no install, no `.env`), tree
  materialization, and the pinned prebundle order / bundle argv.
- **Verification Evidence:** the outputs pasted above.
- **Archived:** 2026-10-11

## Lessons Learned

- **A guard that runs where the defect happens inherits the defect's environment.** The
  in-place bundle was not merely imperfect, it was *reversed*: the condition that broke
  CI (an install the release does not have) was the condition that kept it green. Moving
  a check to a clean location is one fix; proving nothing outside it was consulted is the
  durable one.
- **Prefer a failing signal over a clean environment.** The prototype chased a
  `node_modules`-free ancestor chain, which meant writing outside the repository and still
  left the check silent about *why* it was clean. Reading the bundler's metafile turns the
  same condition into a named, attributable failure.
- **A green test of a new guard is not evidence until a red one is possible.** The first
  teeth test passed with an undeclared import present, because tree-shaking removed the
  module before the bundler recorded it. A guard demo must be shown failing for the
  reason it exists — and the pre-change command shown passing on the same input.
- **Two facts need two fences.** "The lockfile installs the right versions" and "nothing
  else supplied the module" are independent; the pristine install supplies the first, the
  metafile proves the second, and removing either leaves the class open.
- **Cost is a design input, not a footnote.** This gate costs 1m49s where it cost 2s. It
  is acceptable because it sits in the release battery rather than the pre-push hook, and
  because it runs before commit/tag/publish — but that is a deliberate placement, not an
  accident to discover later.
