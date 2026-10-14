# FID: Lesson-driven feature pipeline

**Filename:** `FID-2026-1012-004-lesson-driven-feature-pipeline.md`
**ID:** FID-2026-1012-004
**Severity:** high
**Status:** closed
**Created:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Preserve the lesson ledger and turn reviewed gaps into traceable feature
candidates, using the existing session-end/FID workflow. A lesson is not proof
that its original defect still exists. The operator explicitly replaced ledger
cleanup with this pipeline.

## Environment

- **Commit/State:** `2355b520ebe22a7c36b4e8f944fdbf43818cca3c`; G2 field
  reconciled 2026-10-14 against the feature-pipeline implementation in Git.

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

- fingerprint: sha256:73d496767b84b65e7aed8d03d0578af36f20eea7ae8b5c767325b4b9cfba07e1
- verified: 2026-10-12T20:46:27.393Z
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

The aggregate `bun run ci` red is now characterized rather than merely named:
the Savant-Free leg is refused by the FID-2026-0805-002 integrity gate because
this machine's repo `.env.local` carries dev `NEXT_PUBLIC_*` values
(`NEXT_PUBLIC_SAVANT_CODE_APP_URL=http://localhost:3000`) — the exact leak class
that gate exists to refuse — and the same leg builds green (exit 0, live) under
the documented clean-shell condition. T122 remains the operator-owned item
(repair the feature or remove it); nothing here resolves or claims it.

Two of the six candidates this pipeline surfaced are now implemented under
their own closed records: `LF-001` → FID-2026-1012-007 (commit `303c6838`),
`LF-002` → FID-2026-1012-008 (commit `7fbecd99`). `dev/feature-pipeline/candidates.json`
and the regenerated report record them as `implemented` with their owning FIDs,
and the checker passes over that state (`lesson-features: PASS (74 lessons, 6
candidates)`). The remaining four (`LF-003`…`LF-006`) stay `draft`: their basis
is investigation, and this pipeline's own contract makes readiness — not age —
the implementation authorization.

No agent observed the original terminal acceptance checks in this session, and
publication is not claimed.

### Closure

- **Closed Date:** 2026-10-12
- **Fix Description:** the pipeline is implemented and verified: 74 headed
  lessons inventoried (55 schema-governed), a reviewed six-candidate store with
  stable IDs, states, evidence snapshots and owning-FID validation, a read-only
  report/check command with an explicit write mode, and bounded routing notes on
  the production SessionEnd hook. `LF-001`/`LF-002` are implemented under
  FID-2026-1012-007 and FID-2026-1012-008.
- **Tests Added:** `scripts/__tests__/lesson-feature-pipeline.test.ts` and
  `scripts/__tests__/session-end-review.test.ts` (22 pass, 0 fail), covering
  candidate admission, source drift, traversal rejection, real hook reachability
  and malformed-store isolation. The two product fixes carry their own suites in
  records 007 and 008.
- **Verification Evidence:** five declared gates exit 0 live at the archived
  path (see the receipt below); full root typecheck, ESLint, Markdown lint,
  formatting, `quality:report` and `validate:repository` pass. Ready evidence
  expired on source drift exactly as designed when the `LF-001`/`LF-002` sources
  changed, and both were re-admitted as owned implementations instead.
- **Archived:** `dev/fids/archive/FID-2026-1012-004-lesson-driven-feature-pipeline.md`, with its
  CHANGELOG entry and an entry in `dev/fids/archive/README.md`.

## Lessons Learned

The pipeline must preserve evidence and make adoption traceable; summarizing
history alone cannot close a product gap.
