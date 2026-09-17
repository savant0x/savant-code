# FID: LEARNINGS.md structural rebuild — boundary inversion + retire-tool defects

**Filename:** `FID-2026-0916-007-learnings-structure-rebuild.md`
**ID:** FID-2026-0916-007
**Severity:** high
**Status:** verified
**Created:** 2026-09-16 19:08
**YAGNI-Compliance:** Verified

---

## Summary

`dev/LEARNINGS.md` (1,610 lines / 102,520 chars) exceeds the 100,000-char
tool read limit, so the boot read truncates the newest lessons every session.
The cause is a structural inversion: the legacy boundary sits at line 332, but
16 of the 32 `## Lesson:` entries were appended below it (lines 1141–1610)
because the insertion marker lives at the file's end. The retirement tool built
to fix exactly this (`scripts/learnings-retire.ts`) has two latent defects that
would destroy content if run — a `NaN` cap and a rewrite that drops all
non-`## Lesson:` prose.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** bun 1.3.14; repo at `0.0.31`
- **Commit/State:** `main` at `d9d85413`, clean tree except this FID

## Detailed Description

### Problem

Three interlocking defects:

1. **Boundary inversion.** `<!-- Legacy entries below... -->` is at line 332;
   the insertion marker `<!-- Add new entries above this line -->` is at line
   1610. Every new lesson is appended above the marker, i.e. *below* the legacy
   boundary. `structuredBlocks()` in `scripts/learnings-schema.ts:160` slices
   at the boundary, so `learnings:check` validates only 16 of 32 entries and
   prints a false `PASS (16 structured entries)`.

2. **Retire tool: NaN cap.** `learnings-retire.ts:137-141` reads
   `process.argv[indexOf('--cap') + 1]`; absent `--cap` gives `indexOf === -1`,
   so it reads `argv[0]` (the bun path) → `NaN`. `NaN` is not nullish, so
   `opts.cap ?? DEFAULT_LINE_CAP` keeps `NaN`; `measure(kept) <= NaN` is always
   false, so the loop retires **every** entry. Dry-run output:
   `32 candidate(s); 1611 → 1 lines (cap NaN)`.

3. **Retire tool: content loss.** `applyRetirement:124-133` rewrites the file
   as `# LEARNINGS` + kept lesson blocks only. All prose between/below lessons —
   the 57,440-char legacy narrative, the boundary marker, the insertion marker —
   is silently deleted, not archived.

### Expected Behavior (Safe Core — operator-approved 2026-09-16)

The operator was presented with three options for the 16 pre-schema narrative
lessons below the boundary (conform them to the strict schema, relax the schema
and promote them, or Safe Core). **Safe Core was chosen**: conforming would
require inventing `Evidence`/`Verification` claims from prose citations, which
Law 5 forbids.

- The legacy `## Session` prose is moved **verbatim** to
  `dev/LEARNINGS-RETIRED.md` (move-only; nothing deleted).
- The insertion marker sits at the **top of governed space** (above the
  boundary) so newly appended lessons land where `learnings:check` validates
  them, newest-first.
- The 16 pre-schema narrative lessons are **preserved below the boundary
  byte-identically, deliberately unvalidated** — they use `Context` rather than
  `Failure`/`Evidence`/`Verification` and free-form `Scope`, so they cannot
  pass the strict schema without fabricating fields.
- `learnings:check` output disambiguates the two populations so the entry count
  can never be misread as "total lessons."
- `learnings:retire` with no `--cap` uses `DEFAULT_LINE_CAP` (1200), never NaN.
- Retirement is move-only: every retired byte lands in the archive; no content
  is destroyed.
- The file fits under the 100k read limit and the 1200-line cap.

**Explicitly out of scope:** promoting, re-sorting, or field-conforming the 16
narrative lessons; relaxing the validation contract.

### Root Cause

The insertion marker was placed at end-of-file when the boundary was
introduced; subsequent authors appended above it without noticing the boundary.
The retire tool's arg-parsing and rewrite paths were never exercised against
the real file (the archive `dev/LEARNINGS-RETIRED.md` does not exist), so both
defects stayed live.

### Evidence

