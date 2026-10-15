<!-- markdownlint-disable MD013 -->

# FID: Learning Guardrails and Release Environment Evidence

**Filename:** `FID-2026-0811-027-learning-guardrails-and-release-evidence.md`
**ID:** FID-2026-0811-027
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`
**Depends On:** `FID-2026-0811-024`, `FID-2026-0811-025`, `FID-2026-0811-029`

---

## Summary

The lessons correctly identify a recurring release failure class: manual clean-environment recipes and lockfile/toolchain drift currently rely on human discipline. This FID adds mechanical release-environment and lockfile guardrails. Stable evidence references and canonical rule cataloging are owned separately by FID-2026-0811-029.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree
- **Governing contract:** ECHO Laws 3, 4, 6, 9, 14, 15; `scripts/public-release.ts`, `cli/scripts/build-binary.ts`, `scripts/validation-manifest.ts`

## Detailed Description

### Problem

The clean-shell lesson documents a five-step manual recipe that previously failed and warns about restore failures. The lockfile lesson requires re-running gates after regeneration but does not enforce dependency/toolchain compatibility mechanically. Stable evidence-reference drift is handled by FID-2026-0811-029 rather than this child.

### Expected Behavior

Release preparation uses one tested, reversible environment contract with trap/finally-style restoration and explicit canonical defaults. Lockfile changes trigger the relevant toolchain gates and detect incompatible major versions. This child consumes the stable evidence-reference contract owned by FID-2026-0811-029.

### Root Cause

Operational knowledge was recorded after incidents but not promoted into reusable executable guardrails. Evidence style favors point-in-time line citations without a freshness check.

### Evidence

- `dev/LEARNINGS.md:111-143` documents manual environment injection and restore discipline.
- `dev/LEARNINGS.md:174-229` documents lockfile/toolchain drift and gate-status mistakes.
- `scripts/validation-manifest.ts` already centralizes validation commands.
- Release/build scripts already contain canonical environment defaults that can be reused.
- Stable evidence references and canonical rules are separately scoped to FID-2026-0811-029.

## Impact Assessment

### Affected Components

- Release/build environment preparation
- Lockfile and dependency validation
- `scripts/validation-manifest.ts`
- Release evidence integration with the stable reference contract from FID-2026-0811-029
- CI/pre-push release gates

### Risk Level

- [ ] Critical
- [x] High: manual release hygiene can leak dev values or accept incompatible tooling
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Reuse existing canonical defaults and validation manifests rather than inventing a second release engine. Add a reversible local release-preflight command or wrapper that owns environment setup/restoration, add lockfile-sensitive checks for pinned major compatibility and required gate execution, and consume stable evidence references (`path → symbol/command/test`) from FID-2026-0811-029 with optional line snapshots. Keep actual publication/remote mutation out of scope.

### Steps

1. Inventory existing release/build env helpers and lockfile checks.
2. Choose the smallest reusable preflight surface and define restore/error behavior.
3. Add lockfile/toolchain compatibility and changed-lockfile gate tests.
4. Consume the stable evidence-reference contract from FID-2026-0811-029.
5. Update affected lessons and release docs with canonical commands only.
6. Run safe local preflight, typechecks, tests, lint, and repository gates without credentials or remote mutation.

### Verification

A forced failure must restore the environment and leave artifacts unchanged. A lockfile/toolchain incompatibility must fail before release. The FID-029 reference contract must resolve current symbols/commands, and stale line numbers must not be treated as authoritative.

## Perfection Loop

### Loop 1 — RED

- **RED:** Critical release hygiene relies on manual steps and lockfile drift is historical knowledge.
- **GREEN:** Reuse existing release helpers and validation manifests to automate local preflight and lockfile/toolchain checks.
- **AUDIT:** Existing canonical defaults and gate manifests provide integration points; stable evidence references are explicitly delegated to FID-029.
- **ADVERSARIAL:** Do not create a second release engine or execute remote mutations from a preflight check.
- **CHANGE DELTA:** Planning only.

### Loop 2 — Independent audit and self-correction

- **RED:** A wrapper can itself alter the environment or mask failures; lockfile checks can become overconstrained.
- **GREEN:** Use process-local env overlays, explicit restoration tests, and compatibility rules tied to installed peer constraints.
- **AUDIT:** Test failure, timeout, signal, restore, artifact identity, and no-credential behavior.
- **ADVERSARIAL:** A successful wrapper run is not proof unless the original environment and artifacts are compared afterward.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** A preflight can report green while masking a timeout, pipe failure, or restore failure.
- **GREEN:** Classify timeout as `TIMEOUT/NEEDS-REVIEW`, capture direct exit codes, and verify environment/artifact restoration.
- **AUDIT:** Run the real validation commands directly and consume FID-029's stable evidence-reference validation.
- **ADVERSARIAL:** Reject closure if a timeout is reported as PASS, a pipe exit code is trusted, or a clean-release claim is made from a dirty tree.
- **CHANGE DELTA:** Final planning convergence.

### Missed Questions

1. Should this wrapper publish? → No; it is a local preflight and evidence tool only.
2. Which env values are canonical? → Reuse the existing release/build constants; do not duplicate them in lessons.
3. Should every lockfile update run the entire suite? → At minimum run the configured release manifest and affected package verification; the exact policy belongs in the manifest.
4. Who owns stable evidence references? → FID-2026-0811-029; this child must consume, not duplicate, that contract.
5. What happens on timeout? → Classify as `TIMEOUT/NEEDS-REVIEW`, never PASS.
6. How are secrets handled? → Never print raw values; redact transcripts and compare only allowed fingerprints.

### Code Verification Evidence

- [x] Preflight behavior and local-state restoration tested
- [x] Frozen-lockfile and Bun/npm toolchain guards implemented in the existing release manifest
- [x] Stable evidence-reference contract from FID-2026-0811-029 consumed
- [x] Release docs and lessons use canonical commands
- [x] No remote mutation or credential use in tests
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Reused the existing public-release preflight and validation manifest for reversible environment restoration, frozen-lockfile ordering, pinned Bun/npm compatibility, direct command-result classification, redacted evidence, timeout handling, and mutation-free diagnostics; no second release engine was added.
- **Verification Evidence:** `bun test scripts/public-release.test.ts` (55 passing); `bun run validate:repository`; quality, hygiene, typecheck, ESLint, and Prettier gates passed. Global `bun run lint:md` remains `NEEDS-REVIEW` solely because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; governed release/learning documents are clean.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending independent sign-off record.
