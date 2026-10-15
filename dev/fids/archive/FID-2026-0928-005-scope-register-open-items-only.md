# FID: The register should hold open items only — and the gate that forbids it

**Filename:** `FID-2026-0928-005-scope-register-open-items-only.md`
**ID:** FID-2026-0928-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28 18:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator ruling 2026-09-28: *"if the item is completed, it should not even be in
scope, only active/pending items should be in scope."*

`SCOPE.md` could not comply. The completed index carried 34 task sections
because `collectRegisterCompletenessIssues` **required** them, and the check
produced **111 issues** when the index was removed. Both numbers were measured,
not assumed.

The register now holds 246 lines and 16 open items, with zero `## Task NN`
sections. Completed work is recorded in `CHANGELOG.md`, which has its own
ratcheted coverage gate.

## Environment

- Repo: `savant-code`, branch `main`, 462 commits at session start.
- Gate under change: `packages/agent-runtime/src/echo/scope-register-completeness.ts`
  (218 lines), consumed by `scripts/validate-repository.ts` and
  `scripts/scope-register-check.ts`.
- Active queue at the time: `FID-2026-0927-003`, `FID-2026-0927-006`.

## Detailed Description

Leg 2 of the register-completeness check demanded a `## Task NN` heading or a
`TNN-X` item for every task cited by an active FID **or by any session summary
dated on or after 2026-09-19** (`scope-register-completeness.ts:207-215`).

The measurement is the finding. Stripping the completed index and running the
live collector:

- **111 issues.**
- **Every one** came from a historical session summary.
- **Zero** came from either active FID.

So the leg was not protecting live work. It was requiring *finished* work to
stay in scope permanently.

The mechanism is a drift between the module's stated contract and its
implementation. The doc says *"a task cited by an active FID **or a current
session summary**"* (`:19-20`). The code read "current" as *every summary written
since `SCOPE_GUARD_EFFECTIVE_DATE`* — a monotonically growing, immutable window.
Each completed session therefore added its task references to the set the
register had to carry, forever.

## Impact Assessment

- **Before:** 582 lines, 34 completed sections, 336 lines of history, and a
  reader asking "what is open?" got 8 of 15 answers.
- **After:** 246 lines, 16 open items, no completed sections.
- **Gate coverage reduced** in one specific way, named in *Proposed Solution*.
- `validate:repository`, `lint:md`, `scope-register-check`, `quality:report`,
  `eslint` and `typecheck` all pass before and after.

## Proposed Solution

1. **Leg 2 scans the active queue only.** The session-summary scan is removed.
   A summary is written when a session *ends*, so what it cites is finished by
   construction.
2. **`dev/agenda.md` is added to the scanned surfaces** — the current
   pending-work list, so it belongs to the live set. It carries zero task
   references today, so this is net-new coverage.
3. **`SCOPE.md` drops the completed index** entirely.
4. **The narrowing is stated in the module doc**, which already has a
   "Boundaries, stated because they are real" section for exactly this.

**Why this is not a bare deletion of a control.** The quiet path
FID-2026-0919-024/025 closed is real: an item with no register line needs no
forbidden token to be dropped. What is retained and what is given up:

- **Still watched:** every active FID's id (leg 1); every task an active FID or
  the agenda cites (leg 2).
- **No longer watched:** a task cited *only* by a past session summary.
- **Residual risk, stated:** work completed in a session that filed neither a
  FID nor a CHANGELOG entry leaves no gate-visible trace. A genuine reduction in
  coverage. The compensating control is `changelog-coverage`, ratcheted against
  a baseline, currently 0 uncovered of 423 archived FIDs.

## Perfection Loop

### Missed Questions

**Does the narrowing let live work go unregistered?** No, and it is pinned rather
than asserted. `scope-register-open-items-only.test.ts` has a leg — *a task an
active FID cites is still a gap* — that **passes both before and after** the
change. That is deliberate: a suite asserting only the new behaviour would pass
just as happily against a gutted check. A live adversarial probe confirmed it
end-to-end: an active FID citing `Task 74` and `T83-A` with neither registered
yields both as issues, plus the FID id from leg 1.

**Can the gate tell a finished task from an abandoned one?** No. Both look like
"cited by a past summary, not registered", and both are now accepted. This is
recorded in the module doc and in `SCOPE.md`'s own header rather than absorbed.