```text
$ wc -c -l dev/LEARNINGS.md
  1610  102520 dev/LEARNINGS.md
$ grep -n 'Legacy entries below' dev/LEARNINGS.md
332:<!-- Legacy entries below this line are preserved historical prose. -->
$ grep -n 'Add new entries above' dev/LEARNINGS.md
1610:<!-- Add new entries above this line -->
$ bun run learnings:check
learnings: PASS (16 structured entries)
$ bun run learnings:retire --dry-run
learnings:retire (dry-run): 32 candidate(s); 1611 → 1 lines (cap NaN)
```

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md` — Safe Core restructure (marker to top, prose retired)
- `dev/LEARNINGS-RETIRED.md` — new move-only archive
- `scripts/learnings-retire.ts` — NaN-cap + content-loss defect fixes
- `scripts/learnings-validation.ts` — marker-above-boundary inversion fix
- `scripts/learnings.ts` — disambiguated `learnings:check` output
- `scripts/learnings.test.ts` — fixtures to new layout + 2 inversion tests
- `scripts/__tests__/learnings-retire.test.ts` — regression pins (8 tests)

### Risk Level

- [x] High: the retire tool, if run before this fix, deletes 57k of narrative
      and all structural markers in one command.

## Proposed Solution

### Approach

Fix the tool first (so the retirement path is safe), then apply the one-shot
Safe Core migration: retire the prose region verbatim, relocate the marker to
the top of governed space, and leave the narrative lessons below the boundary
untouched.

### Steps

1. Fix NaN cap: parse `--cap` defensively, fall back to `DEFAULT_LINE_CAP`,
   reject non-finite values.
2. Fix content loss: `removeLessonSpans` removes only retired `## Lesson:`
   spans, preserving the boundary, the insertion marker, and all prose
   byte-identically in place; retired spans are archived verbatim.
3. Add regression tests pinning both defects + the final-block marker edge.
4. Fix the validator's marker rule: the insertion marker must sit **above**
   the legacy boundary (the old "nothing may trail the marker" rule is what
   pushed it to EOF and inverted the file).
5. Migrate `dev/LEARNINGS.md` to Safe Core: move the `## Session` prose region
   (2026-07-25..2026-08-10) to `dev/LEARNINGS-RETIRED.md` verbatim; relocate the
   marker to line 3; preserve the 16 narrative lessons below the boundary.
6. Disambiguate `learnings:check` output (validated count vs. below-boundary
   narrative count).
7. Verify: `learnings:check` passes; file under both caps; prose byte-identical
   to `git show HEAD:dev/LEARNINGS.md`.

### Verification

- `bun run learnings:check` → PASS (16 structured entries; 16 narrative entries
  below boundary — unvalidated by design)
- `bun run learnings:retire --dry-run` → 0 candidates; 811 → 811 lines (cap
  1200) — finite cap, no NaN, no content loss
- `wc -c -l dev/LEARNINGS.md` → 810 lines / 45,409 chars (was 1,610 / 102,520)
- Retired prose (57,133 chars) byte-identical to `git show HEAD:` extraction:
  `exact substring: true`, `normalized equal: true`

## Verification Gates

- gate: test scripts/__tests__/learnings-retire.test.ts
- gate: probe scripts/learnings-retire.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Three defects cataloged above with tool output evidence.
- **GREEN:** Steps 1–2 applied and verified inline (tsc clean, eslint clean,
      dry-run `12 candidate(s); 1611 → 592 lines (cap 1200)` — no NaN, and the
      retained 592 lines prove prose/markers survive the rewrite). Steps 3–7
      in progress: regression tests, file restructure, prose retirement.
- **AUDIT:** Deferred to inline verification (see system directive).
- **ADVERSARIAL:** Deferred — change is documentation/tooling, not
  security-sensitive; inline double-audit (basher + Verifier) suffices.
- **CHANGE DELTA:** n/a (initial pass)

### Missed Questions

1. *Should retired prose be deleted or archived?* Archived — the tool's own
   contract says "MOVE-ONLY, NEVER DELETE", and the legacy narrative is the
   audit trail for pre-2026-08-11 sessions.
