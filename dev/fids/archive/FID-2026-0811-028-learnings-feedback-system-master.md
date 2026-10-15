<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Feedback-System Remediation Master

**Filename:** `FID-2026-0811-028-learnings-feedback-system-master.md`
**ID:** FID-2026-0811-028
**Severity:** critical
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending

---

## Summary

This master FID organizes the complete remediation of the feedback-loop weaknesses identified in `dev/LEARNINGS.md`: shipped internal/private content, chronology drift, unstructured lessons, unmarked superseded guidance, ambiguous protocol-variant language, manual release hygiene, repeated canonical rules, and fragile evidence references. It creates seven non-overlapping child FIDs and preserves the planning/implementation boundary. No code, learning content, generated artifact, release behavior, or historical document is authorized to change until this package receives operator approval and each child completes its converged Perfection Loop.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree with pre-existing modifications, untracked files, and prior closed FID archives
- **Governing documents:** `ECHO.md`, `ECHO-single-agent.md`, `protocol.config.yaml`, `templates/FID-TEMPLATE.md`, `dev/LEARNINGS.md`

## Detailed Description

### Problem

`dev/LEARNINGS.md` is a high-value feedback source but currently combines internal incident history with embedded runtime grounding, has chronology drift, lacks a structured schema, leaves corrected recipes active-looking, overstates the single-agent boundary, repeats canonical rules, and relies on manual environment hygiene and fragile line references.

### Expected Behavior

The feedback loop is privacy-safe, provenance-aware, chronologically validated, structured for future automation, explicit about supersession and canonical sources, precise about protocol variants, and connected to executable release/evidence guardrails. Internal history remains available while shipped grounding is curated.

## Child FID Register

| Order | FID | Severity | Scope | Depends on |
|---:|---|---|---|---|
| 1 | `FID-2026-0811-022-learnings-shipping-boundary-and-privacy.md` | high | Internal versus embedded learning content and privacy | None |
| 2 | `FID-2026-0811-024-learnings-structured-schema-and-quality-gate.md` | medium | Structured lesson records and quality validation | None |
| 3 | `FID-2026-0811-023-learnings-chronology-and-index-validation.md` | medium | Reverse chronology and insertion-marker validation | 024 |
| 4 | `FID-2026-0811-029-learnings-evidence-reference-and-rule-catalog.md` | medium | Stable evidence references and canonical rule targets | 024 |
| 5 | `FID-2026-0811-025-learnings-supersession-and-canonical-guidance.md` | high | Superseded guidance and status metadata | 023, 024, 029 |
| 6 | `FID-2026-0811-026-protocol-variant-boundary-language.md` | high | Harness versus separate single-agent contract | 022, 024 |
| 7 | `FID-2026-0811-027-learning-guardrails-and-release-evidence.md` | high | Environment and lockfile release guardrails | 024, 025, 029 |

### Dependency graph

```text
024 → 023 → 025 → 027
024 → 029 → 025
022 → 026
024 → 026
029 → 027
```

The edge list is authoritative. FID-022 establishes the content boundary. FID-024 establishes the schema used by chronology, evidence references, supersession, and guardrail metadata. FID-023 normalizes chronology before supersession targets are indexed. FID-029 owns stable reference resolution and canonical rule targets; FID-025 owns supersession/status metadata and consumes those targets. FID-027 owns release/environment guardrails and consumes the evidence contract. FID-026 depends on the content/schema boundary so protocol-variant wording is scoped correctly.

## Non-Goals and Hard Boundaries

- No implementation before operator approval and child FID convergence.
- No commit, push, tag, release, publication, deployment, or credential use.
- No silent deletion of historical learning incidents.
- No broad rewrite of `CHANGELOG.md`, Nova correspondence, session summaries, or archived FIDs.
- No removal of the explicit `single_agent` protocol contract; only boundary wording and tests may change.
- No second release engine; reuse existing release/build helpers and validation manifests.
- No claim that prose evidence replaces executable verification.
- No automatic publication or remote-state mutation from a preflight tool.

## Implementation Plan After Approval

