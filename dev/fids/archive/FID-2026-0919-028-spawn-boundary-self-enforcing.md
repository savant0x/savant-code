# FID: Spawn boundary made self-enforcing — an unclassified AgentState field is now a build failure

**Filename:** `FID-2026-0919-028-spawn-boundary-self-enforcing.md`
**ID:** FID-2026-0919-028
**Severity:** high
**Status:** closed
**Created:** 2026-09-20 00:25
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: the partition
reuses `AgentState` as the single source of truth, the enforcement is the repo's
existing `typecheck` gate, and `createAgentState` swapped a hand-copied field
list for a typed picker over that same list — no runtime indirection added)

---

## Summary

FID-2026-0919-027 fixed the fields the spawn boundary was dropping, and left the
*mechanism* that dropped them: `createAgentState` inherited a hand-written list of
parent fields, so **the next field added to `AgentState` is silently absent on
every child** and nothing fails until a child is observed behaving like a
different run. Finding the four governance fields took a whole audit
(FID-027) — the record itself asked for this follow-up.

This record turns that review into a build error. Every key of `AgentState` is now
classified exactly once as inherited, child-owned, or deliberately absent *with a
reason*; the inherited half of the child state is produced by a typed picker over
that same list (so the list IS the behavior, not parallel documentation); and
three compile-time gates assert the partition is exhaustive, disjoint, and that
every governance field the propagation contract demands is actually inherited.

Injecting one new field into `AgentState` fails `typecheck` — that negative leg
is recorded under Evidence.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** tsc (workspace `packages/agent-runtime`), eslint, prettier
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

`createAgentState` (FID-027 extraction, `spawn-child-state.ts`) built the child
state from an explicit literal:

```ts
contextTokenCount: parentAgentState.contextTokenCount,
fsmPhase: parentAgentState.fsmPhase,
protocolVariant: parentAgentState.protocolVariant,
…                      // whichever fields someone remembered
...inheritRunGovernance(parentAgentState),
```

Adding a field to `AgentState` produces no error, no warning, and no failing
test. The field is simply missing on every subagent. That is precisely how
`enforcementMode`, `designContract`, `protocolSource` and `provenanceMode` went
missing (FID-027), and how the *next* field will go missing.

### Expected Behavior

The boundary must force a decision. A new `AgentState` field either crosses the
boundary, or is deliberately constructed by the child, or is deliberately absent
with a stated reason — and an author who forgets to choose gets a build failure
naming the gate, with the offending key(s) available as an exported alias.

### Root Cause

Classification was implicit in code shape. There was no artifact that enumerated
`AgentState`'s fields and their intended boundary behaviour, so completeness was
only ever established by review — and review is what FID-027 had to spend an
audit on.

### Evidence

**Negative leg — the gate is not decorative.** Injecting
`probeUnclassifiedField?: string` into `AgentState` (`session-state-agent-state.ts`)
and running the workspace typecheck:

```text
src/tools/handlers/tool/spawn-child-fields.ts(195,3):
  error TS2344: Type 'string' does not satisfy the constraint 'never'.
```

Source restored immediately after (`grep -c probeUnclassifiedField` → 0). The
failure is the `AssertNever` gate refusing an `Exclude<keyof AgentState, …>` that
is no longer empty.

**Resolved types were measured, not assumed** (temp probes appended and removed):

```text
string extends keyof AgentState                → false   (no index signature)
UnclassifiedAgentStateFields (post-injection) → 'probeUnclassifiedField'
```

**Positive leg — the honest diagnostic.** TS renders the deferred `Exclude` as
`Type 'string' does not satisfy the constraint 'never'` rather than naming the
key, so the module documents the exported `UnclassifiedAgentStateFields` alias as
the readable entry point. Recorded because "the build broke and says string" is
otherwise a confusing first encounter.

**Partition counts:** 54 keys = 13 inherited + 14 child-owned + 27 by-design.

## Impact Assessment

### Affected Components

- **New authority:** `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`
  (`INHERITED_FROM_PARENT`, `CHILD_OWN`, `NOT_INHERITED_BY_DESIGN`,
  `GOVERNANCE_FIELDS`, `inheritFromParent`, `inheritRunGovernance`,
  `classifyAgentStateField`, the four compile-time gates).
- **Construction point:** `spawn-child-state.ts` — the inherited half now comes
  from `inheritFromParent()`; `inheritRunGovernance` / `RunGovernance` re-exported
  so FID-2026-0919-027's citations and the propagation snapshot keep one surface.
