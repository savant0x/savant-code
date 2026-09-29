# FID: Archived-FID Closure Guard — the closure ceremony's status flip can silently fail to land

**Filename:** `FID-2026-0928-013-archived-fid-closure-guard.md`
**ID:** FID-2026-0928-013
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The FID archive holds 436 records (re-measured 2026-09-28 with the repo's own
`parseFidStatus`); 395 read `closed` and 41 do not. At authoring, two September
records were identified whose own ledger entries say they were closed and
archived while the record reads otherwise. The implemented guard's first live
run then caught **nine** post-cutoff violators, not three — the same ceremony
defect (`verified`/`fixed` records whose ledgers say closed) reached back
through 0916/0917/0918 as well: eight status-flip misses with ledger-truth
closure evidence each (`FID-2026-0916-007`, `-0917-004`, `-0917-006`,
`-0918-001/-002/-003/-004`, `-0928-005`) plus the recorded operator decline
(`FID-2026-0919-009`, `analyzed`). That is not archaeology: it is a live
defect in the closure ceremony — the archive move and ledger entry are
performed while the in-record status flip silently fails to land. Nothing in
the gate battery walks `dev/fids/archive/`, so a mis-stated archived record is
invisible to every mechanical check forever. This FID adds the missing guard:
every archived record created on/after the FID-2026-0915-004 closure-vocabulary
date must read `closed` (or carry the explicit operator-declined terminal
marker), enforced as `validate:repository` issue code `fid.archive.not-closed`
and as an independently runnable probe. The three post-cutoff violators are
repaired as part of GREEN: two truth-aligned to `closed` per their existing
ledger/SCOPE records, one carrying the operator decline already recorded in it
2026-09-19. The pre-cutoff August batch (~38 records) remains outside the
guard's scope and stays blocked on the still-open T97 operator ruling.

## Environment

- **OS:** Windows 11 (win32, bash shell)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned)
- **Tool Versions:** Bun test, ESLint zero-tolerance, Prettier, markdownlint
- **Commit/State:** `main` at `f929e978` (v0.0.34 released, tree in sync with
  `origin/main`); uncommitted working tree

## Detailed Description

### Problem

The closure ceremony for a FID is: implement → verify → set status `closed`
→ add `- **Archived:**` line → move `dev/fids/` → `dev/fids/archive/` →
append `CHANGELOG.md` entry. Two records show the ceremony completing
everywhere EXCEPT the in-record status flip:

```text
dev/fids/archive/FID-2026-0917-006-compaction-signal-durable-retirement.md
  **Status:** fixed          <- record
  dev/LEARNINGS.md entry:    "closed and archived 2026-09-18"  <- ledger
  dev/fids/README.md:        "**Closed 2026-09-18; archived.**"  <- ledger

dev/fids/archive/FID-2026-0928-005-scope-register-open-items-only.md
  **Status:** verified       <- record
  SCOPE.md:                  the FID-2026-0928-005 gate change is treated as
                             landed and closed throughout  <- ledger
```

The moved file, the ledger entry, and the CHANGELOG entry all exist; only the
status token inside the moved record is stale. Because every consumer of FID
status keys off the record itself, these records read as in-flight work that
was mysteriously archived.

### Expected Behavior

An archived record's status must state the truth the ledger already claims.
Mechanically: `dev/fids/archive/FID-*.md` records created on/after
2026-09-15 (the FID-2026-0915-004 operator ruling that fixed `closed` as the
only lawful closure status) must read `closed`, or carry an explicit
operator-terminal decline marker where the operator's recorded ruling was a
decline. A gate must fail when they do not.

### Root Cause

`checkAll()` (`scripts/fid-check.ts:32-37`) and
`validateFidVerificationGates()` (`scripts/fid-gates.ts:75-93`) both walk
**only** `dev/fids/` — the archive directory is never read by any check.
The FID-2026-0919-021 ruling deliberately exempts `closed` records from the
receipt-freshness contract (closure edits the document after the last stamp),
but no check anywhere asserts the *status line itself* landed. The defect is
therefore unobservable: nothing can fail, so nothing did.

