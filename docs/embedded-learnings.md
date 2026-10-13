# Embedded Learning Guidance

This file is generated from the boot-tier rules in
`dev/LEARNING-RULES.md`. It is the public runtime-facing projection of
durable engineering rules, not a hand-edited incident archive.

## Rule: generated-artifact-drift

- **Tier:** boot
- **Tier reason:** Public boot guidance for validating generated source shape.
- **Authority:** `scripts/generate-protocol-bundle.ts`
- **Validation:** `bun run generate:protocol-bundle:check`
- **Invariant:** Generated content is trustworthy only when extraction validates the source's observed structure.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Scope:** embedded

## Rule: release-preflight-restoration

- **Tier:** boot
- **Tier reason:** Public boot guidance for reversible release preparation.
- **Authority:** `scripts/public-release.ts`
- **Validation:** `scripts/public-release.test.ts`
- **Invariant:** Local release checks are reversible and must report direct command outcomes.
- **Guard:** `bun run validate:repository`
- **Scope:** embedded

## Rule: learning-supersession

- **Tier:** boot
- **Tier reason:** Public boot guidance for replacing stale learning guidance.
- **Authority:** `scripts/learnings-validation.ts`
- **Validation:** `scripts/learnings.test.ts`
- **Invariant:** Superseded guidance retains its history but names an existing replacement and canonical rule.
- **Guard:** `bun run learnings:check`
- **Scope:** embedded

## Rule: protocol-variant-boundary

- **Tier:** boot
- **Tier reason:** Public boot guidance for keeping protocol variants explicit.
- **Authority:** `common/src/util/boot-contract.ts`
- **Validation:** `common/src/util/__tests__/boot-contract.test.ts`
- **Invariant:** Each governance branch is explicit and must not silently fall through to another contract;
  harness-injected context selects only the harness contract.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Scope:** embedded
