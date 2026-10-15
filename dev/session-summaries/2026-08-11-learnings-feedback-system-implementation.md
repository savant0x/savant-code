# Session 2026-08-11: LEARNINGS Feedback-System Remediation

## Initial State

The approved planning package FID-2026-0811-028 and child FIDs 022–029 are
converged and received Nova planning-audit PASS plus operator automation-level-3
approval. The working tree is intentionally dirty from prior release and audit
work.

## Intended Work

Implement the approved package in dependency order:

1. Establish a curated, privacy-safe embedded learning source while retaining internal history.
2. Add structured learning records and validation with an explicit legacy boundary.
3. Enforce chronology and insertion-marker rules for structured records.
4. Add stable evidence-reference resolution and a canonical rule catalog.
5. Mark superseded guidance and validate replacement/canonical links.
6. Correct the multi-agent harness versus separate single-agent protocol wording and boundary assertions.
7. Add a thin local release preflight over existing release gates, with
   pinned-toolchain and lockfile checks and fail-closed timeout handling.

## Boundaries

No credentials, publication, deployment, remote mutation, commit, push, tag, or
release action is authorized. Historical learning prose, changelog records, Nova
correspondence, and archived FIDs remain preserved except for narrowly scoped
current guidance corrections. Generated artifacts will be regenerated only
through their existing generators.

## Verification Plan

Run focused learning and protocol tests first, then repository validation,
typechecks, package tests, ESLint, Markdownlint, Prettier, quality/hygiene
checks, protocol/provider drift checks, and the audit-evidence command.
Implementation status will be updated only after independent static/runtime
review and direct command evidence.