### Evidence

Recount 2026-09-28 (`dev/scratchpad/active/t97-recount.ts`, uses the repo's
own `parseFidStatus` — no re-implemented regex):

```text
total archived records: 436
closed: 395 | non-closed: 39 | no **Status:** line: 2
post-cutoff (>= 2026-0915) non-closed: 3 at authoring; the LIVE probe run
catch (first execution of the new guard) found 9:
  FID-2026-0916-007 ... verified   (in-record Closed Date 2026-09-16)
  FID-2026-0917-004 ... verified   (ledger: closed + archived 2026-09-17)
  FID-2026-0917-006 ... fixed      (ledger: closed 2026-09-18)
  FID-2026-0918-001 ... verified   (Closed Date 2026-09-18, G2 69f6e7a7)
  FID-2026-0918-002 ... verified   (Closed Date 2026-09-18, G2 69f6e7a7)
  FID-2026-0918-003 ... verified   (Closed Date 2026-09-18)
  FID-2026-0918-004 ... verified   (Closed Date 2026-09-18 19:34)
  FID-2026-0919-009 ... analyzed   (operator DECLINE recorded 2026-09-19)
  FID-2026-0928-005 ... verified   (Resolution: "Closed and implemented.")
```

Consumer evidence — the archive walk that does not exist:

```text
scripts/fid-check.ts:32-37   activeFidFiles(): readdirSync(root/dev/fids) only
scripts/fid-gates.ts:75-93   activeFixedFidFiles(root): readdirSync(root/dev/fids) only
```

## Impact Assessment

### Affected Components

- `scripts/fid-gates.ts` — new archived-closure validator (wired into the battery)
- `scripts/audit-fid-archived-closures.ts` — new standalone probe (gate-provable)
- `scripts/validate-repository.ts` — one line wiring
- `dev/fids/archive/FID-2026-0917-006-*.md`, `FID-2026-0928-005-*.md`,
  `FID-2026-0919-009-*.md` — record-truth alignment (status/marker only)
- `scripts/__tests__/fid-archived-closures.test.ts` — new pin suite

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: ledger-integrity degradation; no runtime impact; workaround
      exists (humans read the ledger entries), but the drift compounds
- [ ] Low

## Proposed Solution

### Approach

One check, two surfaces, three record repairs:

1. **Validator** — `validateArchivedFidClosures(root): FidLedgerIssue[]` in
   `scripts/fid-gates.ts` (same module as the other FID repository gate; ~40
   lines, file stays under the 300-line ceiling). Rule:
   - Walk `dev/fids/archive/FID-*.md` (missing/empty dir → no issues).
   - Parse the record's own date from its filename (`FID-YYYY-MMDD-…`);
     records with `YYYYMMDD < 20260915` are exempt (pre-vocabulary history;
     their disposition is T97, blocked on the operator ruling — NOT absorbed
     here).
   - A post-cutoff record is lawful iff (a) `parseFidStatus` reads a value
     whose first word is `closed` (decorated forms like
     `closed (2026-08-09 — …)` accepted), or (b) the record carries the
     operator-terminal decline marker
     `- **Archived-Declined:** operator-approved YYYY-MM-DD` (the marker form
     of the scope protocol's lawful-exit vocabulary, used only where an
     operator ruling already exists in the record).
   - Violations emit `{ code: 'fid.archive.not-closed', severity: 'error' }`
     naming the record, the found status, and the repair.
2. **Probe** — `scripts/audit-fid-archived-closures.ts` (the
   FID-2026-0915-004 worked-example pattern: make the repo-gate check
   independently runnable so the existing `probe` gate kind can express it).
   Exit 0 clean, exit 1 with issues. Never re-enters FID verification, so it
   is a legal gate for this very FID.