**Does removing 34 task headings break the `TNN-X` resolution the header calls
load-bearing?** The header claimed *"removing one would red `validate:repository`
for any session summary that still cites it."* That was true, and it was the
reason the sections could not previously be removed — it is the exact mechanism
this FID changes. The claim is now false by design, and the header was rewritten
to say so rather than left standing.

**Is `dev/agenda.md` really live?** It is operator-generated and nothing forces
it to exist. Adding it is coverage that can be absent; it is not a control that
can be silently removed.

### Code Verification Evidence

RED-first, in a dedicated file so the 300-line `quality:report` ceiling is not
breached (the precedent set by FID-2026-0927-003's own split).

```text
scope-register-open-items-only.test.ts   8 legs
  before the change:  4 pass / 4 fail
  after  the change:  8 pass / 0 fail
scope-register-completeness.test.ts     15 legs
  after the change:  15 pass / 0 fail   (one leg inverted, see below)
```

The 4 legs that failed first are the ones describing the new contract. The 4
that passed first are the retained active-FID controls — the point of writing
them.

**One pre-existing leg had to change meaning, and was inverted rather than
deleted.** The leg `narrative window > current session summaries are scanned`
asserted the behaviour this FID removes. It now asserts the opposite — that a
task cited only by a session summary is *not* a gap — so the narrowing stays
visible in the suite rather than vanishing. See
`packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts`.

**The gate caught this FID's own first draft.** It was written with the inverted
leg reproduced verbatim in a fenced block, and `validate:repository` red it:
`cites "Task 98", which has no line in SCOPE.md`. That is the retained
active-FID leg working exactly as intended — `withoutInlineCode`
(`scope-disposition-guard.ts:91-93`) strips only single-line inline spans, so a
reference inside a fence is textually a live claim, not a quotation. The
example is now described rather than reproduced.

**Two test defects found while writing this, both mine:**

1. A `not.toContain('## Task ')` against the live register dumped all 582 lines
   into the failure output. Replaced with a boolean assertion so a failure prints
   one line.
2. The boolean then failed — the register's **own header** names the `## Task NN`
   form in prose, so a substring match trips on documentation rather than a
   section. Anchored to `/^## Task /m`. The test caught its own predicate.

**Dead code removed with the narrowing:** the `summaryDate()` helper and the
`SCOPE_GUARD_EFFECTIVE_DATE` import, both left unreferenced.

```text
typecheck agent-runtime  PASS
validate:repository      PASS
lint:md                  PASS
quality:report           PASS
scope-register-check     PASS
eslint --max-warnings 0  PASS
changelog-coverage       31 pass / 0 fail
```

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/scope-register-open-items-only.test.ts
- gate: quality

## Resolution

**Closed and implemented.**

- `packages/agent-runtime/src/echo/scope-register-completeness.ts` — leg 2
  narrowed to the active queue; `dev/agenda.md` added; session-summary scan and
  its now-dead helper removed; module doc updated in both the contract
  statement and the boundaries section.
- `packages/agent-runtime/src/echo/__tests__/scope-register-open-items-only.test.ts`
  — new, 8 legs.
- `packages/agent-runtime/src/echo/__tests__/scope-register-completeness.test.ts`
  — one leg inverted, `describe` block re-documented.
- `SCOPE.md` — completed index deleted; header rewritten to state the ruling,
  the measurement, the retained coverage and the stated limit. **582 → 246
  lines, 34 task sections → 0, 16 open items retained.**

The operator's stated condition — completed work is in the CHANGELOG — was
verified before the cut rather than assumed: the ratcheted `changelog-coverage`
gate passes 31/31, the 28 of 35 index entries citing a full FID id all map to
covered FIDs, and the remaining entries' CHANGELOG headings were confirmed
present by search.

## Lessons Learned

**A gate that reads "current" as "everything since a date" will grow without
bound, and the growth is invisible in the code.** The intent was right and the
implementation drifted; the symptom appeared as a documentation-shaped complaint
("this file is flooded with history") rather than as a gate failure, because the
gate was correctly enforcing what it had been told.

**Measure which surface a gate is actually reading before changing the gate.**
The 111-vs-0 split — every issue from a summary, none from an active FID — is
what justified the change. Had the issues come from the live queue, the right
move would have been the opposite one.

**A test asserting only the new behaviour proves nothing.** Two of the eight
legs pass before *and* after on purpose. A suite written purely for the
post-change world would have been satisfied by deleting the check outright.
