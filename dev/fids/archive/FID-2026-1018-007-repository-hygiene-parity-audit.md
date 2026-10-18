# FID: Repository bloat, stale state and documentation/data parity

**Filename:** `FID-2026-1018-007-repository-hygiene-parity-audit.md`
**ID:** FID-2026-1018-007
**Severity:** medium
**Status:** closed
**Created:** 2026-10-18
**Automation level:** 3
**YAGNI-Compliance:** Verified — existing audit tools and targeted repairs.

## Summary

Audit repository storage and current documentation/data against code. Existing
gates expose README callout drift and design-system generator metadata drift;
tracked build output and obsolete active-register history also need correction.

## Environment

- **OS:** Windows / PowerShell
- **Language/Runtime:** TypeScript strict / Bun 1.3.14
- **Tool Versions:** pinned repository validators
- **Commit/State:** `31008b4f`, clean main

## Detailed Description

### Problem

Passing core validation does not imply all optional generated checks pass.
The active register also repeats obsolete push/acceptance status claims.

### Expected Behavior

Current docs reflect the implementation and unpublished development status;
generated data checks agree with trusted metadata; reproducible intermediates
stay untracked; active scope contains current work only.

### Root Cause

The skill gained version metadata without a matching generator change. README
callout diverged from its changelog owner. Historical closure prose accumulated
in the active register, and a generator intermediate entered source control.

### Evidence

`version:check` fails README callout parity; `design-systems:check` fails
`.agents/skills/savant-design-systems/SKILL.md`. `git ls-files cli/.tmp` names
`savant-sigma-bundle/sigma-runtime.js` (174,027 bytes), recreated by the Sigma
generator before embedding into tracked source chunks. Scope still claims six
commits unpushed and run-3 acceptance pending despite verified run-4 closure.

## Impact Assessment

### Affected Components

- README, active scope and durable audit/history records
- design-system generator and `.gitignore`
- regenerable tracked intermediate and confirmed current documentation links
- SDK examples/JSDoc: retired store/default-agent claims versus local-only lookup

### Risk Level

- [x] Medium: stale generated metadata and inaccurate current guidance.

## Proposed Solution

### Approach

Use current production code and validator output as authority. Preserve the
unpublished release boundary and historical evidence. Add the trusted version
to generator output rather than removing metadata. Remove only the temporary
bundle from the index, retain it locally and ignore its directory. Snapshot
scope history before reducing the active register to live authority. Inspect
current link/README claims against consumers, correcting only confirmed drift.
Use an explicit inline SDK agent definition in examples; string ids require
supplied definitions, and the old store lookup no longer exists. Correct the
constructor example and RunState return description to match current types.
Record large reference/cache trees as inventory, not automatically deletable
data. External-home skill diagnostics remain operator-owned outside this repo.

### Steps

1. Inventory and classify bloat, stale claims and current data checks.
2. Apply the targeted repairs and publish a durable audit report.
3. Verify, commit, archive and push with changelog and scope release.

### Verification

Rerun failed checks, generated/provider/protocol/census/acceptance/hygiene
validators and relevant existing suites. Audit all design resources using
their real header-plus-prose loader rather than declaring them malformed JSON.
No new test artifact is promised; use the existing library and doc drift suites.

## Verification Gates

- gate: typecheck packages/design-systems
- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test sdk/src/__tests__/client.test.ts
- gate: test packages/design-systems/src/__tests__/library.test.ts
- gate: test scripts/version-docs-drift.test.ts
- gate: test scripts/__tests__/provider-docs-drift.test.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:f9a900b8edecae1264bcb26de9662253e11f6b87db5b76cb7bd95e9e5759a719
- verified: 2026-10-18T21:01:45.106Z
- typecheck packages/design-systems: exit 0
- typecheck common: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test sdk/src/__tests__/client.test.ts: exit 0
- test packages/design-systems/src/__tests__/library.test.ts: exit 0
- test scripts/version-docs-drift.test.ts: exit 0
- test scripts/__tests__/provider-docs-drift.test.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Two drift commands fail. Inventory distinguishes 12.8 GB local references
from about 68 MB tracked content; ripgrep binaries are shipped consumers.
Six orphan candidates are examples/manual evidence runners, not proven dead.

### Loop 2 — Independent audit and self-correction

Generic JSON parsing falsely flags the 74 design resources: production reads
JSON before a prose separator. TypeScript config files allow comments. Use
their domain parsers. Bare Markdown destinations with spaces need verification
as formatting candidates, not automatically missing files. Historical snapshots
must be labelled historical; do not rewrite past acceptance evidence.

### Loop 3 — Final convergence

Plan converged before edits. No external deletion, paid inference, reference
farm removal, package release, live agent run or history rewrite is authorized
by this audit. Reversible source/doc repairs proceed under level 3 authority.

### Missed Questions

1. Does size alone prove bloat? No: shipped binaries and consumer assets remain.
2. Can every historical claim be certified? No; report current tested contracts
   and explicit limits, preserving history rather than claiming timeless truth.

### Implementation Evidence

Implementation commit `463d8096`. All three steps implemented, with normal
progress push subject to mandatory hooks. Final receipt: 11/11 declared gates
exit 0, including common and CLI coverage. Three SDK basic examples typecheck
in memory against current declarations. Version and design drift checks now
exit 0. Detailed inventory and retention limits live in
`docs/reports/repository-hygiene-audit-2026-10-18.md`.

### Code Verification Evidence

Generator is invoked by root `design-systems:check`; Sigma generator creates
the temporary bundle then reads it into shipped source. Existing consumers stay.
The latter's index entry is removed, but disk existence is true and ignore check
names the expected path. Current docs link scan: 146 files / 315 relative links,
zero missing/malformed targets; raw HTML targets also pass. SDK build and scoped
Prettier pass. Initial Markdown lint found a 123-column banner line; wrapped it
and scoped lint passed. No runtime API behavior changed.

## Resolution

- **Closed Date:** 2026-10-18
- **Commit SHA:** 463d8096
- **Fix Description:** Corrected current guidance/generator drift, untracked a
  regenerable intermediate, preserved scope history and published bounded audit.
- **Tests Added:** None; existing suites and parity/domain checks prove the changes.
- **Verification Evidence:** 11/11 declared gates exit 0; SDK build, domain data
  validation, current-document links, version/design checks and scoped lint pass.
- **Archived:** 2026-10-18

The verified-status surface guard refused an incomplete gate set for `cli/.tmp/**`;
added the required CLI typecheck and restamped normally. External HOME-SKILLS-001
and EMBED-001 stay operator-blocked. Large local references and historical
evidence remain; no disk-reclamation or universal prose-certification claim.

## Lessons Learned

Audit optional drift checks and consumer contracts, not just file size or names.
