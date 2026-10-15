<!-- markdownlint-disable MD013 -->

# Nova Planning-Phase Audit Request — FID-2026-0809-012 through 018 (Optimization Program)

**Date:** 2026-08-09
**To:** Nova — independent third-party ECHO auditor
**Scope:** Independent planning-phase audit of the seven converged FIDs in `dev/fids/`:
`FID-2026-0809-012` (master) and children `FID-2026-0809-013` through `FID-2026-0809-018`.
**Status:** AWAITING NOVA PLANNING AUDIT
**Priority:** Medium

> **Active single-agent document policy:** This request contains no signature or author-attribution
> fields. It speaks for itself under `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

---

## 1. Purpose

The operator directed a full audit continuation: address **all four tiers** of optimization and
compliance debt identified in the 2026-08-09 deep audit as multiple FIDs under one master. The seven
FIDs are **planning-only** (`Status: analyzed`) — they define and converge the program but authorize
**no implementation**. Each has run the Perfection Loop: Loop 1 (RED/GREEN/AUDIT/ADVERSARIAL),
Loop 2 (independent correction pass), and — for the master, FID-013, and FID-015 — Loop 3 (second
independent correction pass). Two independent adversarial reviews were executed; every finding was
closed and re-verified against the live tree.

This request asks Nova to audit the **planning convergence and cross-FID coherence** before any
implementation begins. It does not ask for any commit, push, release, publication, deployment,
credential use, or production mutation — source and planning review only.

## 2. Governance state

| Gate | Current state | Evidence/status |
|---|---|---|
| Planning convergence | PASS | Perfection Loops 1–3 recorded in each FID; two independent adversarial reviews, all findings closed |
| Operator approval | Not granted | Implementation explicitly blocked pending operator approval + Nova sign-off |
| Nova planning audit | **PENDING** | Requested by this report; no sign-off is inferred |
| Implementation | Not performed | No production code changed under any of the seven FIDs |
| Commit/push/release | Not performed | No commit, push, publish, or deployment was requested or performed |

## 3. The FID bundle under review

| FID | Tier | Scope | Depends on |
|---|---|---|---|
| `FID-2026-0809-012-optimization-program-master-plan-all-tiers.md` | master | Coordinates 013–018; invariants, gate matrix, sequence, rollback | — |
| `FID-2026-0809-013-release-gate-restoration.md` | 0 | Two untracked MD013 design docs break `lint:md` (pre-push hard gate) | None |
| `FID-2026-0809-014-no-signature-policy-scrub.md` | 1 | Remove `Author: Savant` from 3 tracked docs; document 16 historical-summary exemption | None |
| `FID-2026-0809-015-file-length-batch-a-oversize-regressions.md` | 2 | 6 production files > 500 lines (incl. `context-pruner/main.ts` 395→756 regression, `export/helpers.ts` 691 leftover) | 013 |
| `FID-2026-0809-016-file-length-batch-b-400-500.md` | 2 | 17 production files in the 400–500 range | 013, 015 |
| `FID-2026-0809-017-test-suite-decomposition.md` | 2 | 14 test files > 500 lines | 013, 015 |
| `FID-2026-0809-018-agent-prompt-token-optimization.md` | 3 | ≈31 KB Savant prompt stack + 29 KB context-pruner payload | 013, 015 |

## 4. Perfection Loop evidence

- **Loop 1** (each FID): RED evidence gathered from the live tree (line counts, signature hits,
  `lint:md` output, prompt sizes); GREEN converged plan; AUDIT with file:line citations;
  AUDIT ADVERSARIAL CHECK; CHANGE DELTA (planning-only, 0%).
- **Loop 2** (each FID): first independent adversarial review — corrections recorded in every FID:
  - 013: removed misattributed operator-intent quote; surfaced scratchpad cross-reference.
  - 015: added shared-mutable-state consolidation (`database.ts:39,50`; `run-state-storage.ts:51,166,287,290`)
    and a cycle guard for the `export/helpers.ts` split.
  - 017: renamed split convention to `*-part-a.test.ts` (matches Bun's `*.test.ts` glob) + pre/post
    `bun test` count gate.
  - 018: explicit sequencing vs 015 for the `context-pruner/main.ts` dual ownership.
  - 016: disambiguated `agent-runtime/util/messages.ts` (478 ln) from `common/util/messages.ts` (19-ln shim).
  - 014: full evidence re-verification.
  - 012: dependency-table corrections.
- **Loop 3** (master, 013, 015): second independent adversarial review — final corrections:
  - 012: dependency graph finalized (018 → `013, 015`; unexplained 014 edge removed; table aligns
    with sequence narrative).
  - 015: state-consolidation marked as the single explicit exception to the pure-move invariant;
    immutable-only modules enumerated.
  - 013: delete-path scratchpad disposition stated.

## 5. Live-tree evidence anchors (re-verified at audit time)

- `lint:md` fails on exactly `docs/design/Savant Command Center Design Concept.md` and
  `docs/design/Visual Workflows For Savant-Code.md` (both untracked `??`).
- `Author: Savant` at `docs/reports/feature-parity-report.md:9`,
  `docs/research/Agent Harness Feature Pairing Research.md:3`,
  `docs/research/Harness Engineering for Coding Agents Research.md:3`.
- `wc -l` inventory: 23 production files > 400, 14 test files > 500 (line counts cited per FID).
- `wc -c`: `agents/context-pruner/main.ts` 29,039; `agents/savant/system-prompt.ts` 16,772;
  `agents/savant/prompts.ts` 15,010; `agents/tmux-cli/prompts.ts` 7,441.
- Shared mutable state confirmed: `sdk/src/impl/database.ts:39,50`; `cli/src/utils/run-state-storage.ts:51,166,287,290`.
- `readFilePreview` call chain: `packages/knowledge-graph/src/export/helpers.ts:578,660`; `serialize.ts:27`.
- `bunfig.toml` has only `test.exclude` (default `*.test.ts` discovery applies).

## 6. Requested Nova review

Please independently review the seven FIDs in `dev/fids/` and return an inbox response containing:

1. **Verdict for the planning phase:** PASS, FAIL, or NEEDS-REVIEW — per FID and overall.
2. Exact `path:line` evidence for every verdict, particularly:
   - Cross-FID dependency coherence (master table vs sequence narrative).
   - Whether the Loop-2/Loop-3 corrections actually closed the adversarial findings.
   - Whether each plan's evidence anchors are accurate against the live tree.
   - Whether the planning-only boundary and no-signature policy are respected.
   - Whether Tier-2 extraction plans preserve the re-export-shim / byte-identity discipline.
   - Whether the serialized-agent factory-pattern approach for `context-pruner/main.ts` is sound.
3. Confirmation that no implementation, commit, push, release, credentials, or remote state changed.
4. Assessment of whether the program is ready for operator approval to proceed to implementation
   (or which FIDs need correction first).
5. An overall verdict:
   - `PASS — planning independently signed off`,
   - `FAIL — planning correction required`, or
   - `NEEDS-REVIEW — named evidence remains outstanding`.

No source modification is requested during the review. If Nova finds a planning defect, identify the
smallest corrective change to the affected FID and stop before expanding scope.