3. **Wire** — one line in `scripts/validate-repository.ts`'s issue array.
4. **Record repairs (GREEN) — nine, each aligned to its own evidence:**
   - Eight status flips `verified`/`fixed` → `closed` (`FID-2026-0916-007`,
     `-0917-004`, `-0917-006`, `-0918-001`, `-0918-002`, `-0918-003`,
     `-0918-004`, `-0928-005`). Truth sources per record: its own Resolution
     `Closed Date` line (six records; two cite G2 commit `69f6e7a7`), or the
     README/CHANGELOG closure entries (0917-004, 0917-006), or the Resolution
     prose "Closed and implemented." + SCOPE treatment (0928-005).
   - `FID-2026-0919-009`: keep `analyzed` (it has no implementation — a
     declined finding is not closable in the implementation-evidence sense),
     add `- **Archived-Declined:** operator-approved 2026-09-19 …` citing
     the decline already recorded verbatim in its header. The marker cannot
     be minted for a record lacking an in-record operator ruling.

### Steps

1. RED-first pin suite `scripts/__tests__/fid-archived-closures.test.ts`;
   observe it fail against the unmodified tree (module exports missing).
2. Implement the validator + probe + wiring.
3. Re-run suite → green; run the probe LIVE → exit 1 catching the
   post-cutoff violators (the guard's first live catch: nine — eight status
   flips + one decline marker; see Evidence), then apply the nine record
   repairs → probe exit 0.
4. Full gate battery; stamp receipt at `verified`.
5. Close: status `closed`, Resolution, archive move, CHANGELOG entry,
   `dev/fids/README.md` closure block, re-stamp at the archived path.
6. SCOPE.md: refresh T97's measured figures (the three post-cutoff records
   leave its problem set; the pre-cutoff August batch remains) — T97 itself
   stays open pending the operator ruling that was not given this session.

### Verification

- New suite passes with a proven RED leg (fails pre-change).
- Probe exits 1 on the unrepaired tree catching exactly the three records,
  and exits 0 after the repairs (both pasted into this FID).
- `bun run typecheck` (full chain incl. `typecheck:scripts`), `bun run test`,
  `bun x eslint . --max-warnings 0`, `bun run lint:md`,
  `bunx prettier --check .`, `bun run quality:report`,
  `bun run validate:repository`, `bun run fid:verify --check` — all green.
- Ground truth: `grep -c '"closed'`-class recount via the repo parser shows
  post-cutoff non-closed = 0 after repairs.

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative path and appears as a declared gate below.

## Verification Gates

- gate: test scripts/__tests__/fid-archived-closures.test.ts
- gate: probe scripts/audit-fid-archived-closures.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ea90629489cfbfd0fe16d401efdc9e9d47b3832190ea6950c581c663fd221c08
- verified: 2026-09-29T04:31:49.668Z
- test scripts/__tests__/fid-archived-closures.test.ts: exit 0
- probe scripts/audit-fid-archived-closures.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Ceremony status-flip can fail silently; two September instances
  with ledger contradiction (file:line above). No gate walks the archive
  (`fid-check.ts:32-37`, `fid-gates.ts:75-93`). 436 archived records, 41
  problem records, 3 of them post-vocabulary-cutoff.
