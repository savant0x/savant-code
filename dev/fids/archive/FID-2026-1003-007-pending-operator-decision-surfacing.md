# FID: Pending operator decisions are never presented — register blockers rot in place

**Filename:** `FID-2026-1003-007-pending-operator-decision-surfacing.md`
**ID:** FID-2026-1003-007
**Severity:** high
**Status:** closed (implemented + verified, 2026-10-03, commit a550b809)
**Created:** 2026-10-03
**Automation level:** 3
**YAGNI-Compliance:** Verified — one parser over the register's own
convention, one agenda section, one routing-note line. No new state, no
boot-time cost beyond one file read.

---

## Summary

The active-task register (SCOPE.md) records items blocked on an operator
ruling with a `**Blocker:**` sentence — but nothing ever PRESENTED those
decisions to the operator. The 2026-10-03 session proved the failure at
scale: twelve items sat blocked (some since 2026-09-28) and the operator,
finding the backlog by hand, ruled on all of it in one sitting. Their words:
"these are stating they need an answer from me or something along those lines
but i've never been presented the information, so had i not looked it would've
been left pending forever which is a larger issue." A blocked item with no
presentation path is a silent deferral — the exact class the protocol bans.

## Detailed Description

### Problem

1. Register items carry `**Blocker:** <needs operator X>` sentences, but the
   only surface that mentions them is SCOPE.md itself — a file the operator
   reads when they go looking.
2. The session-end review (FID-2026-0824-012 S3-A) surfaces tool-failure
   recurrences into `dev/agenda.md` and FID-routing candidates — but has no
   leg for pending operator decisions.
3. Session boot reads `dev/agenda.md` (the learning agenda) — so the one
   auto-refreshed, boot-read surface was the natural home, and it carried
   nothing about decisions.

### Expected Behavior

Every register item blocked on an operator ruling appears in the
session-end review output: in `dev/agenda.md` (so the next session's intake
presents it) and in the printed routing notes (`PRESENT:` lines). A register
with no blocked items stays silent. The mechanism is deterministic — parse
the register's own convention, no LLM, no new state.

### Root Cause

The presentation duty existed only as prompt-level convention; no mechanical
surface enumerated what needed presenting, so it depended on the agent
remembering across sessions.

### Evidence

2026-10-03: the operator opened SCOPE.md and asked "are all of these items
seriously not completed?!" — twelve items, each naming an operator blocker,
none ever presented. Rulings were collected the same day (`T94`, `T83-E`,
`T95-B`, `T97`, `T87-B`, `R1`–`R3`; all completed and since left the register)
and the backlog cleared in one pass — demonstrating the cost was one
presentation, not twelve sessions of waiting.

## Proposed Solution

### Approach

`scripts/session-end-review.ts` gains `pendingOperatorDecisions(scope)`:
parse SCOPE.md's open-item convention (`- [ ] **ID. title**` blocks
containing a `**Blocker:**` sentence), extract id + summary + blocker, and
surface them two ways: a `## Pending operator decisions` section in
`dev/agenda.md` (capped by the existing 50-line bound) and one `PRESENT:`
routing note per decision. `runSessionEndReview` reads SCOPE.md from the
root; a missing register or one with no blocked items contributes nothing.

### Steps

1. Parser + agenda section + routing notes in `session-end-review.ts`.
2. Pins: blocked items surfaced (agenda + routing), non-blocked items
   silent, register-less roots silent.
3. Gates + receipt.

### Verification

The pins above prove both directions; `typecheck:scripts` covers the module;
`quality` covers the repo baseline. The 2026-10-03 run itself is the live
boundary evidence: with the mechanism absent the backlog rotted; with it,
this session's remaining blockers (T119, T62-followups, T122) appear in the
refreshed agenda.

## Verification Gates

- gate: test scripts/__tests__/session-end-review.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e3fd64bbf7d20c08f3dd4e41557ca523f3b0ff5eb342c1962ef245fe52d9c0dc
- verified: 2026-10-04T02:58:24.203Z
- test scripts/__tests__/session-end-review.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

The failure is operator-reported and reproduced by inspection: no surface in
`session-end-review.ts` (read 0-EOF) enumerates register blockers; agenda
held only tool recurrences.

### GREEN

Deterministic parse of the register's own convention; surfacing rides the
existing agenda write (single-writer, boot-read) and routing print. No new
files, no state.

### AUDIT

Cap safety: the agenda's 50-line bound is now enforced mechanically
(`slice(0, AGENDA_MAX_LINES)`) — decisions can never overflow it. Compound
ids (`T62-followups (…)`) parse via the `(`-branch of the id regex.
`FID-2026-0919-009`'s deliberate decline marker is untouched by bulk-close
and (still carrying a blocker line) will resurface — correct: it needs an
operator glance by design.

### SELF-CORRECT — the first live run surfaced the mechanism's own item

The first live run of this mechanism reported a defect the pins did not
cover: `FID-2026-1003-007` surfaced **itself** as a pending decision, with
the blocker `operator ruling` for weeks because nothing presented them… —
its own register entry *quotes* the `**Blocker:**` convention mid-sentence
to describe the failure, and the parser could not tell a quotation from a
declaration. A mechanism item asking the operator for a ruling it is itself
delivering is worse than silence: it manufactures exactly the noise the
mechanism exists to cut, and it would have done so on every session end.

