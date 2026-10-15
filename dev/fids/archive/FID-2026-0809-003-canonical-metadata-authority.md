<!-- markdownlint-disable MD013 -->

# FID: Canonical Metadata Authority and Version Drift Prevention

**Filename:** `FID-2026-0809-003-canonical-metadata-authority.md`
**ID:** FID-2026-0809-003
**Severity:** high
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This FID is not implementation authorization. No production code,
> package metadata, protocol configuration, release script, or documentation generator may be
> changed from this FID until final operator approval and an independent Nova sign-off are both
> recorded. Convergence of this document does not authorize implementation.

---

## Summary

The repository has multiple version domains and at least one confirmed metadata mismatch: `VERSION`,
root `package.json`, `cli/package.json`, and `sdk/package.json` report `0.0.22`, while
`protocol.config.yaml` reports project version `0.0.21`. The solution is to define explicit authority
and relationship rules for product, package, protocol, run-state, agent-template, and toolchain
versions, then enforce those rules with a read-only metadata validator and release-bound evidence.
The objective is not to make every version equal; it is to make every relationship intentional and
machine-checked.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; strict TypeScript
- **Tool Versions:** Bun project requirement `1.3.14`; TypeScript `5.5.4`; npm release tooling
- **Commit/State:** `main`; clean worktree at planning start; product version `0.0.22`
- **Dependencies:** Program prerequisite FID-2026-0809-010; orchestrated by FID-2026-0809-009; implementation remains blocked

## Detailed Description

### Problem

Version information is distributed across release files, package manifests, protocol configuration,
README/release documentation, and runtime schemas. The release system validates selected package
versions, but protocol project metadata is not part of the same synchronized contract. A release can
therefore pass package checks while protocol configuration describes an older product version.

### Expected Behavior

The repository must distinguish and validate:

| Domain | Authority | Meaning |
|---|---|---|
| Product release | `VERSION` | Public release identity |
| Synchronized package versions | Root/package release policy | Artifact identity for packages that ship together |
| ECHO protocol | `ECHO.md` | Harness protocol contract |
| Single-agent protocol | `protocol.config.yaml:single_agent.protocol` | Single-agent contract |
| Run-state schema | Runtime constant/type | Persistence compatibility |
| Agent-template version | Agent definition | Template compatibility |
| Toolchain | `.bun-version`, `package.json` engines/packageManager | Build environment |

The validator must report intentional independence separately from drift.

### Root Cause

Version relationships have historically been maintained by release convention rather than a single
machine-readable policy. The release engine has strong receipt and gate binding, but metadata
validation does not yet cover every version domain.

### Evidence

```text
VERSION                  -> 0.0.22
package.json             -> 0.0.22
cli/package.json         -> 0.0.22
sdk/package.json         -> 0.0.22
protocol.config.yaml     -> project.version 0.0.21

scripts/public-release.ts validates selected package JSON versions, but its
current validation contract does not make protocol.config.yaml project.version
part of the same release identity.
```

### Impact Assessment

- Release identity and protocol identity can disagree.
- Resume and audit records can cite incomplete release metadata.
- Documentation and changelog checks may pass while project configuration is stale.
- Future automation cannot safely infer which version is authoritative.

### Risk Level

- [ ] Critical
- [x] High: release/audit correctness can degrade without an immediate runtime failure
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Create a version-policy manifest or equivalent typed validator that explicitly declares:

1. the canonical product release source;
2. synchronized package files;
3. intentionally independent protocol/schema/toolchain versions;
4. allowed relationships and comparison rules;
5. generated or manually maintained documentation surfaces.

Add a read-only command such as `bun run validate:metadata`. It must never mutate files, tags,
receipts, settings, or remote services.

### Steps