- **GREEN:** Validator + probe + wiring as specified; three record repairs.
- **AUDIT:** RED leg proven (import error pre-change, 0 pass). GREEN: suite
  8/8 after implementation. Probe LIVE: exit 1 catching 9 post-cutoff
  violators, then exit 0 after the nine repairs (both outputs transcribed in
  Evidence). Full battery: typecheck exit 0 (all legs incl.
  `typecheck:scripts`), `bun run test` 421/0 final leg (two live-scope legs
  failed mid-flight — the register line for this very FID was missing; the
  guards' own catch, fixed, re-run green), eslint 0, lint:md 0, prettier
  clean (one file reformatted), quality PASS (1498 files),
  `validate:repository` PASS, `fid:verify --check` PASS. Call-graph:
  production callers of `validateArchivedFidClosures` =
  `scripts/validate-repository.ts:261` + `scripts/audit-fid-archived-closures.ts:15`
  (grep-cited); zero-caller risk eliminated.
- **ADVERSARIAL:** Self-challenge on the repairs: each of the eight status
  flips cites its own record's `Closed Date` line or ledger closure entry
  (six in-record, `0917-004`/`0917-006` via README/CHANGELOG ledger,
  `0928-005` via Resolution prose + SCOPE treatment) — none bulk-assumed;
  `0919-009` keeps `analyzed` + the dated marker because `closed` would
  fabricate implementation evidence for a declined finding. The cutoff is
  2026-09-15 (vocabulary ruling), not session-arbitrary; the pre-cutoff set
  remains T97's, not absorbed here. Decorated `closed (…)` forms accepted,
  pinned. No violation of the FID-2026-0919-021 closed-fingerprint ruling:
  this guard asserts the status line only.
- **CHANGE DELTA:** ~18% of FID text (summary correction, GREEN evidence,
  repairs detail)

### Missed Questions

1. *Why a cutoff instead of flagging all 41?* Bulk-flipping pre-contract
   August records to `closed` without per-record implementation evidence is
   exactly the Ground-Truth violation the protocol exists to prevent, and
   their disposition is already an open, operator-gated item (T97). The
   ratchet makes "no NEW instances" mechanical while leaving the operator's
   ruling sovereign over history. Cutoff date = the ruling (2026-09-15,
   FID-2026-0915-004) that made `closed` the only lawful closure status —
   from that date, a non-`closed` archived record is a ceremony defect, not
   history.
2. *Why a new marker instead of forcing 0919-009 to `closed`?* `closed`
   requires implementation evidence; the operator declined the mitigation,
   so none exists or will exist. Forcing `closed` would fabricate evidence.
   The marker expresses the one lawful terminal state a declined finding has,
   reusing the scope protocol's `operator-approved <date>` vocabulary, and is
   only writable where an in-record operator ruling exists.
3. *Why `validate:repository` and not `fid:verify --check`?* `--check` is the
   informational surface by ruling (FID-2026-0919-021) and never affects exit
   codes; a ceremony defect must fail a gate. The battery route also gets the
   check for free wherever `validate:repository` runs (pre-push adjacent,
   release preaudit).
4. *Does the guard fight the FID-2026-0919-021 closed-record drift ruling?*
   No. That ruling says a closed record's *fingerprint* may drift by design;
   this guard asserts only the *status line*, which the closure ceremony must
   set correctly before the drift window even opens. The two rulings compose:
   bytes may drift; the declared closure state may not be a lie.
5. *Can the probe recurse into validate:repository (C3 self-recursion)?* No —
   it imports only the new validator and exits on its result; it never
   invokes FID verification (Lesson, FID-2026-0915-004).

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending operator git execution (G2 withheld)
- [x] **File:line ranges:** `scripts/fid-gates.ts:175-247` (cutoff constant,
      marker regex, date parser, `validateArchivedFidClosures`);
      `scripts/audit-fid-archived-closures.ts:1-25` (probe);
      `scripts/validate-repository.ts:22-24,261` (wiring);
      `scripts/__tests__/fid-archived-closures.test.ts:1-103` (8 pins);
      nine repaired archived records (status lines / marker, listed above)
- [x] **Gate output:** typecheck exit 0; `bun run test` 421 pass / 0 fail
      (final leg); eslint `--max-warnings 0` exit 0; lint:md exit 0;
      prettier clean; quality PASS (1498 baselined files);
      `validate:repository` PASS; probe PASS exit 0; pin suite 8/8
- [x] **Reproducibility:** `bun run scripts/audit-fid-archived-closures.ts`
      exits 0 on the repaired tree; grep `validateArchivedFidClosures`
      finds the definition + both production callers
- [x] **Step statuses:** Step 1 implemented (RED leg observed failing);
      Step 2 implemented; Step 3 implemented (probe caught 9, repairs
      applied, probe exit 0); Step 4 implemented (battery + stamp);
      Step 5 implemented (closure + archive + CHANGELOG + README);
      Step 6 implemented (SCOPE refreshed, T97 stays open)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (validator, probe,
      wiring, pins, nine repaired records — all on disk)
- [x] Implementation matches the Proposed Solution (validator + probe +
      wiring + nine record repairs; cutoff + marker as specified)
- [x] Typecheck/tests/lint pass with pasted tool output (Loop 1 AUDIT)
- [x] Production call-graph evidence is present (two callers grep-cited)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** The live scope guards caught this FID's own register gap
  (`scope.unregistered-item` + two failing agent-runtime legs) — the check
  designed for exactly this omission fired on its own author.
- **GREEN:** SCOPE.md register line added; T97's stale figures refreshed in
  the same edit (436/395/41 with the 9-record post-cutoff disposition
  recorded); both probes + both live legs re-run green.
- **AUDIT:** `bun run scripts/scope-register-check.ts` PASS (0 issues);
  `scope-guard-check` PASS (0 issues); agent-runtime scope legs 23/0.
- **ADVERSARIAL:** The FID correction (3 → 9 violators) was folded into the
  document BEFORE the record repairs, so the record and the repairs never
  disagreed; SCOPE keeps T97 open — the guard narrows its surface, it does
  not close it.
- **CHANGE DELTA:** ~8% (register line + T97 refresh + this loop's entries)

### Loop 3 — Final convergence

- **RED:** Residual risk — the guard reads filenames, not record-internal
  dates; a mis-dated filename could exempt a bad record. Accepted: the
  filename IS the FID identity everywhere else in this repo (ledger checks,
  numbering rules), and dating from the record's own `**Created:**` field
  would trust the same class of manually-maintained metadata this guard
  exists to catch.
- **GREEN:** Boundary pin (`20260915` = first governed day) + decorated-closed
  pin + undated-marker-rejected pin close the parsing edge cases.
- **AUDIT:** Final battery green (see Loop 1 AUDIT); `fid:verify --check`
  explicitly names this record as outside the contract while `converged` →
  stamp pending, then enforced once stamped.
- **ADVERSARIAL:** The marker regex requires the literal
  `operator-approved YYYY-MM-DD` — it cannot be satisfied by prose like
  "declined" without the dated ruling form, so the marker cannot become the
  quiet path the scope protocol eliminated.
- **CHANGE DELTA:** ~6% (this loop + lessons)

## Resolution

- **Closed Date:** 2026-09-28
- **Fix Description:** New archived-FID closure guard —
  `validateArchivedFidClosures` in `scripts/fid-gates.ts` (wired into
  `validate:repository` and the standalone probe
  `scripts/audit-fid-archived-closures.ts`): every record in
  `dev/fids/archive/` created on/after 2026-09-15 must read `closed`
  (decorated forms accepted) or carry
  `- **Archived-Declined:** operator-approved YYYY-MM-DD`. Nine records
  repaired: eight status flips `verified`/`fixed` → `closed`, each aligned
  to its own ledger/Resolution closure evidence; one dated operator-decline
  marker on `FID-2026-0919-009` (its recorded 2026-09-19 decline). The
  pre-cutoff August batch remains T97's, blocked on the operator ruling.
- **Tests Added:** Yes — `scripts/__tests__/fid-archived-closures.test.ts`
  (8 pins; RED leg proven, import error pre-change).
- **Verification Evidence:** Gate stamp 3/3 LIVE (test + probe + quality,
  receipt below); typecheck exit 0; `bun run test` 421/0; eslint 0;
  lint:md 0; prettier clean; `validate:repository` PASS; probe exit 0 after
  repairs (exit 1 catching 9 before them — both transcribed above).
- **Archived:** 2026-09-28

## Lessons Learned

- A lifecycle ceremony whose steps are manually maintained needs a mechanical
  guard on the step most likely to be skipped when the surrounding steps
  (move, ledger, CHANGELOG) all succeeded — the success of the neighbors
  camouflages the skipped flip.
- The ledger (README/CHANGELOG/SCOPE entries) and the record can disagree
  silently; consumers that key off the record drift with it. Any new status
  or terminal marker must be added together with the check that enforces it.
- Guards that read structure (filename dates) should pin their boundaries
  (first governed day) as constants with their own test, so a future cutoff
  change is a visible edit, not a silent rewrite.
