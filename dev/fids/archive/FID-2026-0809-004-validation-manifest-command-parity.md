<!-- markdownlint-disable MD013 -->

# FID: Validation Manifest and Command Parity

**Filename:** `FID-2026-0809-004-validation-manifest-command-parity.md`
**ID:** FID-2026-0809-004
**Severity:** high
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This FID defines future work only. No package scripts, protocol
> configuration, test commands, CI files, or validation runners may be changed until final operator
> approval and independent Nova sign-off. Convergence is not implementation authorization.

---

## Summary

The root validation commands cover the current workspaces, but coverage is encoded in long manually
maintained command chains and one package uses `test:v2` instead of a conventional `test` alias. This
creates a risk that a new workspace or suite exists but is omitted from root validation, release
validation, or protocol configuration. The proposed solution is a typed validation manifest or a
parity checker that makes workspace/category coverage explicit while preserving useful distinctions
between unit, integration, E2E, browser, and release gates.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun monorepo; Bun test; ESLint; Markdownlint; Prettier
- **Tool Versions:** Bun `1.3.14` project contract; workspace-specific scripts
- **Commit/State:** `main`; baseline gate results are not asserted by this planning artifact; no production changes authorized
- **Dependency order:** FID-0809-010 bootup prerequisite first, then FID-0809-003 metadata policy; this FID before deeper runtime FIDs

## Detailed Description

### Problem

The root `package.json` manually chains workspace commands. `evals/package.json` exposes `test:v2`
while the other workspaces generally expose `test`. The root command knows this exception explicitly.
The protocol config describes root commands but does not independently prove that every workspace is
included in every required category.

### Expected Behavior

Every workspace and validation category must have an explicit contract:

- typecheck;
- deterministic unit test;
- integration test, if applicable;
- E2E/browser test, if applicable;
- build/package gate, if applicable;
- documentation/generated-surface gate, if applicable.

The root fast/full/release validation levels must be derived from or checked against that contract.
A package may retain specialized names such as `test:v2`, but it should expose a conventional alias
where that improves discoverability without erasing semantic distinctions.

### Evidence

```text
package.json root scripts manually chain all current workspace typechecks/tests.
evals/package.json exposes "test:v2": "bun test v2/tests" rather than "test".
protocol.config.yaml commands.test points to "bun run test" and type_check duplicates
root workspace coverage as a long command string.
scripts/public-release.ts builds its own release gate manifest separately.
```

### Impact Assessment

- New workspaces can be omitted from root gates.
- Root commands and protocol config can drift.
- Unit/integration/E2E responsibilities are ambiguous.
- Release and local validation may not execute identical surfaces.
- Automation cannot report structured per-workspace evidence consistently.

### Risk Level

- [ ] Critical
- [x] High: validation omissions can allow unverified changes to progress
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Use a declarative validation manifest or a lower-risk parity checker. The first implementation should
prefer the smallest mechanism that makes omissions fail closed:

```text
workspace + category + command + required-in-root + environment/credential policy
```

Provide validation levels:

```text
verify:fast     affected workspace + targeted tests
verify          all typechecks/tests/lint/docs/format checks
verify:release  frozen lockfile + build + verify + package/assets/metadata gates
```

Preserve specialized commands and add aliases only where safe. Do not make network/credential-bound
E2E tests part of deterministic unit validation without an explicit policy decision.

### Steps

1. Inventory all workspace scripts and classify each command.
2. Define the manifest schema and authority relationship with `protocol.config.yaml`.
3. Add parity checks for every workspace in root typecheck/test coverage.
4. Add a conventional `evals:test` or package `test` alias only after confirming no semantic ambiguity.
5. Make release diagnostics consume or verify the same manifest.
6. Add structured gate output: workspace, category, command, duration, status, evidence.
7. Add fixture tests for omitted workspaces, unknown categories, duplicate gates, and invalid commands.
8. Document fast/full/release command semantics.

### Verification

- A fixture workspace omitted from root coverage causes a failing parity check.
- The current root command passes with all intended workspaces.
- `evals` retains `test:v2` compatibility and gains a clear standard entry point only if approved.
- Protocol config, root scripts, and release gate manifest agree or produce an explicit intentional-difference record.
- Gate output is deterministic and structured.
- Full static validation passes after implementation.
- Call-graph/search evidence proves all required gates use the manifest/parity checker.
- No implementation occurs before final operator approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Root test/typecheck coverage is manually encoded; `evals` uses `test:v2`; release gates
  maintain a separate manifest; the repository has no demonstrated automatic workspace-coverage parity
  check.
- **GREEN:** Proposed a declarative manifest or parity checker, preservation of specialized test
  categories, and fast/full/release levels.
- **AUDIT:** Evidence cites `package.json:36-37` for root typecheck/test chains,
  `evals/package.json:9` for `test:v2`, and `protocol.config.yaml:21,25` for configured test and
  type-check commands. No code changes are authorized or claimed.
- **AUDIT ADVERSARIAL CHECK:** A full manifest rewrite may be more change than necessary. The first
  implementation must choose parity validation if it can prove coverage without adding a fragile runner.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that command parity cannot be the first runtime gate if the boot contract itself can select a missing or incorrect protocol; validation coverage must consume the healed boot boundary.
- **GREEN:** Added FID-010 as a prerequisite while retaining this FID's lower-risk parity-checker-first approach and specialized test-category distinctions.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; command evidence remains `package.json:36-37`, `evals/package.json:9`, and `protocol.config.yaml:21,25`. No implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** This dependency does not turn FID-004 into a boot implementation and does not require E2E credentials in deterministic gates.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Must every package expose exactly `test`?** → No. Specialized commands are valid, but a standard
   alias or manifest mapping must make the package discoverable.
2. **Should E2E tests run in the root deterministic test gate?** → No by default; classify them and
   require explicit environment/credential policy.
3. **Should the manifest execute commands or only validate scripts?** → Decide in GREEN after measuring
   compatibility. Prefer a parity checker first if execution orchestration would duplicate Bun behavior.
4. **How are generated docs and release assets represented?** → As separate categories with explicit
   required/optional semantics, not hidden inside unit tests.
5. **What is the failure mode for a new workspace?** → Fail before merge/release with the missing
   workspace and required command categories named.

### Code Verification Evidence

- [x] Root `package.json`, `protocol.config.yaml`, and `evals/package.json` inspected.
- [x] Root command, `evals` command, and protocol command evidence is cited above; execution results
  are intentionally not claimed in this planning artifact.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] Manifest/parity implementation — prohibited pending approval and Nova sign-off.
- [ ] Runtime implementation verification — intentionally pending.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Validation manifest is deterministic and covers the required workspaces and gate categories.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

A root command that passes today does not prove future workspace coverage. The invariant must be
machine-checked at the boundary where workspaces and gates are declared.

## Closure Evidence

- **FID:** FID-2026-0809-004
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