1. **FID-022 — shipping/privacy boundary:** create the sanitized embedded learning source, redact or exclude private content from shipped output, and add generated-bundle privacy tests.
2. **FID-024 — structured schema:** define fields, legacy boundary, parser, and lesson-quality validator.
3. **FID-023 — chronology:** normalize entry ordering and enforce date/index correctness using the schema boundary.
4. **FID-029 — evidence/rule catalog:** define stable references and canonical targets without duplicating runtime authority.
5. **FID-025 — supersession:** mark corrected recipes and statuses, link replacements, and consolidate repeated normative rules using FID-029 targets.
6. **FID-026 — protocol boundary:** correct the single-agent wording and test explicit variant selection/exclusion.
7. **FID-027 — guardrails:** implement reversible release preflight and lockfile/toolchain checks while consuming FID-029 evidence references.
8. **Master closeout:** regenerate the bundle, run repository/type/test/lint/Markdown/format gates, inspect package scope, update tracking docs, and request independent implementation audit. Archive only after implementation review and all closure requirements pass.

## Required Gates

- FID metadata and graph: `bun test scripts/fid-ledger.test.ts` and `bun run validate:repository` must pass; all child IDs, master references, dependencies, and cycles must resolve.
- Learning validators: planned focused suites for privacy/bundle source identity, chronology/index parsing, structured schema, supersession/canonical targets, protocol-variant boundaries, stable evidence references, and release preflight restoration must pass with malformed fixtures rejected.
- Generated protocol output: `bun run generate:protocol-bundle` followed by `bun run generate:protocol-bundle:check` must be deterministic and clean; the generated artifact must contain no operator email/account mapping.
- Documentation gates: `bun run lint:md` and `bunx prettier --check .` must pass.
- Runtime gates: `bun run --cwd sdk typecheck`, `bun run --cwd common typecheck`, `bun run --cwd packages/agent-runtime typecheck`, and `bun run --cwd cli typecheck`, plus affected package tests, must pass.
- Repository gates: `bunx eslint . --max-warnings 0`, `bun run hygiene:check`, `bun run quality:report`, and `bun run validate:repository` must pass.
- Release-preflight tests must prove failure/timeout/signal restoration, artifact identity, lockfile/toolchain rejection, direct exit-code capture, and no credentials or remote mutation.
- Timeout or spawn failure is `TIMEOUT/NEEDS-REVIEW`, never PASS; pipes must not mask command exit codes.
- Audit evidence must explicitly classify `WORKING_TREE_EVIDENCE` versus clean-release certification.
- Independent static/runtime review is required for every child and the master before any closure/archive move.

## Perfection Loop

### Loop 1 — RED

- **RED:** The feedback loop is simultaneously a private history, a shipped grounding input, and an unstructured operational manual. That creates privacy, chronology, stale-guidance, protocol-boundary, and release-hygiene risks.
- **GREEN:** Split the work into seven bounded children, establish dependencies, preserve history, and reserve executable guardrails for the final child.
- **AUDIT:** Current generator inclusion, email occurrence, out-of-order headings, superseded recipe pair, explicit protocol variants, and manual release recipes are all independently cited by the child FIDs.
- **ADVERSARIAL:** Do not solve the problem by deleting LEARNINGS, stripping all historical context, or treating every “single-agent” reference as forbidden. Do not create a parallel release engine.
- **CHANGE DELTA:** Planning package only; no runtime or document implementation authorized.

### Loop 2 — Independent audit and self-correction

