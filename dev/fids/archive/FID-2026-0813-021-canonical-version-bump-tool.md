<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Canonical Version-Bump Tool

**Filename:** `FID-2026-0813-021-canonical-version-bump-tool.md`
**ID:** FID-2026-0813-021
**Severity:** medium
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — replaces manual multi-file drift with one writer over the existing canonical list
**Depends On:** none

---

## Summary

Add a single canonical version-bump tool so the project version (`VERSION`, the
16 synchronized package manifests, and `protocol.config.yaml project.version`)
can be advanced in one shot instead of being hand-edited across files. The tool
reuses the exact same canonical list that `scripts/validate-repository.ts`
already enforces, so the writer and the validator can never drift apart.

## Environment

- **OS:** Windows target; POSIX-compatible script via Bun
- **Language/Runtime:** TypeScript/Bun 1.3.14
- **Tool Versions:** existing `scripts/validate-repository.ts` +
  `scripts/validation-manifest.ts`
- **Commit/State:** Working tree; 0.0.23 released, 0.0.24 is the next target

## Detailed Description

### Problem

There is a validator (`scripts/validate-repository.ts`) that fail-closes when
`VERSION`, the workspace package manifests, and `protocol.config.yaml
project.version` drift, but there is no corresponding writer. Advancing the
version today means hand-editing ~20 files (VERSION, 16 package manifests,
`protocol.config.yaml`, `bun.lock`, README/README.zh-CN badges, architecture and
docs version notes, regenerated protocol bundle, and a CHANGELOG header) and
hoping the validator agrees. The canonical synchronized list is also hardcoded
inside `collectMetadata()` in `validate-repository.ts`, so any new writer would
have to duplicate it.

### Expected Behavior

One command advances the enforced version surfaces atomically and correctly:

```text
bun run version:bump 0.0.24        # explicit target
bun run version:bump --patch       # auto-increment patch/minor/major
bun run version:bump --dry-run     # preview writes without touching disk
bun run version:bump --check       # fail if any enforced surface drifts
bun run version:bump --report      # list remaining old-version references
```

After a bump, `bun run validate:repository` passes with zero version drift, the
lockfile is regenerated, and the soft documentation surfaces are updated or
reported.

### Root Cause

Version identity has one reader (the validator) and no writer. The list of
synchronized files lives only inside the validator's `collectMetadata()`, so the
write side was always going to be manual and error-prone.

### Evidence

- `scripts/validate-repository.ts` `collectMetadata()` hardcodes
  `synchronizedPackagePaths` (16 entries: root `package.json`,
  `agents/`, `cli/`, `cli/release/`, `common/`, `evals/`, `savant-free/`,
  `savant-free/cli/release/`, `packages/{agent-runtime,design-systems,
  code-map,database,knowledge-graph,llm-providers}/`, `scripts/tmux/`, `sdk/`).
- `scripts/validation-manifest.ts` exports `VERSION_PATTERN` and
  `validateMetadata()` (product/package/project version equality + drift codes).
- `protocol.config.yaml` `project.version` is read via `readYamlScalar()` with a
  `project:`-scoped regex in `validate-repository.ts`.
- `bun.lock` records 13 workspace `"version"` fields (the 13 root workspaces;
  the 3 remaining synchronized manifests are the root package and the two
  `*/release/` manifests, which Bun does not list as workspaces).
- No `version:bump`/`bump-version` script exists; only `public-release.ts`.

## Impact Assessment

### Affected Components

- NEW `scripts/version.ts` — shared version-sync constants and read/write helpers
- NEW `scripts/bump-version.ts` — the canonical bump tool
- NEW `scripts/bump-version.test.ts` — contract tests
- MODIFY `scripts/validate-repository.ts` — import the shared list (no behavior change)
- MODIFY `package.json` — `version:bump` / `version:check` scripts

### Risk Level

- [ ] Critical: no runtime or release mutation is performed
- [ ] High: feature degraded with workaround
- [x] Medium: a wrong bump writes inconsistent metadata, caught by the validator
- [ ] Low: cosmetic

## Proposed Solution

### Approach

Refactor the version identity into a single source of truth, then build a writer
that consumes it. The validator keeps its exact behavior; the writer is the only
place that mutates version fields. A `--dry-run`/`--check`/`--report` surface
makes the tool safe to run before committing and self-documenting about what it
will not touch.

### Steps

1. **Extract the canonical list.** Add `scripts/version.ts` exporting
   `SYNCHRONIZED_PACKAGE_PATHS` (the 16 manifests), `readProductVersion()`,
   `readConfiguredProjectVersion()`, and `writeProjectVersion()` (a
   `project:`-scoped scalar replacer for `protocol.config.yaml`). Refactor
   `collectMetadata()` in `validate-repository.ts` to import these; run
   `validate:repository` and the existing `validation-manifest.test.ts` to prove
   zero behavior change.
