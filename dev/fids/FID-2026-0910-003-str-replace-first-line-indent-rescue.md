# FID: Indentation rescue writes raw replacements + lacks a first-line re-indent variant

**Filename:** `FID-2026-0910-003-str-replace-first-line-indent-rescue.md`
**ID:** FID-2026-0910-003
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-10 13:55
**YAGNI-Compliance:** Verified — wires existing dead output + one mirror
rescue variant inside the single indentation-rescue helper; no new machinery

---

## Summary

The 2026-09-10 implementation session absorbed 6+ incidents where the first
line of a multi-line `str_replace` `newString` (and several `write_file`
contents' trailing newlines) lost leading whitespace in the landed file, each
rescued manually by prettier. RED verification refuted the first hypothesis —
a runtime trim: the entire parse-to-handler chain (JSON.parse → zod
preprocess → handler) passes string values byte-exact, and a repo-wide grep
finds zero `trimStart`/`trimEnd` anywhere in it; every `.trim()` hit is a
schema-description template tail. The corruption originates at model emission
(the flash-class emission-quirk family FID-2026-0909-008 catalogs). But the
0-EOF read of the rescue path exposed two genuine runtime defects that turn
an emission quirk into landed file corruption: (A) the indentation-rescue
helper computes a re-indented `replaceContent` for every rescued match, yet
the caller discards it and writes the raw `newString` — the helper's
`replaceContent` is dead output, so every uniform-indent rescue lands
under-indented content; (B) the helper only tries uniform indent adds across
all lines, so the exact observed shape — first line's indent eaten, interior
lines intact — has no rescue and fails to not-found.

## Problem

### Evidence chain (0-EOF reads + greps, 2026-09-10)

1. **Incidents (live session transcript):** first-line indent eaten on
   multi-line newStrings — `state.ts` ×2 (`isFirstChunk` field, init
   object), `common/src/types/contracts/llm.ts` (`| {` union arm),
   `flush-handler.ts` (comment block), the FID-007 steering-map entry
   (`read_files:`); trailing newline lost on `state.ts` ×2 and
   `error-chunk.ts`. Prettier `--write` rescued every one — five of the
   six incidents surfaced as `[warn]` prettier failures immediately after
   the edit.
2. **No runtime trim:** `grep -rn 'trimStart|trimEnd'` → zero hits
   repo-wide; the 60+ `.trim()` hits in `common/src/tools/params/*` are
   description-literal tails (`str-replace.ts:99`, `write-file.ts:63` —
   verified by reading the surrounding templates); the handler files have
   none. `coerceToArray` / `coerceToObject` / `normalizeReplacementAliases`
   (`common/src/tools/params/utils.ts`, read 0-EOF) never touch string
   value contents.
3. **Defect A — dead rescue output:**
   `packages/agent-runtime/src/generate-diffs-prompt.ts` —
   `tryToDoStringReplacementWithExtraIndentation` returns
   `{ searchContent, replaceContent }`, computing the re-indented
   replacement for each rescued indent level.
   `packages/agent-runtime/src/process-str-replace.ts:169-173` — on rescue,
   `tryMatchOldStr` returns `{ success: true, oldStr: newChange.searchContent }`
   ONLY; the caller then writes
   `currentContent.replaceAll(updatedOldStr, () => normalizedNewStr)` —
   the raw model `newString`. `newChange.replaceContent` is computed and
   discarded. A match rescued at +2 indent therefore writes content whose
   first line (and every line) is under-indented by 2 — the landed-file
   corruption class observed.
4. **Defect B — missing first-line rescue:** the helper's loops add
   `i` spaces/tabs to EVERY non-empty line (i = 1..12 / 1..6). The observed
   emission quirk strips ONLY the first line's indent — uniform re-indent
   over-indents the interior lines and never matches. No variant tries
   re-indenting the first line alone (to the interior common indent, or by
   level scan). Those `oldString`s fall through to the whitespace-collapsed
   last resort (`process-str-replace.ts:183-205`), which can rescue position
   but returns the file's whitespace-stripped normalization boundary — or
   simply fails with not-found.
5. **Matcher-safety invariant:** both defects live on the
   match-FAILURE-only path. An exact match never consults the rescue
   (`tryMatchOldStr` returns at `count === 1` before the helper runs), so
   the fix cannot alter any currently-successful edit.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/process-str-replace.ts` — `tryMatchOldStr`
  returns the rescued `replaceContent` alongside `oldStr`;
  `processStrReplace` writes it on rescue
- `packages/agent-runtime/src/generate-diffs-prompt.ts` —
  `tryToDoStringReplacementWithExtraIndentation` gains the first-line-only
  re-indent variant (spaces + tabs, same scan bounds)
- `packages/agent-runtime/src/__tests__/process-str-replace.test.ts` —
  RED-first pins (a)–(d)
- Not affected: exact-match path (never consults rescue — invariant 5),
  ambiguity/allowMultiple paths, `write_file` (no runtime match step),
  the param schemas, `propose-str-replace` (preview-only sibling)

### Risk Level

- [ ] Critical / [ ] High
- [x] Medium: every uniform-indent rescue currently lands corrupted
      content silently (Defect A — live defect regardless of the emission
      root); the observed quirk class fails to not-found (Defect B) and
      burns a retry. Fix is matcher-failure-only, so no currently-green
      behavior can change.
- [ ] Low

## Proposed Solution

1. **Wire the dead output (Defect A):** `tryMatchOldStr` rescue branches
   return `{ success: true, oldStr, newStr }` carrying the helper's
   `replaceContent`; the whitespace-collapsed last resort returns the
   file-actual content as `newStr` unchanged. `processStrReplace` writes
   the returned `newStr` (falling back to the model's `normalizedNewStr`
   only when no rescue variant matched). Exact/allowMultiple matches keep
   today's semantics.
2. **First-line re-indent rescue (Defect B):** in the same helper — one
   truth for indent rescues (Law 13) — after the uniform loops fail, scan
   first-line-only indent adds (spaces 1..12, then tabs 1..6, same
   bounds): re-indent ONLY the first non-empty line; on match, mirror the
   same first-line indent onto `replaceContent`. Covers both directions
   (model under-indents line 1 vs the file requiring deeper line 1).
3. **RED-first pins** in `process-str-replace.test.ts`:
   (a) uniform-indent rescue writes the re-indented replacement (fails
   today via the discard — the RED leg); (b) first-line-dedent `oldString`
   matches via the new variant and lands the mirrored-indent replacement;
   (c) an exact match never triggers a rescue (oldString file content and
   replacement must be byte-exact); (d) rescue failure still yields the
   canonical not-found error text.

### Honest Residuals

- `newString` corruption on **exact** matches has no runtime ground truth
  — the model's old and new strings agree with each other, so the file
  faithfully records both; prettier remains the net there. Documented, not
  fixed.
- `write_file` trailing-newline loss is likewise intent-ambiguous at the
  runtime layer; prettier normalizes.
- The emission-side root (why the model eats line-1 indent) is
  FID-2026-0909-008's territory — its finishReason instrumentation plus
  these rescues make the next live occurrence diagnosable.

## Steps

1. RED-first: author pins (a)–(d) in `process-str-replace.test.ts`; run
   pre-fix — (a)/(b) must fail, (c)/(d) hold.
2. GREEN: Defect A wiring + Defect B variant; suite green.
3. Gates: typecheck agent-runtime, the suite, eslint + prettier on both
   touched files.
4. Close per ceremony: Verifier audit, self-correct, status, archive,
   CHANGELOG, path-scoped commit.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/process-str-replace.test.ts
- gate: eslint + prettier on the two touched files

## Perfection Loop

### Loop 1 — RED / GREEN (2026-09-10, this session)

- **RED:** 6+ live incidents cataloged from the session transcript
  (first-line indent eaten on multi-line newStrings across `state.ts`,
  `llm.ts`, `flush-handler.ts`, the FID-007 map entry; trailing newlines
  lost on `state.ts` / `error-chunk.ts`). Hypothesis chain verified: a
  runtime trim was REFUTED by repo-wide grep (zero `trimStart`/`trimEnd`;
  all `.trim()` hits are schema-description template tails, verified 0-EOF);
  the corruption is emission-side (FID-008's family). The rescue-path read
  (0-EOF: `process-str-replace.ts`, `generate-diffs-prompt.ts`, the param
  schema, `utils.ts`) exposed the two runtime defects (dead rescue output;
  missing first-line variant). Matcher-safety invariant established before
  any design (rescue is failure-only).
- **GREEN (design, converged):** wire the dead output + add the
  first-line re-indent variant in the one helper (Law 13) + RED-first
  pins. Honest residuals documented (exact-match newString corruption,
  write_file trailing newlines — prettier remains the net; emission root
  is FID-008 territory).

### Loop 2 — Implementation (2026-09-10, this session)

- **Number correction:** authored as 0910-002, renumbered to 0910-003 —
  the archived author-field FID already owned 002 on this date (rule:
  never reuse a number on the same date). File renamed + in-file
  references re-sed; the pin-suite describe label corrected.
- **RED (suite-first proof):** pins (a)–(d) authored before the fix;
  pre-fix run 13 pass / 2 fail — exactly (a) (uniform rescue writes the
  re-indented replacement — fails via the discard) and (b)
  (first-line-dedent rescue — fails via the missing variant) while (c)
  (exact-match byte-exactness) and (d) (canonical not-found) held.
- **GREEN:** both defects fixed — `tryMatchOldStr` carries the rescued
  `replaceContent` and `processStrReplace` writes it
  (`process-str-replace.ts`); `withFirstLineIndent` + two first-line
  scan loops (spaces 1..12, tabs 1..6, indent mirrored onto the
  replacement) added to `generate-diffs-prompt.ts`. The
  whitespace-collapsed position rescue is documented as
  newString-verbatim (no indent info to mirror).
- **Gates:** post-fix — process-str-replace suite 15/15, helper suite
  6/6 (21/21 aggregate, 61 expect() calls); typecheck agent-runtime
  exit 0; eslint `--max-warnings 0` clean; prettier clean on all three
  touched files.
- **AUDIT (Verifier):** pending — spawned after the implementation
  commit.

### Missed Questions

1. *Could wiring `replaceContent` change existing rescued edits?* Yes —
   that is the fix: today those edits land under-indented content
   (Defect A). No currently-green behavior changes: exact matches never
   reach the rescue; ambiguity and allowMultiple return before it.
2. *Why fix the matcher if the root is emission-side?* Both. FID-008
   addresses the generator; the matcher is the runtime's last line of
   defense and is genuinely defective independent of the root — the
   discard bug corrupts files on every uniform-indent rescue today.
3. *Why not normalize the file content to the oldString instead?* The
   rescue already maps the oldString toward the file; mirroring the same
   transform onto the replacement preserves the model's indent INTENT —
   re-indenting the landed content from the file's whitespace-stripped
   form would discard that intent.
4. *First-line-only scan bounds?* Same bounds as the uniform loops
   (12 spaces / 6 tabs) — the observed quirk is a small-delta class;
   deeper corruption falls to the existing whitespace-collapsed last
   resort, unchanged.
5. *Does pin (c) risk brittle coupling to the discard bug?* No — it pins
   byte-exactness for exact matches, which holds today and must survive
   the fix.

## Resolution

> Implementation landed 2026-09-10 (Loop 2 above). Commit SHA recorded
> in the closure commit message; audit outcome in Loop 2 once complete.

## Lessons Learned

> Captured at closure. Preview: a rescue path that computes a corrected
> output must actually deliver it — dead output is silent corruption;
> and emission quirks have shape (first-line-only, uniform) — rescues must
> cover the shapes actually observed, not just the uniform hypothetical.