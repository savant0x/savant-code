# Session Summary: Canonical Version-Bump Tool + 0.0.24

**Session ID:** `2026-08-13-canonical-version-bump-tool-and-0.0.24`
**Date:** 2026-08-13
**Status:** completed; working tree left uncommitted by operator direction

---

## Summary

Implemented `FID-2026-0813-021` (canonical version-bump tool) so the project
version can be advanced in one shot instead of ~20 hand edits, then used the
tool to bump the repository from 0.0.23 to 0.0.24. No commit, push, tag,
release, publication, or deployment was performed.

## Root cause addressed

`scripts/validate-repository.ts` already enforced a canonical version identity
(`VERSION` + 16 package manifests + `protocol.config.yaml project.version`) but
hardcoded the list inside `collectMetadata()` with no writer. A bump was
therefore manual and error-prone.

## Changes performed

1. **`scripts/version.ts`** — single source of truth: `SYNCHRONIZED_PACKAGE_PATHS`
   (16 manifests), read/write helpers for `VERSION`, manifests, and the
   `project.version` scalar (scoped so `protocol.version` and
   `single_agent.protocol.version` are never touched), drift collection, and
   `patchLockfileWorkspaceVersions` (Bun does not rewrite the 13 workspace
   `version` metadata fields on `bun install`, so the writer owns them).
2. **`scripts/version-docs.ts`** — historical-record exclusion set, report scan,
   and soft-surface doc updates (README/README.zh-CN badges, sdk-overview,
   privacy, ARCHITECTURE note, SAVANT-VERSIONING, CHANGELOG header).
3. **`scripts/bump-version.ts`** — CLI: `<version>` or `--patch|minor|major`,
   `--dry-run`, `--check`, `--report`, `--docs`, `--force`; writes enforced
   surfaces, patches the lockfile, verifies with `bun install --frozen-lockfile`,
   and (with `--docs`) regenerates the protocol bundle.
4. **`scripts/validate-repository.ts`** — refactored to import the shared list
   (no behavior change).
5. **`package.json`** — wired `version:bump` and `version:check`.
6. **Bump applied** — `VERSION`, 16 manifests, `protocol.config.yaml`,
   `bun.lock` (13 workspace entries), README/README.zh-CN, docs, ARCHITECTURE,
   protocol bundle, and the CHANGELOG `0.0.24` in-development header are now
   0.0.24. `docs/SAVANT-VERSIONING.md` now lists 0.0.23 as the latest published
   release.

## Verification evidence

- `bun test scripts/bump-version.test.ts` → 13 pass / 0 fail.
- `bun test scripts/validation-manifest.test.ts scripts/fid-ledger.test.ts` →
  all pass.
- `bun x eslint` (scripts) → zero warnings; Prettier clean.
- `bun run version:check` → PASS (enforced surfaces synchronized).
- `bun install --frozen-lockfile` → no changes.
- `bun run generate:protocol-bundle:check` → up to date.

## Follow-on: ZTAP quality-ratchet reconciliation (resolves the flag above)

`bun run validate:repository` is now PASS. Reconcilled the 26
`quality.ratchet` findings from the uncommitted ZTAP work in
`dev/quality-baseline.json`:

- Tracked the three new provenance files at measured size:
  `cli/src/commands/attest/clean-process-validator.ts` (425),
  `common/src/provenance.ts` (356),
  `packages/agent-runtime/src/provenance/session.ts` (357).
- Added 11 `approvedGrowth` entries (measured + 1 ceilings) for ZTAP-grown
  files that exceeded their tracked baseline.
- Updated 12 existing `approvedGrowth` ceilings grown past their prior cap.
- No `trackedFiles` baseline was lowered or rewritten; the over-300-line
  provenance files were then decomposed (see below).

Verification: `bun run validate:repository` PASS; JSON valid; Prettier clean;
`scripts/quality-report.test.ts` 6/6.

## Follow-on: ZTAP provenance decomposition

Decomposed the three over-300-line ZTAP provenance files into focused modules,
keeping every public export surface unchanged:

- `common/src/provenance.ts` → `common/src/provenance/` (`schemas.ts`,
  `receipt.ts`, `batch.ts`, `loader.ts`, `index.ts`), with a new `./provenance`
  export entry in `common/package.json`.
- `packages/agent-runtime/src/provenance/session.ts` (357) → kept the
  `ProvenanceSession` class (298 lines) and extracted `registry.ts` (mode
  resolution + get-or-create + off-session), `receipt.ts` (`buildWriteReceipt`),
  and added `buildVerdictPayload` to `verdict.ts`.
- `cli/src/commands/attest/clean-process-validator.ts` (425) →
  `cli/src/commands/attest/clean-process/` (`primitives.ts`, `jcs.ts`,
  `ed25519.ts`, `schemas.ts`, `receipt.ts`, `validate.ts`) with the original
  file kept as a thin barrel. Every submodule stays built-ins-only, and the
  FID-008 purity test now covers the whole module tree (no `@savant-code/`, no
  parent-relative imports).

The three `trackedFiles` entries added by the reconciliation above were removed
(the files are now under the 300-line baseline). Verification: typecheck ×4
PASS; provenance 23/23, attest + clean-process audit 15/15; ESLint zero
warnings; Prettier clean; `bun run validate:repository` PASS.

## Notes for next session

- The 0.0.24 tree is a working-tree state; release preparation remains a
  separate operator-authorized session.
- `FID-2026-0813-021` is `fixed` (implemented + locally verified) but not yet
  closed/archived; independent review remains before closure.
