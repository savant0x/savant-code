# FID: Durable session save and resume with nested runtime state

**Filename:** `FID-2026-1015-004-durable-session-save-resume-state.md`
**ID:** FID-2026-1015-004
**Severity:** high
**Status:** closed
**Created:** 2026-10-15 17:30
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

LF-003 is the highest-priority unimplemented feature candidate produced by the
lesson pipeline. The live tree has two durable JSON paths: the SDK run-state
serializer and the database session serializer. Both omit known runtime-only
keys, but they do not share one cycle-safe implementation, and the database
path has no regression proving that a nested runtime cycle leaves the durable
conversation and retryable user content intact. This FID unifies the safe JSON
mechanism, preserves each caller's omission policy, and proves nested save,
load, and resume behavior without introducing a second persistence store.

## Environment

- **OS:** Windows host; portable TypeScript/Bun implementation
- **Language/Runtime:** TypeScript; Bun 1.3.14
- **Tool Versions:** TypeScript workspace gates; Bun test
- **Commit/State:** `628375ff` — the local implementation commit, on top of the
  approved clean-Linux work; the unrelated operator work remains separate

## Detailed Description

### Problem

`packages/database/src/sessions.ts:24-43` serializes session state with a
local replacer that removes four known runtime-only keys and functions, but a
cycle under any other key still makes `JSON.stringify` throw. The SDK has a
separate omit implementation at `sdk/src/run-state/serialization.ts:10-25`.
`cli/src/utils/db-storage.ts:59-97` performs session persistence before the
conversation-message write, so a session serialization failure can return from
the database fallback before the durable user message is written.

The existing database regression at
`packages/database/src/__tests__/service.test.ts:177-198` covers the known
`activity`, timer, and provenance fields only. It does not cover a nested child
state, an unexpected cycle marker, or a save-path retry that proves the
conversation remains recoverable.

### Expected Behavior

- Durable serializers use one shared cycle-safe implementation.
- Runtime-only keys and functions remain omitted according to each caller's
  policy.
- A cycle outside the known runtime-only keys becomes a bounded, non-sensitive
  marker instead of aborting serialization.
- Nested child-agent conversation state survives database save/load with its
  durable fields intact.
- The real CLI save path returns a session identity and persists user messages
  when the only problematic value is a cyclic runtime field.
- SDK transport serialization and deserialization retain their existing schema
  validation and fail-closed behavior for malformed payloads.

### Root Cause

Cycle handling is duplicated at two persistence boundaries and is limited to
omitting known keys. The database boundary has no shared durable-serialization
contract with the SDK, so regression coverage proves individual historical
fixes rather than the universal nested-state behavior required by resume.

### Evidence

```text
Recurring-feature audit:
- experiences:dedup: 595 records, 59 unique patterns, 27 recurring patterns
  at the repository threshold.
- The largest current classes are already owned by FID-2026-1012-017 through
  FID-2026-1012-023; no new failure-class FID is justified.
- lessons:features --check: PASS (74 lessons, 9 candidates).

Live persistence evidence:
- packages/database/src/sessions.ts:38-43 calls JSON.stringify with only a
  four-key omission replacer.
- sdk/src/run-state/serialization.ts:20-25 has a separate omission replacer.
- cli/src/utils/db-storage.ts:59-97 updates/creates the session before saving
  conversation messages; its catch at lines 163-171 returns the fallback state.
- packages/database/src/__tests__/service.test.ts:179-198 proves only the
  named historical ephemeral keys are omitted.
```

## Impact Assessment

### Affected Components

- `common/src/util/safe-json.ts` — shared bounded cycle-safe serializer
- `common/src/util/__tests__/safe-json.test.ts` — serializer contract tests
- `sdk/src/run-state/serialization.ts` — durable RunState transport path
- `sdk/src/__tests__/run-state-serialization.test.ts` — SDK round-trip proof
- `packages/database/src/sessions.ts` — durable session path
- `packages/database/src/__tests__/nested-session-state.test.ts` — nested state
  proof