2. *Do the 16 narrative lessons need evidence conformance?* **No — Safe Core
   ruling.** The validator rejects prose citations, but conforming would mean
   fabricating `Evidence`/`Verification` claims (Law 5: no placeholders; Law 12:
   never fabricate audit evidence). They stay below the boundary, preserved
   verbatim, explicitly unvalidated, until a future FID promotes them with real
   evidence.
3. *Is the boundary marker still needed after the prose moves?* Yes —
   `learnings-validation.ts:102` requires exactly one boundary, it anchors
   `structuredBlocks()` governed-space slicing, and it now documents where the
   narrative region begins.
4. *Should the migration script be kept?* No — the one-shot migration was
   applied and then deleted (untracked artifact). A stale copy from a parallel
   session implemented the rejected promotion approach and was removed as a
   re-run hazard.

### Implementation Evidence

- [x] **Commit SHA:** pending (uncommitted; operator to commit)
- [x] **File:line ranges:** `scripts/learnings-retire.ts` (parseCap +
      removeLessonSpans + applyRetirement); `scripts/learnings-validation.ts`
      (markerIssues inversion); `scripts/learnings.ts` (output disambiguation);
      `dev/LEARNINGS.md` (Safe Core restructure); `dev/LEARNINGS-RETIRED.md`
      (new); test pins in `scripts/__tests__/` + `scripts/learnings.test.ts`
- [x] **Gate output:** captured in Resolution below
- [x] **Reproducibility:** `grep -c '^## Lesson:' dev/LEARNINGS.md` = 32
      (16 governed + 16 below boundary); `learnings:check` reports both counts
- [x] **Step statuses:** all steps `implemented` at closure

## Resolution

- **Closed Date:** 2026-09-16
- **Fix Description:** Retire-tool defects fixed (NaN cap → finite-cap guard with
  `Number.isFinite` rejection; content loss → `removeLessonSpans` removes only
  retired lesson spans, preserving all prose/markers in place). Validator marker
  rule inverted: marker must sit above the boundary. Safe Core migration applied
  to `dev/LEARNINGS.md`: prose region (2026-07-25..2026-08-10) retired verbatim
  to a new move-only archive; marker relocated to line 3; 16 narrative lessons
  preserved below the boundary, unvalidated by design. `learnings:check` output
  now names both populations.
- **Tests Added:** 8 in `scripts/__tests__/learnings-retire.test.ts` (NaN cap,
  prose/marker preservation, final-block marker re-emission, append-only
  archive); 2 in `scripts/learnings.test.ts` (marker-below-boundary, trailing
  prose after boundary).
- **Verification Evidence:**
  - `bun run learnings:check` → `PASS (16 structured entries; 16 narrative
    entries below boundary — unvalidated by design)`
  - `bun run learnings:retire --dry-run` → `0 candidate(s); 811 → 811 lines
    (cap 1200)`
  - `wc -c -l dev/LEARNINGS.md` → `810 45409` (was `1610 102520`)
  - Retired prose byte-identity vs `git show HEAD:` → `exact substring: true`,
    `normalized equal: true` (57,133 chars both sides)
  - tsc (exit 0), eslint `--max-warnings 0` (exit 0), prettier (all clean),
    markdownlint (exit 0), 27 tests / 0 fail across 3 files
  - Independent Verifier audit: 2 FAIL + 2 NEEDS-REVIEW raised, all 4
    addressed in self-correct (FID spec drift, check-output ambiguity,
    byte-identity proof, final-block regression hole).
- **Archived:** 2026-09-16 — moved to `dev/fids/archive/`

## Lessons Learned

A file-growth guard is only as good as its insertion marker's position. When a
"new entries go above this line" marker is placed at end-of-file, every append
silently lands outside governed space, and the validator's PASS becomes a lie.
The marker belongs at the top of governed space, not at EOF.

A count in a gate message is a claim about scope, not just a number: `PASS (16
structured entries)` over a 32-lesson file re-introduced the very false-pass
confusion this FID set out to kill, in subtler form. Gate output must name both
populations when governed and unvalidated content coexist by design.

When pre-schema content cannot be conformed without inventing evidence, the
honest move is an explicit two-tier structure — validated above the boundary,
preserved-but-unvalidated below — rather than either fabricating fields or
silently dropping the content from governance.