2. **Add `scripts/bump-version.ts`.** Parse a target version or
   `--patch|--minor|--major`; validate against `VERSION_PATTERN`; refuse a
   non-increasing target unless `--force`; then, unless `--dry-run`, write
   `VERSION`, all 16 manifest `version` fields, and
   `protocol.config.yaml project.version` **only** (scope to the `project:`
   block scalar — never touch `protocol.version` `0.2.0` or
   `single_agent.protocol.version` `0.1.2-single-agent`). Synchronize
   `bun.lock` by deterministically patching the 13 workspace `version` fields
   and verifying with `bun install --frozen-lockfile` (no network
   re-resolution; dependencies are unchanged). Implement `--check` (exit
   non-zero on any drift, mirroring `validateMetadata`) and `--report` (list
   remaining occurrences of the old version, with the version string regex-/glob-
   escaped so `.` and prerelease metacharacters match literally).
3. **Soft surfaces (opt-in `--docs`).** Update README.md and README.zh-CN.md
   version badges, `docs/sdk-overview.md`, `docs/SAVANT-VERSIONING.md`,
   `docs/privacy.md`, and the `ARCHITECTURE.md` "pending" release note; add a
   CHANGELOG in-development header for the new version; regenerate
   `common/src/constants/protocol-bundle.generated.ts` via
   `bun run generate:protocol-bundle` when `ARCHITECTURE.md` changed. Without
   `--docs`, these are reported (not modified).
4. **Wire root scripts.** `version:bump` → `bun run scripts/bump-version.ts`,
   `version:check` → `bun run scripts/bump-version.ts --check`.
5. **Exclusion contract.** `--report`/`--docs` never touch historical records:
   `CHANGELOG.md` past sections, `dev/fids/**`, `dev/session-summaries/**`,
   `dev/scratchpad/**`, `dev/nova/**`, `dev/test-prompts/**`,
   `dev/quality-baseline.json` rationale, `docs/release-notes-vX.Y.Z.md`,
   `resources/**`, `node_modules/**`, `cli/bin/**` (generated), and
   `sdk/test/**/package-lock.json` (nested SDK compatibility fixtures that
   regenerate when the SDK compat suite runs).

### Verification

- `bun run version:bump --dry-run 0.0.24` changes nothing on disk.
- `bun run version:bump 0.0.24` then `bun run version:check` exits 0 and
  `bun run validate:repository` reports zero `metadata.*.drift`.
- `--patch/--minor/--major` produce correct semver increments from the current
  `VERSION`.
- Re-running with the same version is a no-op (idempotent).
- `bun test scripts/bump-version.test.ts` covers: dry-run no-write, exact
  canonical set, malformed-target rejection, auto-increment, idempotency,
  `--check` drift exit, and that the refactor keeps `validateMetadata` green.

## Perfection Loop

### Loop 1 — RED

- **RED:** The canonical synchronized list is private to
  `validate-repository.ts` `collectMetadata()`; a writer would duplicate it and
  drift. The lockfile and doc/README surfaces have no owner, so the manual bump
  is ~20 hand edits. There is no preview/check path before mutation.
- **GREEN:** Extract one shared `scripts/version.ts`; build a writer over it
  with dry-run/check/report; regenerate the lockfile canonically; make soft
  documentation surfaces opt-in and report-only by default; exclude historical
  records explicitly.
- **AUDIT:** `validateMetadata()` already encodes product/package/project
  equality and `VERSION_PATTERN`, so the writer's postcondition is exactly the
  validator's precondition. (Corrected in Loop 4: `bun install` does not rewrite
  the workspace `version` metadata, so the tool patches it directly.)
- **ADVERSARIAL:** A writer that edits only the enforced surfaces would leave
  README/docs/CHANGELOG stale; hence the explicit `--report` of remaining
  references and the `--docs` opt-in, rather than a silent partial bump.
- **CHANGE DELTA:** New FID; large by design (single-source refactor + writer).

### Missed Questions

1. **Can the tool just `sed` every `0.0.X`?** → No; historical records
   (CHANGELOG past entries, archived FIDs, session summaries, test prompts,
   quality-baseline rationale, release-notes docs) must not be rewritten.
2. **Who owns `bun.lock`?** → Bun records workspace `version` metadata but does
   not rewrite it on `bun install`; the bump tool patches those fields directly
   and verifies with `bun install --frozen-lockfile`.
3. **Are `cli/release` and `savant-free/cli/release` synchronized?** → Yes, both
   are in the 16-path canonical list even though Bun does not treat them as
   workspaces.
4. **What about `cli/bin/env.json` and other generated outputs?** → Ignored
   build artifacts; regenerated on build, never hand-bumped.
5. **What if the target is malformed?** → Reject against `VERSION_PATTERN`
   before any write.
6. **What if a bump is interrupted mid-write?** → Write order is
   `VERSION` → manifests → protocol config → lockfile; `--check` and
   `validate:repository` expose any partial state, and the tool is idempotent so
   re-running repairs it.

### Code Verification Evidence

- [x] `validate-repository.ts` `collectMetadata()` and `validateMetadata()`
      were read in full to confirm the canonical list and drift codes.
- [x] `bun.lock` workspace version count confirmed (13 workspace entries;
      16 synchronized manifests total).
