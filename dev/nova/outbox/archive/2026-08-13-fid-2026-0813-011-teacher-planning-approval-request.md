# Nova Planning Approval Request — Agent-Steering Teacher

**Date:** 2026-08-13
**Status:** AWAITING NOVA REVIEW — FULL FID-SET LOOP 4 COMPLETE
**Master FID:** `FID-2026-0813-011`
**Children:** `FID-2026-0813-012` through `FID-2026-0813-020`
**Build order:** `dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md`
**Authoritative architecture:** `docs/design/Agent-Steering Teacher Homegrown Architecture.md`
**Prior exploration:** fCC-centered documents are explicitly marked superseded.

## Approval boundary

The Agent-Steering Teacher concept and its complete FID set have completed the
planning Perfection Loop, including a full re-run of every child and the master /
organizing FID (`FID-2026-0813-011`). The build order and FID set are
planning-only. No teacher production code has been written, and no
implementation is authorized by this request.

Please independently audit the live working tree and return a per-target
`PASS`, `FAIL`, or `NEEDS-REVIEW` with path/line evidence. A planning PASS would
clear the design for operator decision and later implementation routing; it
would not authorize implementation, commit, push, publication, deployment, or
release.

## Requested audit targets

1. **Master convergence** — confirm the concept is fully integratable through
   existing ECHO, runtime, CLI, SQLite, and ZTAP boundaries without a law change.
2. **Pedagogy/contracts (`012`)** — confirm target learner, skill taxonomy,
   public/private challenge schema, mutation/critique contracts, and honest
   progression claims are complete.
3. **Sandbox (`013`)** — confirm worker-only execution is rejected as a security
   claim, capability-based isolation is fail-closed, and the escape matrix is a
   hard implementation gate.
4. **Vertical slice (`014`)** — confirm one complete headless exercise is required
   before corpus-scale generation or UI work.
5. **Corpus (`015`)** — confirm operator-owned pedagogy, agent-assisted
   authoring, independent validation, content hashes, and private answer
   isolation.
6. **Equivalence (`016`)** — confirm hidden behavioral tests and anti-cheat
   fixtures are primary, with AST analysis only as a signal.
7. **Detection (`017`)** — confirm deterministic mutation contracts, structured
   critique evidence, bounded Adversary adjudication, and calibration/held-out
   gates.
8. **Overlay (`018`)** — confirm `/learn` is a presentation/input consumer with
   no tool, corpus, grader, progression, or filesystem authority.
9. **Progression (`019`)** — confirm local-only versioned records and the ZTAP
   process-evidence claim boundary; no proof-of-skill overclaim.
10. **Integration audit (`020`)** — confirm final security, privacy, call-graph,
    calibration, and repository gates are present and ordered last.
11. **Governance/documentation** — confirm stale fCC research is marked
    superseded, ZTAP's completed status is accurate, and the active FID index is
    reconciled.

## Hard questions Nova should challenge

- Is the proposed sandbox boundary actually implementable on the supported
  Windows/Bun target, or should the feature report `unavailable` until a stronger
  backend exists?
- Are the grading contracts strong enough to distinguish learner judgment from
  a capable Forge model solving despite weak steering?
- Does the private answer pack remain unreachable through paths, imports,
  environment variables, errors, stdout, or shared process state?
- Are the evidence and progression claims narrower than the implementation can
  prove?
- Does the phase order minimize value risk without prematurely scaling content?

## Current local planning evidence

- Full FID-set Perfection Loop re-run — 10/10 FIDs contain `Loop 4`, including
  the master/organizing FID and all children `012` through `020`.
- `bun test scripts/fid-ledger.test.ts` — 5 pass / 0 fail
- Repository Markdownlint — pass
- Targeted Markdownlint — pass for build order, authoritative architecture, and
  all teacher FIDs
- Targeted Prettier — pass
- Active teacher FID count — 10 records, all `verified` planning status
- Active-FID index — reconciled with the master and child set
- Teacher production implementation — none
- ZTAP — already implemented, archived, and independently signed off; consumed
  through an adapter rather than treated as an active parallel build

## Perfection Loop re-run disposition

- **RED:** Shared quantitative acceptance thresholds were missing from the
  earlier planning set.
- **GREEN:** Default repeatability, zero-observed-escape, mutation-evidence, and
  critique-calibration gates were added to the build order, architecture, and
  owning child FIDs.
- **AUDIT:** The dependency graph, active statuses, documentation consistency,
  and no-production-code boundary were rechecked across all 10 records.
- **ADVERSARIAL:** Thresholds remain implementation policy, not proof of runtime
  success. Nova must reject any future implementation claim without executable
  evidence, and any sandbox escape remains a hard blocker.
- **Master result:** `FID-2026-0813-011` remains the single organizing FID;
  no duplicate master was created.

## Requested verdict format

```text
Overall: PASS | FAIL | NEEDS-REVIEW
FID-2026-0813-011: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
FID-2026-0813-012: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
...
FID-2026-0813-020: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
Blocking findings: <none or numbered findings>
Residual non-blocking notes: <notes>
Implementation authorization: NONE
```
