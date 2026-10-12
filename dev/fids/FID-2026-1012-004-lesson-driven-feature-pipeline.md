# FID: Lesson-driven feature pipeline

**Filename:** `FID-2026-1012-004-lesson-driven-feature-pipeline.md`
**ID:** FID-2026-1012-004
**Severity:** high
**Status:** verified
**Created:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Preserve the lesson ledger and turn reviewed gaps into traceable feature
candidates, using the existing session-end/FID workflow. A lesson is not proof
that its original defect still exists. The operator explicitly replaced ledger
cleanup with this pipeline.

## Environment

- Windows, Bun 1.3.14, initial HEAD 09d212eb.
- Read dev/LEARNINGS.md 0-EOF: 133,263 characters, 74 headed entries.
- User-owned experience/telemetry changes and deletion of the preaudit baseline
  remain untouched. No release or remote write is authorized.

## Detailed Description

### Problem

The existing capture, dedup, lesson validation, wiki, quarantine and session-end
review mechanisms do not maintain an evidence-reviewed feature backlog. Old
lessons mix implemented guards, still-relevant invariants and dated proposals.
Treating each as a new defect would rebuild existing features; deleting them
would lose the rationale and evidence.

### Expected Behavior

An inspectable candidate record names its source lessons, user-visible outcome,
priority, current gap evidence, acceptance criteria and optional owning FID.
Source changes invalidate readiness. Routed work has a real FID owner; an
implemented claim requires closed-FID implementation evidence. Proposals do not
authorize execution or skill release. Missing stores are quiet in other repos;
invalid stores report a review issue without disabling the existing hook.

### Root Cause and evidence

- scripts/session-end-review.ts produces recurrence/FID notes but no persistent
  feature-candidate state. scripts/lessons-to-skills.ts already parses lessons.
- Scholarly calls in debug/cli.jsonl:2515-2540 confirm all four tools succeed
  with typed parameters; citation fallback is a coverage issue.
- sdk/src/tools/read-files.ts truncates before handleReadFiles slices lines;
  the full ledger has 2,147 lines but its capped prefix only 1,552.
- The child context extractor drops compression/contextWindow; micro-compaction
  occurs at 11% despite protocol.config.yaml declaring microCompact:false.
- Chat-state database serialization fails six times at 17:34-17:43 UTC. This
  proves a persistence fault, not that all filesystem checkpoints failed.
- read_url already checks status/content type before extraction. Adding the
  report's suggested preflight would duplicate existing behavior.

## Impact Assessment

High: lessons currently require repeated manual rediscovery, while missing
evidence and persistence faults remain hidden behind a successful tool run.
This feature changes scripts and review output; it does not modify the CLI
renderer, provider policy, lesson ledger, raw traces or trusted skills.

## Proposed Solution

1. Reuse parseLessons and structuredBlocks to inventory all headed entries,
   distinguishing schema-governed lessons from historical narrative. Retain
   original fields and references. No bulk source rewrite.
2. Add a strict, reviewed candidate store with stable IDs and draft/ready/
   routed/implemented states. Validate duplicate IDs, lesson links, evidence
   paths/snippets and source hash. Resolve FID ownership within the repository.
3. Add a read-only report/check command and explicit report-writing mode.
   Inventory uncovered lessons without inventing new defects. Seed actual
   pagination and propagation gaps; keep unproven remedies as drafts.
4. Extend the existing session-end review with bounded feature routing notes.
   Fail candidate admission closed and keep the existing review available.
   Never auto-write a FID, change readiness, run code or trust a skill.
5. Record the full acceptance review and a feature map. Verify state admission,
   evidence drift, traversal rejection, historical boundaries, owning FIDs,
   idempotence and real hook reachability with hermetic fixture tests.

### Verification

scripts/__tests__/lesson-feature-pipeline.test.ts covers candidate admission,
source drift and real session-end integration. Run root typecheck, eslint,
Markdown lint, formatting, quality and repository validation. Known aggregate
CI failure remains the existing Savant-Free disposition under T122.

## Verification Gates

- gate: probe scripts/scripts-typecheck-check.ts
- gate: probe scripts/lesson-feature-pipeline.ts
- gate: test scripts/__tests__/lesson-feature-pipeline.test.ts
- gate: test scripts/__tests__/session-end-review.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b2cdf4dd05421e8af116b4b52bc0a7a6308c7069a8fd42c2f800209ec98f951a
- verified: 2026-10-12T18:15:24.820Z
- probe scripts/scripts-typecheck-check.ts: exit 0
- probe scripts/lesson-feature-pipeline.ts: exit 0
- test scripts/__tests__/lesson-feature-pipeline.test.ts: exit 0
- test scripts/__tests__/session-end-review.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT / ADVERSARIAL

RED: reviewed all 74 entries and current source callers; existing runtime
guards must not be duplicated. The run's preflight recommendation is refuted
by read-url/fetch.ts:166-181. Offset support exists in the tool schema but the
SDK cap occurs earlier, so documenting offsets alone cannot repair it.

GREEN: a small reviewed store and deterministic report extend existing parsers
and hook output. The lesson-to-skill workflow retains its complete input.

AUDIT: session-end-review is a production SessionEnd hook caller. Candidate
admission must not invoke arbitrary commands, read outside the repo, accept
stale lesson hashes or treat missing evidence as proof of a gap.

ADVERSARIAL: ready is a reviewed proposal, not an implementation authorization;
old active statuses are dated claims. Missing/invalid state cannot create a
false completion. FID presence alone cannot establish implementation. Bound
routing output and isolate malformed stores from the existing review.

Converged; implementation proceeds under recorded autonomy level 3.

### Missed Questions

- Should the ledger be condensed? No: the latest operator instruction retains
  it and mines it for features. Fix the reading path rather than erase evidence.
- Is every lesson a new feature? No: inventory existing guards separately.
- Does this automatically release skills or deploy fixes? No: existing
  operator/protocol boundaries remain authoritative.

## Resolution

### Code Verification Evidence

The implementation inventories 74 headed lessons (55 schema-governed) and
six reviewed feature candidates, with two ready and four draft. LEARNINGS.md
remains byte-identical, SHA-256
baa91dbd17dafdd5ba2dd9e205c48f390bb067ae786e61609bd8e3619e82de41.
No retirement or skill mutation occurred.

Production caller: protocol.config.yaml:259-260 invokes session-end-review;
session-end-review.ts:246 calls featureRoutingNotes, which calls the read-only
reviewer. package.json registers lessons:features for report/check/write modes.
The real SessionEnd fixture proves this route presents ready candidates and
survives malformed records. Reuse parseLessons, structuredBlocks and
parseFidStatus; do not fork the existing lesson/status parsers.

Final focused verification: 22 pass, zero fail across two suites. Full root
typecheck and eslint pass. Quality passes. Real store admission passes with
74 lessons and six candidates. Ready evidence expires on source drift; routed
fixes can change the gap's source without invalidating separate implementation
proof. Closed FIDs must be archived, carry code evidence, and name a real commit.
An actual Windows junction proves evidence cannot escape the repository.

The existing aggregate CI blocker remains Savant-Free under T122. This record
does not claim that the six candidate product fixes have been implemented, or
that an agent observed the original terminal acceptance checks. The pipeline
implementation is verified; publication and FID closure are not claimed.

## Lessons Learned

The pipeline must preserve evidence and make adoption traceable; summarizing
history alone cannot close a product gap.