- [x] No existing `bump`/`version` script exists in `scripts/`.
- [x] Implementation and contract tests — `scripts/bump-version.test.ts`
      13 pass / 0 fail; ESLint zero warnings; Prettier clean (Loop 4).

### Loop 2 — Independent audit and self-correction

- **RED:** Independent re-read found five gaps. (1) A naive `version:` scalar
  replacer could clobber the two protocol scalars the validator also reads
  (`protocol.version` `0.2.0`, `single_agent.protocol.version`
  `0.1.2-single-agent`). (2) The old-version search in `--report` treats `.` as
  a regex wildcard and would mis-handle prerelease targets. (3) The four
  `sdk/test/**/package-lock.json` fixtures pin `0.0.23` as the SDK dependency
  and were not excluded. (4) A non-increasing target was not rejected. (5)
  `bun install` re-resolution is not deterministic offline; the lock-sync
  mechanism was under-specified.
- **GREEN:** The writer now scopes `protocol.config.yaml` writes to the
  `project:` block only; `--report` regex-/glob-escapes the version; the SDK
  compat package-locks are in the exclusion contract; a downgrade requires
  `--force`; and `bun.lock` is synchronized by patching the 13 workspace
  `version` fields and verifying with `bun install --frozen-lockfile`.
- **AUDIT:** `validate-repository.ts` reads three distinct version scalars via
  three separate `readYamlScalar` regexes, so the write side must be equally
  scoped. `bun.lock` has 13 workspace `version` fields, and the four
  `sdk/test/**/package-lock.json` files were confirmed via grep. Static checks
  (markdownlint, prettier, fid-ledger) pass on the updated FID.
- **ADVERSARIAL:** Bun may evolve its lockfile format; the deterministic patch
  is therefore paired with `bun install --frozen-lockfile` verification so a
  format change fails closed rather than silently corrupting the lock.
- **CHANGE DELTA:** <10% of the FID.

### Loop 3 — Final convergence

- **RED:** No actionable improvement remains; the remaining uncertainty (Bun
  lockfile format, doc-surface completeness) is a verification gate, not a
  design gap.
- **GREEN:** The Five Questions resolve affirmatively: idempotent and
  dry-run-first (all cases), deterministic and stateless (scale), escapes
  untrusted version strings and never rewrites history (hostile), shares one
  list with the validator (maintainability), and previews/checks/reports before
  any mutation (industry standard).
- **AUDIT:** Static evidence above is reproducible; no production code exists,
  so the remaining evidence is intentionally the implementation gate.
- **ADVERSARIAL:** A writer can still be mis-invoked; `--dry-run`, `--check`,
  and `validate:repository` are the compensating controls.
- **CHANGE DELTA:** <2% from Loop 2.

### Loop 4 — Implementation audit

- **RED (implementation findings):** Two defects surfaced during implementation.
  (1) `bun install` does not rewrite the workspace `version` metadata in
  `bun.lock`; the initial `bun install`-only sync left all 13 workspace version
  fields stale. (2) `writeManifestVersion` treated an already-applied version as
  a missing field (`updated === content`), breaking idempotency — the
  idempotency test caught it and both writers were fixed to test for a match.
- **GREEN:** `scripts/version.ts` (canonical list + read/write + drift +
  `patchLockfileWorkspaceVersions`), `scripts/version-docs.ts` (report scan +
  soft-surface doc updates), and `scripts/bump-version.ts` (CLI with
  `--dry-run`/`--check`/`--report`/`--docs`/`--force` and
  `--patch|minor|major`) are implemented; `validate-repository.ts` imports the
  shared list; `package.json` wires `version:bump` and `version:check`.
- **AUDIT:** `bun test scripts/bump-version.test.ts` → 13 pass / 0 fail;
  `bun x eslint` (scripts) → zero warnings; Prettier clean. The repo was bumped
  `0.0.23 → 0.0.24` with the tool (`version:check` PASS; `bun install
  --frozen-lockfile` no changes; `generate:protocol-bundle:check` up to date).
  Call-graph: `version:bump`/`version:check` in `package.json:48-49`.
- **ADVERSARIAL:** `validate:repository` still fails, but only on pre-existing
  ZTAP `quality.ratchet` growth in the uncommitted tree; none of the findings
  reference the new `scripts/version*.ts` files. That is a separate pre-existing
  working-tree condition, not a regression of this FID.
- **CHANGE DELTA:** <10% of the FID.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Implemented `scripts/version.ts`,
  `scripts/version-docs.ts`, and `scripts/bump-version.ts`; refactored
  `validate-repository.ts` to share the canonical list; wired `version:bump` /
  `version:check`; bumped the repo 0.0.23 → 0.0.24 with the tool.
- **Tests Added:** `scripts/bump-version.test.ts` — 13 tests.
- **Verification Evidence:** 13/13 tests, ESLint zero warnings, Prettier clean,
  `version:check` PASS, `--frozen-lockfile` clean, protocol bundle up to date.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

A version identity needs one reader *and* one writer that share the same list;
otherwise every release prep reintroduces the same manual drift the validator
was built to prevent.