- `cli/src/utils/__tests__/session-entry-persistence.test.ts` — real save-path
  message-preservation proof

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Add a small common utility that implements ancestor-aware cycle detection,
function omission, and a constant non-sensitive circular-reference marker. Keep
the omission-key sets at their existing callers because the SDK transport and
database session contracts intentionally differ. Replace both local replacer
implementations with the shared utility, preserve SDK validation, and add
focused tests through the production database and CLI save paths.

### Steps

1. **implemented:** Complete the RED census and live call-graph review; select
   LF-003 as the first P1 draft candidate and record this FID.
2. **implemented:** Converge the shared serializer design, omission-policy
   boundary, marker behavior, and declared gates through the FID audit.
3. **implemented:** Add the shared serializer and wire both production
   persistence paths while preserving the caller-specific omission sets.
4. **implemented:** Add and run the declared regression suites, including
   nested cycle, repeated-reference, SDK round-trip, database, and CLI save
   path coverage.
5. **implemented:** Run static gates, manual re-read, and production
   call-graph verification.

### Verification

The implementation must run these declared gates and paste their exits into
this record:

- The common serializer suite proves nested cycles, repeated non-cyclic object
  references, functions, omission keys, and the bounded marker.
- The SDK serializer suite proves durable transport round-trip and existing
  malformed/future-version rejection behavior.
- The database nested-session suite proves nested child state, cycle-marker storage,
  and durable state after reopen-compatible reads.
- The CLI session persistence suite proves the real save path persists a user
  message while retaining a session identity when a cyclic runtime field is
  present.
- Typechecks for common, SDK, database, and CLI pass.
- `quality` passes.
- A production call-graph grep finds both SDK and database callers of the
  shared serializer; tests alone do not satisfy Law 4.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/database
- gate: typecheck cli
- gate: test common/src/util/__tests__/safe-json.test.ts
- gate: test sdk/src/__tests__/run-state-serialization.test.ts
- gate: test packages/database/src/__tests__/nested-session-state.test.ts
- gate: test cli/src/utils/__tests__/session-entry-persistence.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:f079e46cd50901f69c19b7d02db763204e6f82f8ee0f71cfd4107ecaa2457389
- verified: 2026-10-15T22:05:14.253Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/database: exit 0
- typecheck cli: exit 0
- test common/src/util/__tests__/safe-json.test.ts: exit 0
- test sdk/src/__tests__/run-state-serialization.test.ts: exit 0
- test packages/database/src/__tests__/nested-session-state.test.ts: exit 0
- test cli/src/utils/__tests__/session-entry-persistence.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The recurrence audit found no new unowned high-volume failure class;
  the actionable feature gap is LF-003. The database and SDK serializers are
  separate, and database save ordering allows a session serialization failure
  to prevent the following conversation write.
- **GREEN:** Use one common ancestor-aware serializer, retain caller-specific
  omission sets, preserve durable nested values, and mark only circular
  back-references with a bounded constant.
- **AUDIT:** The FID names every promised test artifact and declares each as a
  `gate: test`; the affected source files and current callers were read in
  full before implementation planning.
- **ADVERSARIAL:** A global `WeakSet` would incorrectly erase repeated but
  acyclic references, so the design uses the active ancestor chain instead.
  The marker must not contain object values or paths that could expose user
  content. No second evidence or persistence store is introduced.
- **CHANGE DELTA:** Initial converged record.

### Loop 2 — Independent audit and self-correction

- **RED:** The first implementation pass exceeded the database service test's
  300-line quality ceiling when the nested-state assertion was added there.
- **GREEN:** Moved the LF-003 database assertion into the focused
  `nested-session-state.test.ts` suite; the existing service suite remains
  unchanged except for its import surface.
- **SELF-CORRECT:** The first focused database test reused the shared in-memory
  connection and made the sibling lazy-open assertion order-dependent. Its
  fixture now owns a temporary database file and explicitly reopens it.
