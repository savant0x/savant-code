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
