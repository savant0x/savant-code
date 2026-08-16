<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Scope — v0.0.24 Release-Readiness Audit

Scope for `FID-2026-0815-016` (project-wide release-readiness audit). Checked =
closed/complete. Unchecked = awaiting operator approval/execution.

## Operator directives

- NOTHING is ever "out of scope" unless the operator explicitly says so. Default = include everything.
- DO NOT proceed with execution without presenting the converged FID for approval first (Law 2).
- Governing protocol is `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO).
- Audit the whole project before any push: every gate, every doc, every README, folder hygiene, A–Z + full harness run.

## Work items (FID-2026-0815-016 — converged, awaiting approval)

- [ ] Phase 0: baseline + freeze (`git status --short`, `VERSION`, commit identity)
- [ ] Phase 1 (R-01): full gate sweep — `validate:repository`, `version:check`, `generate:protocol-bundle:check`, `generate:provider-docs:check`, `design-systems:check`, `learnings:check`, `audit:evidence`, `hygiene:check`, `quality:report`, + 6 pre-push gates
- [ ] Phase 2 (R-02): extend A–Z prompt to version `0.0.24` covering FID-2026-0815-001..015
- [ ] Phase 3 (R-03): full harness live test of the `0.0.24` prompt; tree unchanged at end
- [ ] Phase 4 (R-04/R-05): organize `dev/` + `nova/` — archive completed exchanges, dispose stray files, document/relocate `idea-shelf`, decision on `session-summaries` archive
- [ ] Phase 5 (R-06/R-07): classify + line-verify all `docs/**` and all 37 READMEs against code
- [ ] Phase 6 (R-08): CHANGELOG ↔ archive ↔ `features.md` consistency + 0.0.24 release notes (if wanted)
- [ ] Phase 7 (R-09): bloat/out-of-place sweep (`hygiene:check` + manual)
- [ ] Phase 8: write `dev/releases/0.0.24-release-checklist.md`; final tree-baseline check

## Operator decisions (resolved)

1. `session-summaries/` — **keep in place** (no archive).
2. `docs/` one-off design/research/launch artifacts — **move to `docs/archive/`** (per-file `git mv`, never deleted).
3. A–Z — **extend existing prompt** in place, version `0.0.24`.
4. Release notes — **rely on CHANGELOG** (manually maintained; release pipeline extracts from it). No separate `release-notes-v0.0.24.md` unless requested.

## Out-of-scope items

_(none — per operator directive, everything is in scope. No push/tag/publish/release-mutation at any point.)_