- **Probe:** `scripts/handoff-transport-check.ts` now iterates the authority's
  lists instead of carrying its own copies.
- **Pins:** new
  `packages/agent-runtime/src/__tests__/spawn-child-fields.test.ts` (7 pins, 114
  expectations).

### Risk Level

- [ ] Critical
- [x] High: the class of defect it prevents is silent cross-run governance drift
      (FID-027's critical finding) and the mechanism that produced it.
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Name every field, then let the compiler own completeness: a three-way partition
with a reason per deliberately-absent field, a typed picker so the inherited list
drives construction, and `AssertNever` gates for exhaustiveness, disjointness, and
the governance subset. No runtime indirection, no new dependency, no test that can
be forgotten — `typecheck` is already a hard gate.

### Steps

1. `spawn-child-fields.ts` — the three lists, each `as const satisfies` the
   relevant `AgentState` key shape; `classifyAgentStateField` for probes/tests.
2. Gates: `UnclassifiedAgentStateFields` (exhaustiveness), `GovernanceNotInherited`
   (the contract's precondition), and three pairwise disjointness assertions,
   each as `AssertNever<…>` written at its instantiation.
3. `spawn-child-state.ts` — return literal keeps only child-owned fields plus
   `...inheritFromParent(parentAgentState)`; re-export the governance surface.
4. `scripts/handoff-transport-check.ts` — source the lists from the authority;
   also fail if the authority answers `unclassified` for a probed field.
5. `spawn-child-fields.test.ts` — pin behavior against the lists (crossing,
   sharing by reference, no by-design leakage, disjointness, unknown-name
   handling, governance subset).
6. Document the measured diagnostic limitation in the module header.

### Accepted Risk

- The by-design reasons are prose. A *wrong* classification now requires a
  deliberate edit with a stated justification — the gate forces the decision but
  cannot judge it. This is the residual after FID-027 fixed the live fields.
- `NOT_INHERITED_BY_DESIGN` grows as a visible, reviewed list rather than
  silently: a field moved there without a reason fails review, and a field moved
  out is transported on the next construction automatically.

## Verification

- Compile-time gate proven by injection (negative leg above), source restored.
- 7 pins / 114 expectations: inherited fields cross, per-run instances shared by
  identity, no by-design field set on a fresh child, categories disjoint, unknown
  names → `unclassified`, governance ⊆ inherited.
- `handoff-transport-check` probe green reading the authority's own lists.
- Workspace typecheck exit 0; full chain and package suite recorded in the receipt.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/spawn-child-fields.test.ts
- gate: test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts
- gate: test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts
- gate: probe scripts/handoff-transport-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:d85e2256c90dadc9d18297aa305527e36363061de3841c5622e31603753e5e93
- verified: 2026-09-19T21:10:51.491Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/spawn-child-fields.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts: exit 0
- test packages/agent-runtime/src/evidence/__tests__/spawn-evidence.test.ts: exit 0
- probe scripts/handoff-transport-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Iteration 1 — RED

`createAgentState`'s inherited fields are an explicit literal with no completeness
check. Injecting a field into `AgentState` compiles clean — the boundary reports
nothing, which is the defect.

### Iteration 2 — GREEN

Partition + typed picker + gates implemented; 54 keys classified; probe re-pointed
at the authority; 7 pins added; workspace typecheck clean.

### Iteration 3 — AUDIT / self-correction

- **Caught by re-measuring instead of assuming:** the first gate attempt made
  `RunGovernance` optional-keyed (a `Pick` of optional source fields), which broke
  the snapshot type — the mapped-type `-?` form restores required keys with
  `undefined` values. The first disjointness helper (`AssertDisjoint<A, B>`) also
  failed at its generic declaration, so each gate is now written at its
  instantiation.
- **Caught by the negative leg:** injecting a field revealed the diagnostic is
  `Type 'string' does not satisfy the constraint 'never'` rather than the field
  name. Two probe experiments established the real resolved types
  (`string extends keyof AgentState` → false; the alias resolves to the literal
  key), and the module now documents the limitation instead of claiming a
  readable message it does not produce.
- **Scope discipline:** the probe previously carried its own copies of the two
  lists, which would have drifted from the authority within one edit. It now
  reads the authority and fails on an `unclassified` answer.

### Missed Questions

1. **Should the gate cover `SessionState` / `FileContext` too?** They have the
   same shape of risk (root-owned configuration read at the point of use), but no
   constructor currently copies them per spawn, so there is nothing to make
   exhaustive yet. Recorded as the natural extension if a boundary is introduced
   for either.
2. **Is `NOT_INHERITED_BY_DESIGN` ever wrong?** Two entries were re-examined
   during classification: `maxContextLength`/`digestCaps` (re-stamped per run by
   `createLoopContext` — verified in FID-027) and `goal`/`drive`/`driveStatus`
   (owned by the root drivers, whose loops children do not run). Both reasons are
   written into the list, so a future disagreement has a surface to argue with.
3. **Should the gate be a test instead of a type?** A test cannot fail when the
   type it would assert about is what changed — only the compiler sees
   `keyof AgentState`. The behavioral pins exist in addition, because a list can
   also drift from what the constructor does.

### Code Verification Evidence

- [x] **Files referenced in Affected Components exist.**
      `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`
      (new), `packages/agent-runtime/src/tools/handlers/tool/spawn-child-state.ts`,
      `scripts/handoff-transport-check.ts`,
      `packages/agent-runtime/src/__tests__/spawn-child-fields.test.ts` (new).
- [x] **Implementation matches the Proposed Solution.** `grep -n
      "INHERITED_FROM_PARENT\|CHILD_OWN\|NOT_INHERITED_BY_DESIGN\|AssertNever"
      spawn-child-fields.ts` → the three lists, the picker, and the four gates;
      `grep -n "inheritFromParent" spawn-child-state.ts` → the import and the
      spread at the construction point; `grep -n "INHERITED_FROM_PARENT"
      scripts/handoff-transport-check.ts` → the probe iterates the authority.
- [x] **Typecheck/tests/lint pass with pasted tool output.** Receipt below:
      `typecheck packages/agent-runtime` exit 0, the three declared test paths exit
      0, the probe exits 0, `quality: PASS`. Chain level: `typecheck` 12/12 exit 0,
      `bun run test` exit 0 with **7552 pass / 0 fail**, eslint 0 warnings,
      `lint:md` exit 0, `prettier --check .` PASS.
- [x] **Production call-graph evidence is present for new or repaired wiring.**
      `createAgentState` → `spawn-child-state.ts` spreads `inheritFromParent()`
      (from `spawn-child-fields.ts`), which is the same function the probe path
      executes under `bun run scripts/handoff-transport-check.ts` (exit 0); the
      compile gate is exercised by the recorded injection negative leg
      (`error TS2344` at the gate, source restored).
- [x] **FID status reflects the actual implementation state.** `verified`: the
      partition, the picker, the four gates, the re-pointed probe and the 7 pins
      are all in the tree; receipt 6/6 LIVE below.

## Resolution

- **Closed Date:** 2026-09-19 21:09 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** `spawn-child-fields.ts` classifies all 54 `AgentState`
  fields once (13 inherited / 14 child-owned / 27 by-design-with-reason);
  `createAgentState` inherits via `inheritFromParent()` so the list drives
  construction; four `AssertNever` gates make an unclassified field, a category
  overlap, or a missing governance field fail `typecheck`; the handoff probe
  reads the authority's lists; 7 new pins keep the lists matching behavior. The
  gate was proven by injecting a field into `AgentState` (build red at the
  gate), and the measured diagnostic limitation — TS renders the deferred
  `Exclude` rather than the key — is documented in the module rather than
  papered over.
- **Tests Added:** Yes —
  `packages/agent-runtime/src/__tests__/spawn-child-fields.test.ts` (7 pins, 114
  expectations).
- **Verification Evidence:** receipt below (six gates, live) plus the injection
  negative leg and the resolved-type measurements under Evidence. Chain:
  `typecheck` 12/12 exit 0; `bun run test` exit 0 / 0 fail (7552 pass at the
  time of this record's own work); eslint 0; `lint:md` exit 0;
  `prettier --check .` PASS; `quality: PASS (1498 baselined files)`;
  `handoff-transport-check` probe exit 0 (13 inherited crossed, 27 by-design did
  not leak, 0 unclassified answers).
- **Archived:** 2026-09-19 21:09 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (6/6 gates)

## Lessons Learned

A completeness requirement that lives only in a reviewer's head is a defect
generator: the fix for FID-027 was to transport four fields, but the durable fix
was making the *set* of fields a compile-time object. When a boundary copies state
between two instances of the same type, enumerate the type — the compiler is the
only reviewer that never skips a field.
