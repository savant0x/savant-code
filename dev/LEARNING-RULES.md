# Canonical Learning Rules

Normative behavior remains owned by executable code and protocol documents.
This catalog provides stable names for lessons that explain those authorities.

## Rule: generated-artifact-drift

- **Authority:** `scripts/generate-protocol-bundle.ts`
- **Validation:** `bun run generate:protocol-bundle:check`

## Rule: release-preflight-restoration

- **Authority:** `scripts/public-release.ts`
- **Validation:** `scripts/public-release.test.ts`

## Rule: learning-schema

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `bun run learnings:check`

## Rule: learning-supersession

- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `scripts/learnings.test.ts`

## Rule: protocol-variant-boundary

- **Authority:** `common/src/util/boot-contract.ts`
- **Validation:** `common/src/util/__tests__/boot-contract.test.ts`

## Rule: dependency-resolution-repo-bound

- **Authority:** `scripts/validation-manifest.ts`
- **Validation:** `bun run release:public:diagnose` (cli-bundle-resolution gate)

## Rule: dispatch-ref-branch-or-tag

- **Authority:** `.github/workflows/build-release-binaries.yml`
- **Validation:** `scripts/public-release.test.ts`

## Rule: fid-closure-requires-implementation-evidence

- **Authority:** `ECHO.md` (FID Ground-Truth Verification)
- **Validation:** `bun run learnings:check`

## Rule: test-renderer-not-proxy

- **Authority:** `cli/src/components/tools/diff-viewer.tsx`
- **Validation:** `cli/src/components/tools/__tests__/diff-viewer.test.tsx`

## Rule: timeline-loop-duration

- **Authority:** `cli/src/hooks/use-animation-timeline.ts`
- **Validation:** `cli/src/hooks/__tests__/animation-timeline-loop.test.ts`

## Rule: brand-color-provenance-operator-confirmed

- **Authority:** `cli/src/utils/theme-system/palette.ts`
- **Validation:** `packages/design-systems/src/__tests__/default.test.ts`
  (no-navy neutral-family assertion)
