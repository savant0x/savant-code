# FID: The FID status parser is blind to bullet-form `**Status:**` lines

**Filename:** `FID-2026-0928-002-fid-status-line-parse-blind-spot.md`
**ID:** FID-2026-0928-002
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28 16:40
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The FID status is read by a line-anchored regex that cannot see
`- **Status:** …`, the bullet form used by the older record template. Twelve
archived FIDs therefore parse as `undefined`. One of them,
**FID-2026-0917-004**, genuinely declares `Status: verified` — so the
verification contract that is supposed to bind it is **never enforced on it**,
and `fid:verify --check` does not name it. The status is a claim; the parser
that acts on it is a gate, and a gate that cannot read its input cannot enforce
anything.

## Environment

- **OS:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Commit/State:** `06967570`, v0.0.34, 423 FIDs in `dev/fids/archive/`
- **Governance:** ECHO Protocol v0.1.2-single-agent, `strict_mode: true`,
  session autonomy level 3

## Detailed Description

### Problem

`parseFidStatus` returns `undefined` for 12 of 423 archived FIDs, and the
`describeVerificationEnforcement` reason for each is **wrong**: it reports
"no **Status:** line" when the line is present in the document.

### Root cause

`STATUS_LINE` is anchored to the start of a line:

```ts
const STATUS_LINE = /^\*\*Status:\*\*\s*(.+)$/m
```

The current template writes `**Status:**` at line start. Records authored
against the earlier template write it as a metadata bullet
(`- **Status:** closed`), which the anchor rejects. Nothing distinguishes
"absent" from "present but unreadable", so the record falls into the same
branch as a document that genuinely declares no status.

### Evidence

```text
archived FIDs                     : 423
parseFidStatus -> undefined       : 12
  ...of those, declared `closed`  : 11   (outside the contract by design — cosmetic)
  ...declared `verified`          : 1    ← FID-2026-0917-004 (the contract SHOULD bind it)

$ bun run fid:verify --check | grep -c 0917-004
0        # never named, despite Status: verified + a stamped receipt
```

The gap between the two readings, measured live:

```text
before: {"enforced":false,"reason":"no **Status:** line — … (FID-2026-0919-021)"}
after : {"enforced":true, "reason":"status \"verified\" — declared gates + a fresh receipt are enforced …"}
```

Three independent copies of the anchor exist, so this is a Law 13 violation as
well as a correctness one:

| Consumer | Line | Effect |
|---|---|---|
| `fid-verification-enforcement.ts` | `:30` `STATUS_LINE` | contract never applied to a `verified` record |
| `fid-validator.ts` | `:67` `converged\|closed` | `declaredClosed` false for a closed bullet-form record |
| `fid-validator.ts` | `:249` COMPLETE branch | `COMPLETE requires Status: closed (found missing)` |

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/fid-verification-enforcement.ts`
- `packages/agent-runtime/src/echo/fid-validator.ts`
- `packages/agent-runtime/src/echo/__tests__/`

### Risk Level

- [x] Medium — **not High, and the first draft of this FID said High. That was
      wrong and is corrected here.** A safety gate is inert for a class of
      records, which is the same *class* as FID-2026-0927-003. But the measured
      blast radius is currently **zero**: all 12 bullet-form records are in the
      archive, and `fid:verify --check` does not scan the archive
      (`scripts/fid-check.ts:20-27`). The defect is **latent, not live** — it
      would bite the first bullet-form `verified` record left *active*, or any
      authoring-time use of `fid-validator`'s COMPLETE branch. Medium is the
      honest rating; High would have overstated a risk that no current code
      path reaches.

## Proposed Solution

### Approach

Make the status read tolerant of an optional list marker, and route all three
consumers through the single `parseFidStatus` so there is one truth.

```ts
const STATUS_LINE = /^[ \t]*(?:[-*][ \t]+)?\*\*Status:\*\*[ \t]*(.+)$/m
```

Fixing the **parser** rather than rewriting 12 historical records is deliberate:
it repairs every present and future record at once, edits no history, and keeps
one definition of "how a FID declares its status".

Rejected alternative — normalising the 12 files to line-anchored form. It would
fix these 12 and leave the next batch of older records to be re-found, and it
rewrites archived history to suit a parser.

### Steps

1. `STATUS_LINE` accepts an optional `-`/`*` list marker.
2. `fid-validator.ts:67` and `:249` call `parseFidStatus` instead of
   re-implementing the anchor.
3. Regression legs: a bullet-form `verified` record is enforced; a genuinely
   status-less document is still unenforced; line-anchored form is unchanged;
   the duplicate-anchor copies are gone (asserted by import, not by grep).

### Verification — corrected after measurement

The original criterion in this section was **wrong** and was replaced rather
than quietly dropped. It read: "`bun run fid:verify --check` must name
FID-2026-0917-004 after the fix (today: 0 mentions)."

It cannot. `activeFidFiles()` (`scripts/fid-check.ts:20-27`) reads only
`dev/fids/` top level and filters to regular files, so `archive/` is **never
scanned**. All 12 bullet-form records live in the archive, so the `--check` scan
would not name 0917-004 before the fix *or* after it. Measured after
implementing: still 0 mentions.

The criterion that is actually satisfiable, and is the one enforced:

1. `parseFidStatus` reads the bullet form, and the unit legs prove it.
2. **The forward-looking risk is demonstrated, not asserted**: a bullet-form
   `verified` record is now reported `enforced: true`, where before it was
   `enforced: false`. That is the defect that would have bitten the moment such
   a record was left active.

**Why no `typecheck` gate:** `packages/agent-runtime` *is* a valid workspace,
so `- gate: typecheck packages/agent-runtime` is legal here and is declared.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/fid-status-line-parse.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:a22d0fcd064522fbd7bc4ddfc2e88d1d3ef030933f51d5bdc5ece1fd3db23497
- verified: 2026-09-28T13:57:18.827Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/fid-status-line-parse.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** 3 of 4 new legs fail: bullet-form `verified` is not enforced;
  bullet-form `closed` does not satisfy the COMPLETE branch; the reason string
  says "no Status line" for a document that has one.
- **GREEN:** `STATUS_LINE` made marker-tolerant; both `fid-validator` copies
  routed through `parseFidStatus`.
- **AUDIT:** 4/4 legs; the pre-existing `fid-verification-*` and
  `fid-validator` suites must stay green.
- **ADVERSARIAL:** the regex now also matches a `**Status:**` inside a fenced
  code block. That exposure is **pre-existing and identical** — the old regex
  matched an unanchored-status fence too, and this FID does not widen it. A
  stricter follow-up (fence-aware match) is deliberately **not** smuggled in
  here: it is a separate change with its own blast radius.
- **CHANGE DELTA:** ~15 lines across 2 files.

### Missed Questions

1. *Should the reason string distinguish "absent" from "unreadable"?* → Yes —
   but with a marker-tolerant parser the two cases collapse only for
   *well-formed* bullets. A genuinely absent status still reports absent, which
   is the message the operator needs. Verified by a dedicated leg.
2. *Does making the contract bind 0917-004 put it into immediate red?* → **No,
   and asking the question is what exposed my own bad claim.** The `--check`
   scan never reaches the archive, so there was never a red to observe. The
   verification criterion I had written was unmeetable; it is replaced in
   *Proposed Solution → Verification* with the satisfiable one.
3. *Is the archive's own hygiene affected?* → Yes but out of scope here: 35
   archived FIDs carry a non-`closed` status. Closing 35 records without
   per-record implementation evidence would be the Ground-Truth violation this
   protocol exists to prevent, so it is registered as an open item instead.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Call-graph evidence — `parseFidStatus` now has three call sites
      (`fid-verification-enforcement.ts` internal, `fid-validator.ts:67`,
      `fid-validator.ts:249`) and the two duplicate anchors are deleted.
      Reachability is shown by the 11 unit legs, which fail before the change
      and pass after — compilation alone would not show a regex widening
- [x] FID status reflects the actual implementation state

### Loop 2 — implementation

**RED.** 5 of 11 legs fail: the hyphen-bullet form, the star-bullet form, a
bullet form among surrounding metadata, the `enforced: true` expectation for a
bullet-form `verified` record, and the `closed` bullet reaching the
`describeVerificationEnforcement` branch.

**GREEN.** `STATUS_LINE` accepts an optional list marker. The two copies of the
anchor in `fid-validator.ts` are deleted and replaced by `parseFidStatus`
calls, so the status has one definition across all three consumers.

**AUDIT.** 11/11 new legs. The full `packages/agent-runtime/src/echo/__tests__/`
suite is 241 pass / 1 fail, and the single failure is not a regression — it is
`scope-register-completeness` correctly reporting that this FID had no
`SCOPE.md` line yet, which was then added (T96).

**ADVERSARIAL.** Two attempts to break it:

- A near-miss on the field name: `- **Status of change:** not-a-status` must not
  parse. Pinned by its own leg — the regex requires the literal `**Status:**`.
- The widened anchor could now match a `**Status:**` inside a fenced block. That
  exposure is **pre-existing**, not introduced: the old regex was equally blind
  to fences. Fence-aware matching is a separate change with its own blast
  radius and is deliberately not smuggled in here.

**CHANGE DELTA.** ~15 lines across 2 source files.

**Two claims in the first draft of this FID were wrong and are corrected in
place rather than dropped:** the severity (High → Medium) and the verification
criterion (`fid:verify --check` naming 0917-004 — unmeetable, because that scan
never reads the archive). Both corrections are recorded where the claim was
made.

## Resolution

- **Closed Date:** 2026-09-28 17:05
- **Fix Description:** `STATUS_LINE`
  (`packages/agent-runtime/src/echo/fid-verification-enforcement.ts:30`) now
  accepts an optional `-`/`*` list marker before `**Status:**`. The two
  independent copies of the anchor in `fid-validator.ts:67,249` are removed and
  replaced with `parseFidStatus` calls. The 12 bullet-form records are **not**
  rewritten — the read is repaired, so history is untouched and future records
  are handled by the same code.
- **Tests Added:** Yes —
  `packages/agent-runtime/src/echo/__tests__/fid-status-line-parse.test.ts`,
  11 legs (5 red before the change).
- **Verification Evidence:** receipt stamped below; `typecheck
  packages/agent-runtime`, the new suite, and repo-wide `quality:report` all
  exit 0. `packages/agent-runtime/src/echo/__tests__/` = 241 pass / 1 fail, the
  one failure being `scope-register-completeness` reporting this FID's own
  missing `SCOPE.md` line, which was then written.
- **Archived:** 2026-09-28 17:05