Fix: a blocker is **declared** only by a line-leading `**Blocker:**` on the
item's own continuation line (the register's actual convention), and capture
starts at that declaration — so an item that quotes first and declares later
still reads its own blocker. Third pin added: a quoting item yields no
decision while a genuinely blocked sibling still surfaces (12/12).

The same live run exposed a second, unrelated gate failure: this FID's
Evidence section cited the completed ruling ids (`T94`, `T83-E`, `T95-B`,
`T97`, `T87-B`) bare, and the register prose cited `Task 62` bare, so
`scope-register-check` read four *completed* items as claims on current
scope. Per the module's own rule — inline code is a quotation of history, a
bare reference is a claim — they are now written as quotations. The
false-positive class is recorded here rather than absorbed: a new register
item that documents a convention in prose will hit it again, and the parser
is the durable fix.

### SELF-CORRECT 2 — the generated agenda failed its own markdown gate

`lint:md` then failed on the regenerated `dev/agenda.md`: the blocker line
sliced its field to 110 characters and prefixed 15 more, rendering 125
columns against MD013's 120 bound. The budget ignored the prefix that renders
ahead of it, and the defect was invisible in the function — it only appeared
through a repo-wide markdown gate acting on a *committed generated artifact*.
The budget is now computed per line as the remainder after that line's own
rendered prefix (`AGENDA_MAX_LINE - prefix.length`), so a longer id shortens
the summary instead of overflowing. Fourth pin added: every rendered agenda
line stays within the bound, using an over-long id as the case that would have
overflowed.

Closing that pin also required a real refactor, not a trim: the three new
fixtures repeated the same root-and-write scaffolding, and the file crossed
the 300-line `quality` cap. Per Law 13 the repeated scaffolding became one
`reviewRegister(items)` helper, which is what let all four pins survive intact
(13 pass / 0 fail) instead of one being cut to satisfy the cap.

Two lessons were promoted into `dev/LEARNINGS.md` with catalog entries in
`dev/LEARNING-RULES.md` — the parser must separate describing a convention
from using one, and a truncation budget must include its rendered prefix.

### Missed Questions

1. Why not block session END on unpresented decisions? Presentation is a
   duty of the NEXT session's intake; a hard end-gate would punish sessions
   that surface-and-wait. The agenda line is the obligation's carrier.
2. Why parse prose instead of a structured register? The register IS the
   operator-approved artifact; a parallel machine format would drift. The
   convention (`- [ ] **ID.**` + `**Blocker:**`) is stable and covered by
   `scope-register-check`.

### Convergence

Grounded in the live failure + the register format read today. Ready at
level 3; implemented same-session.

## Implementation Evidence

### Code Verification Evidence

- `scripts/session-end-review.ts` — `pendingOperatorDecisions` (parser),
  agenda section + `PRESENT:` routing notes, AGENDA_MAX_LINES enforced,
  `AGENDA_MAX_LINE` per-line budget.
- `scripts/__tests__/session-end-review.test.ts` — four new pins (surfaced /
  quoting-item-is-not-a-decision / line-length / silent) over one shared
  `reviewRegister` helper. Suite: 13 pass / 0 fail.
- `typecheck:scripts` exit 0; `scope-register-check` PASS (0 issues);
  `validate:repository` PASS; `quality` PASS; `lint:md` clean; ESLint
  `--max-warnings 0` clean.

### Step Status

- [x] Step 1 — parser + surfacing: implemented.
- [x] Step 2 — pins: implemented (13 pass / 0 fail).
- [x] Step 3 — gates + receipt: implemented (stamped below).

## Resolution

- **Fix Description:** pending operator decisions are parsed from SCOPE.md's
  own convention at every session end and surfaced in `dev/agenda.md` +
  `PRESENT:` routing notes, so the next session's intake must present them.
- **Tests Added:** `session-end-review.test.ts` +4 pins (13 pass / 0 fail).
- **Verification Evidence:** `session-end-review.test.ts` 13 pass / 0 fail;
  `typecheck:scripts` exit 0; `scope-register-check` PASS (0 issues);
  `validate:repository` PASS; `quality` PASS; `lint:md` clean; ESLint
  `--max-warnings 0` clean. Live run surfaced this register's three remaining
  blockers (T119, T62-followups, T122) same-day; the same run caught the
  self-surface defect and the generated-artifact line-length defect recorded
  under SELF-CORRECT, both fixed before closure.

## Lessons Learned

A blocker that names the operator is a promise to ask — recording it without
presenting it is a deferral wearing a compliance badge. Any state that waits
on a human must ride a surface that human actually reads at a cadence.

The second lesson is about the mechanism itself: **a parser that reads prose
must know the difference between a document *describing* a convention and a
document *using* one.** The first live run proved a passing test suite does
not establish that — the pins used fixture prose that never quoted the
convention, so the only run that could catch it was the real register. A
mechanism whose own item asks the operator for a ruling it is delivering
would have manufactured noise on every session end, and the fix was to make
the *declaration* structural (a line-leading token) rather than to make the
*text* special.

- **Archived:** 2026-10-03 (moved to `dev/fids/archive/`)