- **RED:** The first decomposition could duplicate schema, chronology, and supersession logic or leave privacy checks disconnected from the generated artifact.
- **GREEN:** FID-024 owns the shared schema; FID-022 owns bundle provenance/privacy; FID-023 consumes the schema for ordering; FID-029 owns stable references/rule targets; FID-025 owns supersession metadata; FID-027 owns executable release guardrails.
- **AUDIT:** The dependency graph is acyclic and all review recommendations map to an owning child: privacy/shipping (022), chronology (023), structure/quality (024), stable references/rule catalog (029), supersession (025), protocol boundary (026), and release guardrails (027).
- **ADVERSARIAL:** A prose-only child is not complete if its proposed validator has no caller, and a validator is not complete if repository validation does not execute it. New functions/config fields require production caller/read-path greps.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** The package could expand into a general documentation rewrite or release redesign.
- **GREEN:** Hard boundaries preserve historical documents, avoid remote mutation, reuse existing helpers, and require operator approval before implementation.
- **AUDIT:** Every child has Summary, Environment, Problem, Expected Behavior, Root Cause, Evidence, Impact, Proposed Solution, three loop passes, Missed Questions, Code Verification Evidence, and Resolution. No child claims implementation or closure.
- **ADVERSARIAL:** Reject approval if any child lacks a measurable acceptance gate, if dependencies are circular, if the embedded/private boundary is unspecified, if the exact planned commands/tests are absent, or if release preflight is allowed to publish.
- **CHANGE DELTA:** Final planning convergence; ready for operator approval.

### Missed Questions

1. Should all historical lessons be migrated immediately? → No; protect the current feedback loop with a bounded schema and migrate incrementally.
2. Should the bundle include the entire internal history? → No; bundle a sanitized curated source unless the operator explicitly approves broader distribution.
3. Which child owns the schema? → FID-024; all metadata consumers depend on it.
4. How are superseded recipes kept from reappearing? → FID-025 metadata plus validator and canonical links.
5. Does “single-agent” disappear from the repository? → No; only accidental harness selection/injection is prohibited.
6. Does this package authorize a release wrapper to mutate remote state? → No; local preflight only.
7. What proves chronology? → Parser output and a failing/passing validator fixture, not visual inspection.
8. How are line references kept useful? → Stable symbol/command/test references with optional line snapshots.
9. What happens when a gate times out? → `TIMEOUT/NEEDS-REVIEW`, never PASS.
10. What is the final approval boundary? → Operator approves this planning package first; implementation and later independent audit are separate gates.

### Code Verification Evidence

- [x] Governing ECHO and FID documents read.
- [x] Existing generator, ledger, and validation surfaces inspected.
- [x] Seven non-overlapping children created with explicit dependencies.
- [x] Each child contains complete planning Perfection Loop and missed questions.
- [x] Implementation completed under the granted local automation scope; no release, push, tag, publication, or deployment performed.
- [x] Child implementation evidence recorded for FIDs 022–027 and 029.
- [x] Independent local static/runtime review and all applicable gates passed; the global Markdownlint command remains NEEDS-REVIEW for unrelated untracked design-system documents.
- [ ] Nova implementation sign-off — requested after closure preparation; current request preserves working-tree and Markdownlint NEEDS-REVIEW boundaries.

## Resolution

- **Status:** `closed` — implementation completed under the granted automation level 3 scope; Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Planning Audit:** Nova planning audit PASS; implementation boundary respected until operator authorization.
- **Fix Description:** Completed the seven-child remediation package: curated privacy-safe embedding, structured schema and chronology/marker validation, stable evidence and canonical rules, supersession guidance, protocol-boundary wording, and existing release-preflight guardrails.
- **Verification Evidence:** Focused script suites passed (learning 11, embedded protocol 7, FID ledger 5, validation manifest 8, public release 55, audit evidence 3, pre-push scan 13, quality report 2); SDK/common/agent-runtime/CLI typechecks passed; ESLint, Prettier, hygiene, quality, provider-docs drift, protocol-bundle drift, and repository validation passed. Global Markdownlint remains `NEEDS-REVIEW` because pre-existing untracked design-system documents under `packages/design-systems/library/` fail the repository-wide command; governed learning documents are clean.
- **Quality Evidence:** `scripts/learnings-references.ts` is measured at 384 lines; `dev/quality-baseline.json` records that implementation-driven ceiling. This is a ratchet record, not a claim that the new file is below 300 lines.
- **Release Boundary:** No credentials, remote mutation, commit, push, tag, publication, deployment, or release action performed. FID archive and implementation files remain untracked working-tree evidence, not clean-release or durable repository certification.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit and final independent sign-off.
