<!-- markdownlint-disable MD013 -->

# FID: Generated Artifact Determinism and Type Safety

**Filename:** `FID-2026-0811-010-generated-artifact-determinism-and-types.md`
**ID:** FID-2026-0811-010
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`

> Planning-only. Generated output must not be regenerated as part of this planning pass.

## Summary

`cli/scripts/prebuild-agents.ts` emits a checked-in agent bundle with `Generated at: ${new Date().toISOString()}` and
`Record<string, any>`. The generated artifact therefore changes on every generation even when inputs are identical and
violates the repository's type-safety policy in its shipped surface. The fix must make output byte-stable, preserve all
agent definitions, and emit a domain type or safe serialized boundary without hand-editing generated output.

## Evidence

- `cli/scripts/prebuild-agents.ts:153-167` contains the timestamp interpolation and generated `Record<string, any>`.
- `cli/src/agents/bundled-agents.generated.ts:7` contains a concrete generation timestamp and line 17 contains the
  generated `Record<string, any>` surface.
- `cli/src/agents/bundled-agents.generated.d.ts:11` mirrors the unsafe generated declaration.
- Protocol and provider generators already have drift checks, establishing a reusable repository pattern.

## Expected behavior

Identical source inputs and toolchain produce byte-identical generated artifacts. Generated declarations use the actual
agent definition domain type or a validated serialized representation. Changes to source agents produce intentional,
reviewable diffs and drift checks fail when generated files are stale.

## Proposed solution

1. Remove wall-clock timestamps from generated content or replace them with a deterministic source fingerprint/version.
2. Define/reuse the canonical agent definition type for generated declarations.
3. Ensure serialization order is stable and escapes content safely.
4. Regenerate through the existing prebuild path, then run it twice and compare hashes.
5. Add tests for identical input stability, source-change detection, generated typecheck, and absence of timestamps/`any`.
6. Keep generated artifacts tracked or explicitly regenerate them in the build contract; never rely on ignored local files.

## Verification contract

- Two consecutive generation runs with unchanged inputs produce identical SHA-256 and zero diff.
- A controlled source change changes output deterministically.
- Generated bundle and declaration typecheck without `any`.
- Prebuild call graph and drift check are exercised in CI/repository validation.
- Relevant agent/CLI suites, typechecks, lint, Prettier, and Markdownlint pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Timestamp interpolation makes output nondeterministic; generated bundle uses `any`.
- **GREEN:** Derive stable output from canonical source and actual domain types, then add two-run and negative tests.
- **AUDIT:** Exact generator and generated-file lines are cited above. No regeneration was performed.
- **ADVERSARIAL:** Removing only the visible timestamp is insufficient if object traversal or host paths remain unstable;
  the test must compare complete bytes and inspect declarations.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review required the generated declaration and source generator to be treated as one artifact, not merely a
  timestamp cleanup.
- **GREEN:** The implementation contract now requires source/declaration byte comparison, stable key ordering, generated
  typecheck, and a negative scan for both wall-clock output and unsafe `any`.
- **AUDIT:** Exact evidence is `cli/scripts/prebuild-agents.ts:153-167`,
  `cli/src/agents/bundled-agents.generated.ts:7,17`, and `cli/src/agents/bundled-agents.generated.d.ts:11`. No generator
  run was performed during planning.
- **ADVERSARIAL:** A source hash is acceptable only if it is deterministic and intentional; an ignored or hand-edited
  generated file cannot satisfy the artifact contract.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Is a source hash acceptable in generated output? → Yes if deterministic and useful; wall-clock time is not.
2. Can generated files be ignored? → Only if the build deterministically regenerates them and release evidence captures it;
   current tracked-surface behavior must be decided explicitly.
3. Does replacing `any` with `unknown` satisfy the shipped type contract? → Not alone; use a validated domain type at the
   public/generated boundary.
4. Could agent key ordering vary? → Normalize keys and test byte identity.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit reproduced wall-clock output and an unsafe generated `Record<string, any>` surface.
- **GREEN:** Removed the timestamp, introduced a serialized bundle type preserving the full consumer field surface with stringified `handleSteps`, updated the declaration, and widened the shared definition to model serialization explicitly.
- **AUDIT:** Two `bun run --cwd=cli prebuild:agents` runs produced identical SHA-256 `008852fa94df0f20fa59d757db9c992092e85dd51b8a875c7ea2f5fa866ba7ff`; marker scan found no `Generated at` or `Record<string, any>`; CLI typecheck exit 0. Prebuild exit 0.
- **ADVERSARIAL:** The generated type is derived from the canonical definition while allowing internal harness fields; it does not use `any`, and the serialized handler shape is explicit rather than cast through a live function type.
- **CHANGE DELTA:** Deterministic generator header, serialized typed bundle/declaration, and canonical handleSteps compatibility.

### Code Verification Evidence

- [x] Wall-clock timestamp removed from generated output.
- [x] Generated bundle and declaration contain no `Record<string, any>`.
- [x] Two-run byte identity proven by SHA-256; prebuild and CLI typecheck pass.
- [x] Generated consumer compatibility preserved.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Bundled agent output is deterministic and typed across generator, generated module, declaration, and registry consumers.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

Generated code is production code. Reproducibility and type safety must be properties of the generator, not cleanup tasks
performed after generation.
