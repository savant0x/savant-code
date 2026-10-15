<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Independent A–Z Production and Release Audit Request — v0.0.23

**Date:** 2026-08-12
**Status:** AWAITING INDEPENDENT AUDIT
**Scope:** project-wide production readiness, documentation/file hygiene, release system, environment switching, package contents, CI binary workflow, and release safety
**Audit artifact:** `dev/scratchpad/project-wide-a-z-release-audit-v0.0.23.md`

## Review boundary

Review the current working tree as evidence only. Do not modify source, documentation, FIDs, baselines, generated artifacts, credentials, settings, Git history, GitHub, npm, or deployment state. Do not commit, tag, push, publish, or deploy.

This is a second audit of the implemented repository state, not approval of a plan and not authorization to release. The requested verdict must be conservative: an unconditional release PASS is invalid if any release gate fails, if production files remain unclassified, or if evidence is only asserted rather than observed.

The governing single-agent protocol is `ECHO-single-agent.md` plus `dev/echo-v0.1.2-single-agent.md`. Do not treat `ECHO.md` as the governing protocol for this review.

## Current observed evidence

- Target version: pending/unreleased `0.0.23`; latest published release is documented as `0.0.22`.
- `bun run validate:repository`: exit 1 with 32 quality-ratchet findings.
- `bun run hygiene:check`: exit 0.
- Generated protocol bundle, provider docs, design-system manifest, and LEARNINGS checks: exit 0.
- Focused release/validation/pre-push/hygiene suites: 79 pass / 0 fail.
- Full root typecheck: exit 0 across configured workspaces.
- Full root test command: exit 0 with zero failures.
- `bun run release:public:preview`: exit 0 and mutation-free; current changelog section and five binary tarballs identified.
- `bun run release:public:diagnose`: exit 1 after lockfile, SDK build, typecheck, test, and ESLint passed; `repository-validation` failed on the 32 quality findings. Evidence was finalized, local state was restored, and `ignoredChanges` was empty.
- `bun run lint:md`: exit 1 on `docs/design/Savant-Code Cited Web Research.md` and `docs/design/Terminal Row Highlight Diagnosis.md`; the two new audit artifacts produced no reported lint failures. Classify these as active documentation defects or narrowly justified historical exemptions.
- Working tree: extensive tracked modifications/deletions and 474 untracked non-ignored paths.
- Root `nul` exists untracked.
- `cli/release-staging/` is tracked and modified.
- No public mutation occurred.

## Files to inspect 0–EOF

### Governance and audit evidence

1. `ECHO-single-agent.md`
2. `dev/echo-v0.1.2-single-agent.md`
3. `protocol.config.yaml`
4. `dev/scratchpad/project-wide-a-z-release-audit-v0.0.23.md`
5. `dev/quality-baseline.json`
6. `scripts/hygiene.ts`
7. `scripts/validate-repository.ts`
8. `scripts/validation-manifest.ts`
9. `dev/fids/README.md`
10. `dev/session-summaries/README.md`
11. `dev/fids/FID-2026-0812-008-project-wide-production-cleanup-and-release-readiness.md`

### Release and environment system

11. `scripts/public-release.ts`
12. `scripts/public-release.test.ts`
13. `docs/public-release.md`
14. `cli/release/README.md`
15. `cli/release-core/launcher.js`
16. `cli/release-core/README.md`
17. `cli/scripts/build-binary.ts`
18. `common/src/env.ts`
19. `.env.example`
20. `.github/workflows/build-release-binaries.yml`
21. `package.json`
22. `VERSION`
23. `CHANGELOG.md` current v0.0.23 section

### Product and user-facing documentation

24. `README.md`
25. `README.zh-CN.md`
26. `docs/installation.md`
27. `docs/testing.md`
28. `docs/SAVANT-VERSIONING.md`
29. `docs/sdk-overview.md`
30. `savant-free/README.md`
31. `savant-free/SPEC.md`
32. `dev/test-prompts/az-test-build-release-system.md`
33. `dev/test-prompts/az-v0.0.23-harness-live-test.md`

### Current Nova channel and recent release records

34. Current files in `dev/nova/inbox/` and `dev/nova/outbox/`
35. Relevant archived release audits and responses under `dev/nova/inbox/archive/` and `dev/nova/outbox/archive/`
36. Recent release handoffs under `dev/session-summaries/`
37. `dev/fids/FID-2026-0812-008-project-wide-production-cleanup-and-release-readiness.md` — active cleanup FID; audit its RED/GREEN scope, blockers, and non-mutation boundary

## Required audit questions

### A. Release correctness

1. Does `scripts/public-release.ts` remain the one canonical release engine?
2. Are preview, diagnose, go, resume, and CLI `/release` surfaces correctly separated by mutation boundary?
3. Does the `.env.local`/canonical production profile switch restore process environment and settings on success, failure, timeout, and partial release paths?
4. Are credentials excluded from release profiles, command arguments, receipts, transcripts, package contents, and Git history scans?
5. Does the five-target CI workflow build, package, upload, and verify every required tarball and runtime sibling asset?
6. Are package scopes and publication order current and unambiguous? Identify whether the next release publishes `savant-code`, `@savant-code/sdk`, or both; do not infer from historical v0.0.21/v0.0.22 notes.

### B. Project hygiene and bloat

7. Classify the 474 untracked paths into production source, required docs/audit evidence, generated output, scratchpad, or remove/archive candidate.
8. Determine the intended status of root `nul` and tracked/modified `cli/release-staging/`.
9. Review all 32 quality-ratchet failures. For each, decide whether it requires decomposition, a legitimate tracked approval/rationale/maxLines entry, or a defect fix. Raising baselines without justification is not acceptable.
10. Identify outdated scripts, duplicate release systems, dead package manifests, stale CI references, and broken active documentation links. Historical archives must be preserved and separated from active findings.
11. Audit FID-2026-0812-008 for scope completeness and convergence readiness; do not treat its `created` status or proposed GREEN plan as implementation completion or release authorization.

### C. Verification

11. Confirm the exact current version and manifest synchronization.
12. Confirm active FID queue and closure/archive integrity against filesystem evidence.
13. Confirm generated artifacts are synchronized and no source is accidentally relying on stale generated output.
14. Confirm the full test/typecheck/lint/format/markdown/package gate results from direct command output, not a summary that hides failures or truncation; specifically review the two current markdownlint failures listed above.
15. Identify what still needs live operator evidence: CLI TUI, Ollama/provider routing, fresh npm install, five-platform binaries, GitHub release assets, and offline/browser workflows.

## Required output

Return a structured report with:

1. `PASS`, `FAIL`, or `NEEDS-REVIEW` for each audit section and each critical claim.
2. Exact `file:line` evidence for every nontrivial verdict.
3. A complete blocker list, with severity and reproducible command.
4. A separate list of historical/intentional references that must not be “cleaned up.”
5. A complete list of files/artifact classes requiring operator disposition.
6. A release decision: `GO`, `GO WITH CAVEATS`, or `NO-GO`.
7. Explicit confirmation that this review performed no source, history, credential, GitHub, npm, or deployment mutation.
8. Conditions required before a later release-session request can be approved.

## Decision rule

The current expected posture is **NO-GO pending remediation and re-audit**, because `validate:repository` and `release:public:diagnose` fail on 32 quality-ratchet findings, `lint:md` fails on two design documents, and the worktree contains hundreds of unclassified untracked paths. Change that verdict only with direct evidence that closes those findings; do not convert working-tree evidence into clean-release certification by assertion.