- **AUDIT:** Typechecks for common, SDK, database, and CLI each exited 0.
  Targeted suites exited 0: common 3/0, SDK 9/0, database 1/0, and CLI 4/0.
  `quality:report` exited 0 over 1,502 files; targeted Prettier and ESLint
  exited 0; `git diff --check` produced no output.
- **ADVERSARIAL:** The production caller census found seven total
  `safeJsonStringify` matches: the common implementation, three tests, one
  database production caller, and two SDK production callers. No production
  caller is absent, and the database/SDK policies remain separate at their
  call sites.
- **CHANGE DELTA:** Corrected the test placement without changing behavior.

### Loop 3 — Final convergence

- **RED:** No actionable implementation defect remains in the declared LF-003
  surfaces. The initial repository validation run also reported eleven ENOENT
  findings from Savant-Free test paths deleted by the concurrent
  FID-2026-1015-002 removal work; commit `dea54d85` staged those approved
  deletions, leaving only the already-recorded locked clean-Linux scratch
  artifact. Neither finding is caused by this FID's declared gates.
- **GREEN:** No further code changes were required after the focused audit.
- **AUDIT:** The changed production files and tests were re-read 0-to-EOF.
  The shared serializer uses ancestor-chain detection, so repeated acyclic
  references are retained while back-references receive only the fixed marker.
- **ADVERSARIAL:** The serializer does not claim to recover arbitrary database
  I/O failures; it removes the observed cyclic-serialization failure mode and
  proves durable message preservation through the real CLI save path. The
  separate database error fallback remains unchanged and is not over-claimed.
- **CHANGE DELTA:** 0% after Loop 2.

### Missed Questions

1. **Does this replace the existing SDK transport validator?** No. It only
   replaces the JSON encoding mechanism; schema validation and future-version
   rejection remain unchanged.
2. **Should the database and SDK share one omission list?** No. The SDK has
   transport-only `_echoEnforcement`, while the database's session contract
   owns a narrower runtime list. The serializer is shared; policy remains at
   the call site.
3. **Can a repeated acyclic object be mistaken for a cycle?** No. Detection
   follows the active recursion ancestry rather than all previously visited
   objects.
4. **Can the marker expose sensitive state?** No. It is a fixed constant with
   no path, key, value, or object serialization.
5. **Does this claim a live provider or UI acceptance run?** No. It claims
   deterministic persistence and resume regression coverage only.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `628375ff` —
  `feat(persistence): harden nested session save and resume
  (FID-2026-1015-004)`.
- [x] **File:line ranges:** `common/src/util/safe-json.ts:1-34`,
  `sdk/src/run-state/serialization.ts:177-187,232-244`,
  `packages/database/src/sessions.ts:40-47`, and
  `packages/database/src/__tests__/nested-session-state.test.ts:1-72`,
  `cli/src/utils/__tests__/session-entry-persistence.test.ts:198-226`.
- [x] **Gate output:** All declared typecheck, test, and quality gates passed;
  the exits are recorded in the Loop 2 audit above.
- [x] **Reproducibility:** The production caller grep found the shared utility
  in both SDK serialization call sites and the database session serializer.
- [x] **Step statuses:** Steps 1–5 are `implemented`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist after implementation
- [x] Implementation matches the converged serializer and caller-policy plan
- [x] Typecheck/tests/quality pass with pasted tool output
- [x] Production call-graph evidence is present for both new callers
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-10-15
- **Fix Description:** Added shared ancestor-aware cycle-safe JSON encoding and
  wired it into SDK RunState transport and database session persistence while
  preserving caller-specific omission policies.
- **Tests Added:** Yes — common serializer, SDK nested transport, database
  nested-session, and CLI save-path recovery coverage.
- **Verification Evidence:** Four workspace typechecks, four targeted test
  suites, quality, ESLint, Prettier, and `git diff --check` passed.
- **Archived:** 2026-10-15

## Lessons Learned

Durable-state fixes must prove the boundary between runtime-only state and
user-owned conversation state. A historical cycle omission test is not enough:
nested child state, repeated references, save ordering, and retry/recovery
behavior need explicit production-path coverage.