1. Confirm all version domains and their intended authority in the master FID before implementation.
2. Define the policy representation and failure categories.
3. Detect invalid semver and missing metadata.
4. Validate synchronized package versions against `VERSION`.
5. Validate the configured project version relationship against the approved policy.
6. Include protocol/config metadata in release manifest identity and resume validation where appropriate.
7. Add documentation/reference checks without treating historical records as current claims.
8. Add deterministic fixtures for matching, mismatch, missing, malformed, and intentionally independent versions.
9. Update release documentation only after final approval.

### Verification

- A read-only validator fails on the currently observed `0.0.22`/`0.0.21` mismatch.
- A fixture proves synchronized package versions pass.
- A fixture proves independent protocol versions can differ without false failure.
- A fixture proves malformed or missing versions fail closed.
- Release manifest/resume tests prove metadata identity is bound when policy requires it.
- `bun run typecheck`, `bun run test`, ESLint, Markdownlint, Prettier, and `git diff --check` pass after implementation.
- Call-graph search proves the validator is used by release diagnostics and the intended root gate.
- No production implementation is permitted before operator approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Confirmed a product/package version cluster at `0.0.22` and a stale project version of
  `0.0.21` in `protocol.config.yaml`. Identified multiple version domains without a documented
  machine-checked relationship policy.
- **GREEN:** Proposed a read-only metadata validator plus explicit authority/relationship manifest.
  Kept protocol, run-state, agent-template, and toolchain versions conceptually independent rather
  than forcing false equality.
- **AUDIT:** Evidence cites `protocol.config.yaml:11` (`version: '0.0.21'`) and
  `package.json:3`, `cli/package.json:3`, and `sdk/package.json:4` (`version: "0.0.22"`).
  `scripts/public-release.ts` was inspected during the read-only survey; implementation evidence is
  intentionally absent because implementation is prohibited.
- **AUDIT ADVERSARIAL CHECK:** No unresolved planning contradiction remains. The validator must not
  silently rewrite metadata, and historical documentation must not be treated as current metadata.
- **CHANGE DELTA:** Planning document only; no production code delta.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that metadata validation must not be implemented before the single-agent boot contract is resolved; otherwise a release gate could validate an ambiguous protocol identity.
- **GREEN:** Added the bootup prerequisite relationship through the master plan while preserving this FID's scope: metadata authority and relationship validation only.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; metadata evidence remains `protocol.config.yaml:11`, `package.json:3`, `cli/package.json:3`, and `sdk/package.json:4`. No production implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** The boot prerequisite does not force protocol/package version equality and does not authorize this FID's implementation.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Should every version be forced to equal `VERSION`?** → No. Only explicitly synchronized package
   artifacts should be compared; protocol and schema versions require independent compatibility rules.
2. **Should the validator auto-correct stale metadata?** → No. It must fail read-only and require an
   approved release or metadata change so automation cannot conceal intent.
3. **Should a mismatch block local development?** → The master FID should separate developer warnings
   from release/merge hard gates; the confirmed release identity mismatch must be hard in release validation.
4. **Should historical FIDs and changelog entries be rewritten?** → No. Historical records remain
   historical; only current claims and generated surfaces are validated.
5. **Should metadata be included in resume identity?** → Yes where changing it could invalidate release
   evidence; the exact fields belong in the approved manifest policy.

### Code Verification Evidence

- [x] `VERSION`, root/package manifests, and `protocol.config.yaml` were inspected; the confirmed
  mismatch is cited above at `protocol.config.yaml:11` and package manifest version lines.
- [x] Release validation entry point `scripts/public-release.ts` was inspected.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] Implementation files changed — prohibited until approval and Nova sign-off.
- [ ] Runtime implementation verification — intentionally pending.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Canonical metadata validator is fail-closed and non-mutating; synchronized metadata and intentional protocol independence are machine-checked.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

Metadata automation must distinguish authority from equality. A validator that does not encode the
relationship policy merely moves ambiguity into another file.

## Closure Evidence

- **FID:** FID-2026-0809-003
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
