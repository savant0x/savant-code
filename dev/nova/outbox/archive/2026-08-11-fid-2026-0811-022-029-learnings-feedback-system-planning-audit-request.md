<!-- markdownlint-disable MD013 -->

# Nova Planning-Phase Audit Request — LEARNINGS Feedback-System Remediation (FIDs 022–029)

**Date:** 2026-08-11
**To:** Nova — independent third-party ECHO auditor
**Scope:** Planning convergence for FIDs 022–029, including master FID-2026-0811-028
**Status:** AWAITING NOVA PLANNING REVIEW
**Priority:** High
**Method requested:** Read every listed FID 0-EOF, independently verify material planning claims against the current working tree, check the dependency graph and Perfection Loop completeness, and return `PASS`, `FAIL`, or `NEEDS-REVIEW` with exact `path:line` evidence. Do not modify repository files during review.

> **Planning boundary:** This request audits planning only. No implementation, learning-file rewrite, generator change, bundle regeneration, release-preflight mutation, commit, push, tag, publication, deployment, credential use, or archive move is authorized by this request.
>
> **Document policy:** No signatures, author attribution, or agent names are requested or added. The documents speak for themselves.

## Review Documents

1. `dev/fids/FID-2026-0811-028-learnings-feedback-system-master.md`
2. `dev/fids/FID-2026-0811-022-learnings-shipping-boundary-and-privacy.md`
3. `dev/fids/FID-2026-0811-023-learnings-chronology-and-index-validation.md`
4. `dev/fids/FID-2026-0811-024-learnings-structured-schema-and-quality-gate.md`
5. `dev/fids/FID-2026-0811-025-learnings-supersession-and-canonical-guidance.md`
6. `dev/fids/FID-2026-0811-026-protocol-variant-boundary-language.md`
7. `dev/fids/FID-2026-0811-027-learning-guardrails-and-release-evidence.md`
8. `dev/fids/FID-2026-0811-029-learnings-evidence-reference-and-rule-catalog.md`
9. `dev/LEARNINGS.md`
10. `scripts/generate-protocol-bundle.ts`
11. `scripts/fid-ledger.ts`
12. `scripts/validation-manifest.ts`
13. `ECHO.md`
14. `ECHO-single-agent.md`
15. `protocol.config.yaml`

## Planning Targets

Please independently verify:

1. **Coverage:** FIDs 022–029 cover every material recommendation from the LEARNINGS review: privacy/shipping boundary, chronology, structure/schema, supersession, protocol-variant wording, release/lockfile guardrails, and stable evidence/canonical rule references.
2. **Scope separation:** FID-022 owns embedded-content provenance/privacy; FID-024 owns the shared lesson schema; FID-023 owns chronology; FID-029 owns stable references and canonical rule targets; FID-025 owns supersession/status metadata; FID-026 owns protocol-variant boundary wording/tests; FID-027 owns release environment and lockfile guardrails.
3. **Privacy boundary:** The package does not silently delete internal history and explicitly addresses the operator email/account mapping currently present in the generated bundle input.
4. **Protocol boundary:** The package preserves the explicit `single_agent` protocol while preventing accidental harness selection, injection, or bundling of that protocol.
5. **Dependency graph:** The master register includes all seven children; every dependency resolves; the graph is acyclic; implementation order follows the declared dependencies.
6. **Perfection Loops:** Every child and the master contains RED, GREEN, AUDIT, ADVERSARIAL, three convergence passes, and Missed Questions with answered defaults.
7. **Acceptance gates:** The master names concrete validation commands and requires malformed fixtures, direct exit-code capture, timeout classification, generated-bundle drift checks, workspace typechecks, tests, lint, Markdownlint, Prettier, hygiene, quality, and repository validation.
8. **Release safety:** The proposed release preflight is local-only, reversible, does not publish or mutate remote state, and does not create a second release engine.
9. **Historical preservation:** The package does not authorize broad rewrites of changelog history, Nova correspondence, session summaries, or archived FIDs.
10. **Implementation boundary:** All child records remain `analyzed`; implementation is explicitly gated on operator approval followed by child implementation review and a separate implementation audit.

## Required Evidence

For every material PASS or FAIL, provide exact `path:line` citations and quoted text. For absence-shaped claims, paste the exact search command and result. If a claim cannot be independently reached, mark it `NEEDS-REVIEW` rather than inferring a PASS.

Please specifically check:

- The email/account mapping in `dev/LEARNINGS.md` and its inclusion path through `scripts/generate-protocol-bundle.ts`.
- The out-of-order August 4–5 entries in `dev/LEARNINGS.md`.
- The older clean-shell recipe versus the later corrected canonical-env lesson.
- The “zero single-agent concept” wording versus `ECHO-single-agent.md` and `single_agent.protocol`.
- The child/master IDs, `Master FID` metadata, `Depends On` fields, and dependency edge list.
- The exact planned command list in FID-2026-0811-028.

## Commands to Re-run Where Practical

- `bun test scripts/fid-ledger.test.ts`
- `bun run validate:repository`
- `bun run lint:md`
- `bunx prettier --check dev/fids/FID-2026-0811-{022,023,024,025,026,027,028,029}-*.md`
- `bun run generate:protocol-bundle:check`

If any command is unavailable, times out, or is environment-limited, report the exact limitation and mark the affected target `NEEDS-REVIEW`. Do not treat a timeout as PASS.

## Current Planning Evidence

- FID ledger tests: 5 passed, 0 failed.
- `bun run validate:repository`: `validation: PASS`.
- `bun run lint:md`: exit 0.
- Prettier check on FIDs 022–029: `All matched files use Prettier code style!`.
- Active inventory: exactly eight active FIDs, 022–029; all child/master records have `Status: analyzed`.
- All seven child records reference `Master FID: FID-2026-0811-028`.
- The working tree is dirty due to extensive pre-existing changes; any evidence is working-tree evidence, not clean-release certification.

## Required Response

Return a new response in `dev/nova/inbox/` containing:

- Target-by-target `PASS`, `FAIL`, or `NEEDS-REVIEW` for targets 1–10;
- exact `path:line` evidence for every material claim;
- commands and exit codes independently rerun;
- any critical/high planning blockers, scope overlaps, missing dependencies, or incomplete Perfection Loops;
- explicit confirmation that no repository files were modified during review;
- explicit confirmation that this request authorizes no implementation or release action;
- one overall planning verdict using exactly one of:
  - `PASS — planning approved for operator implementation decision`
  - `FAIL — planning correction required`
  - `NEEDS-REVIEW — named planning evidence remains unavailable`.

A Nova planning verdict is independent planning evidence. It does not authorize implementation, commit, push, publication, deployment, or archive moves.
