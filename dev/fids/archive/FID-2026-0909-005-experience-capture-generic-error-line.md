# FID: Experience-capture ledger records a generic error line — the self-improving loop is colorblind

**Filename:** `FID-2026-0909-005-experience-capture-generic-error-line.md`
**ID:** FID-2026-0909-005
**Severity:** medium
**Status:** closed
**Created:** 2026-09-09 16:00
**YAGNI-Compliance:** PASS (one helper beside its sibling checker; no new machinery)

---

## Summary

Every record in the experience ledger (`dev/experiences/raw-traces.jsonl`, 36/36)
carries the same generic `errorFirstLine` — `"tool result contains an error"` —
because the soft-failure hook site hardcodes that string instead of surfacing
the real error text that is already in scope. The self-improving harness's
dedup key is `sha256(toolName + NUL + normalizedErrorFirstLine)`, so with a
constant error line every failure of a tool collapses into one bucket: the
recurrence counter, the learning agenda, and FID routing all fire on tool name
alone, blind to the error class. The flagship "Savant learns from its own
failures" loop mechanically captures every failure but cannot tell them
apart.

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** savant-code v0.0.30 tree
- **Commit/State:** working tree 2026-09-09, post `4b03e9b` (FID-2026-0909-004)

## Detailed Description

### Problem

The success-path result lifecycle fires `PostToolUseFailure` for tool results
that carry an error, passing a hardcoded message:

```text
packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:244
  ...(failed ? { errorMessage: 'tool result contains an error' } : {}),
```

The real error text sits in `toolResult.content` — which the same call already
passes to `buildHookInput` as `toolResult`. The information exists at the
exact call site; it is simply never extracted into `error_message`, the only
field the capture sink reads.

Downstream, `buildExperienceRecord` (hooks/experience-capture.ts) normalizes
`error_message` into `errorFirstLine`, and `experienceDedupKey`
(`common/src/util/experiences.ts`) groups records by
`sha256(toolName + NUL + normalizedFirstLine)`. With the constant line, the
key degenerates to the tool name.

### Expected Behavior

A soft-failed tool result's ledger record carries the real first error line
(e.g. `oldString not found in file...`, `HTTP 404`, `File exceeds read
limit...`) so the dedup key groups by (tool, error class), the recurrence
threshold counts distinct failure modes, and the agenda promotes real
patterns.

### Root Cause

The soft-failure branch of `runSuccessLifecycle` reuses the checker's boolean
(`hasToolResultError`) as if it were the error itself. There is no extractor
for the structured error fields the checker detects
(`errorMessage`/`error`/`errorCode`), so the author of the hook wiring
reached for the only string available — a placeholder that shipped.

### Evidence

```text
# The hardcode (sole production site — repo-wide grep over packages/, common/,
# cli/, scripts/, sdk/, agents/ returns exactly this one line):
packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:244

# The ledger — every record degraded (verified 2026-09-09):
$ grep -c "tool result contains an error" dev/experiences/raw-traces.jsonl
36
$ wc -l dev/experiences/raw-traces.jsonl
36
# Distribution: str_replace 14 · read_url 8 · code_search 5 · skill_manage 3 ·
#   run_readonly_command 3 · run_terminal_command 2 · write_file 1

# The agenda — items keyed on the generic line, not an error class:
dev/agenda.md — "read_url — tool result contains an error (recurrences: 8)",
  "code_search (5)", "str_replace (5)" — three distinct failure families
  invisible behind one label

# The checker whose fields are never extracted:
packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts
  — hasToolResultError: errorMessage | error | errorCode, all string+nonEmpty

# The rejection path does it right (0/36 records came through it):
result-lifecycle.ts runRejectionLifecycle — errorMessage = error.message

# Live recurrence while authoring this FID: a spawned Thinker died with
# "Native tool-call recovery failed repeatedly ... (tool: write_file)" —
# the exact truncation-class failure the LESSONS entry
# recovery-steers-not-just-retries documents, and exactly the class a
# properly-classified ledger would surface for promotion.
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:244`
  (the hardcode)
- `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.ts`
  (extractor home — Law 13, beside its sibling checker)
- `dev/experiences/raw-traces.jsonl` (all future records)
- `dev/agenda.md` + `scripts/experiences-dedup.ts` (consumers of the key)
- `scripts/session-end-review.ts` (:74,83 — agenda items render the line),
  `scripts/lessons-to-skills.ts` (:108,133 — draft skill names + trigger
  text are built FROM the line), `scripts/evolve-skills.ts` (:108,133,155 —
  same): the degraded line propagates into auto-drafted skill identity
- New suite: `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts`
  (co-located flat convention — `execution-policy.test.ts` beside
  `execution-policy.ts` in the same directory)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded — the capture/recurrence/promotion pipeline
      runs but produces misleading groups; the promotion threshold fires on
      tool name instead of error class
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Extract the real error beside the checker that already detects it, and pass
it at the one hardcode site. **`extractToolResultError(content)`** in
`tool-result-errors.ts` (Law 13: same module, one error-shape contract, both
consumers): iterate content parts in array order, first error-carrying part
wins, within a part `errorMessage` > `error` > `errorCode` (mirroring the
checker's own field order — deterministic precedence means stable dedup
keys). At `result-lifecycle.ts:244`, pass
`extractToolResultError(toolResult.content) || 'tool result contains an
error'` — the generic line survives only as the fallback when a failed result
carries no extractable field (shape drift), never as the common case.

No normalization at the extraction site: `buildExperienceRecord`'s
`normalizeErrorFirstLine` (first line, ANSI strip, path normalization,
whitespace collapse, 500-char cap) is the single normalization point by its
own contract comment — raw string in, one truth out.

**The 36 historical records stay untouched.** The ledger is append-only by
contract and the real error text is unrecoverable anyway (`contextHash`
stores sha256 of the tool *input*, never the error). They remain one legacy
bucket labeled with the generic line — an honest historical artifact of this
defect. New records group by (tool, error class) from the moment the fix
lands; `experienceDedupKey` normalizes defensively at read time, so any new
record whose real line happens to normalize identically to an old one still
merges.

`runRejectionLifecycle` needs no change — it already passes `error.message`,
and 0/36 records came through that path.

### Steps

1. Add `extractToolResultError(content: unknown): string` to
   `tool-result-errors.ts` (pure, no I/O; returns `''` for non-error content).
2. RED-first: create
   `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts`
   (co-located beside the module, matching `execution-policy.test.ts`) pinning
   — multi-part precedence (first error part wins), multi-field precedence
   (`errorMessage` > `error` > `errorCode`), non-error content → `''`, and the
   fallback at the lifecycle site (a failed result with no extractable field
   still records the generic line).
3. GREEN: wire the extractor into `result-lifecycle.ts:244` with the generic
   line as fallback only.
4. Update `docs/self-improving-harness.md` §2.1 only if its record example
   implies the generic line (it does not — the doc already shows a real
   error; no doc change expected; verify at GREEN).
5. Close per ceremony: receipt (`fid:verify --write`), status, archive move,
   CHANGELOG, path-scoped commit (G1–G4, G8).

### Verification

RED-first suite run before wiring (extraction pins fail against the unfixed
lifecycle until step 3); then typecheck agent-runtime, the new suite +
`experience-capture.test.ts` green, eslint/prettier on touched files; live
confirmation boundary: the next natural soft-failure in a real session
appends a record whose `errorFirstLine` is a real error line — an
operator-observable live check, never claimed from unit runs alone.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts

### Verification Receipt

- fingerprint: sha256:4a8896f7836f5fddbe9da2fd24e1eb47c0f22a018a646d41037cd3097d564109
- verified: 2026-09-09T23:15:40.595Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN (2026-09-09)

- **RED:** Evidence chain cataloged fresh this turn — the hardcode
  (result-lifecycle.ts:244, sole production site by repo-wide grep);
  36/36 degraded records (count + distribution verified this turn); the
  agenda's three generic-line items; the checker's unextracted fields; the
  rejection path's correct behavior (0/36). Root cause named: the boolean
  checker was reused as if it were the error.
- **GREEN (design, converged):** the extractor + one-line wiring described
  above. Design questions resolved from code evidence: (1) deterministic
  precedence — first error part, then errorMessage > error > errorCode,
  mirroring the checker's field order so keys stay stable; (2) no
  double-normalization — the capture layer's shared helper is the single
  normalization point by contract; (3) legacy records left as one honest
  bucket (append-only contract; raw text unrecoverable); (4) zero other
  consumers of the literal (repo-wide grep; `error_message` reaches only
  the capture sink — no external PostToolUseFailure hooks declared); (5)
  pin home is a new focused suite per the `__tests__` convention,
  experience-capture.test.ts unchanged; (6) rejection path needs no drift
  fix. Thinker delegation for this pass was attempted and failed on a
  native tool-call truncation (recovery exhausted) — resolved by the
  Orchestrator from complete 0-EOF evidence instead of re-rolling the
  oversized spawn (lesson: recovery-steers-not-just-retries).
- **AUDIT (Verifier, 2026-09-09):** 8 PASS / 2 NEEDS-REVIEW / 1 ADJUSTED —
  loop-passed as a planning record, ready for operator implementation
  approval. Both NEEDS-REVIEWs discharged immediately after the verdict
  with pasted output: (a) sole-site claim re-verified — the repo-wide grep
  output is now quoted in Evidence verbatim (exactly one production match);
  (b) consumer sweep run — `session-end-review.ts` (:38,58,74,83),
  `lessons-to-skills.ts` (:103,138,165,175,200,206), `evolve-skills.ts`
  (:38,108,133,155,195,237) ALL consume `errorFirstLine`; the last two
  build auto-drafted skill names and trigger text FROM the line
  (`slugify("${toolName}-${errorFirstLine}")` at lessons-to-skills.ts:108)
  — the blast radius is larger than the record first stated, and the new
  Affected Components rows capture it. The ADJUSTED verdict (test-path
  convention) applied: the declared suite moved to the co-located
  `tools/tool-executor/tool-result-errors.test.ts` (the directory's own
  `execution-policy.test.ts` precedent, confirmed by directory listing).
  The record makes no implementation claims and its evidence chain is
  internally consistent per the Verifier.
- **ADVERSARIAL (self-refutation):** strongest objection — "the fix is
  cosmetic: recurrence-by-tool-name already works, and error lines are
  unstable strings (paths, counts) that fragment groups the wrong way."
  Refuted: the instability claim is exactly what
  `normalizeErrorFirstLine` already handles (path normalization,
  whitespace collapse, first-line, 500-char cap) — the shared helper exists
  because the repo already learned this class (FID-2026-0823-009); and
  recurrence-by-tool-name is not "working": the ≥3-in-14-days threshold was
  designed to promote error CLASSES (docs/self-improving-harness.md §2.2:
  "Expected-failure noise (e.g. broad-search 404s) never counts"), which is
  impossible when every line is identical. Second objection — "backfill the
  36 records from contextHash." Refuted: the hash covers tool INPUT, not
  the error; the text is gone. The legacy bucket is the honest record.
- **CHANGE DELTA:** n/a (initial record).

### Loop 2 — IMPLEMENTATION (2026-09-09, operator-approved: last session's directive + this session's confirmation)

- **RED (suite-first):** the co-located suite ran against the unfixed
  lifecycle — 10 pass / 1 fail, the failing pin exactly the wiring
  defect: `Expected: "HTTP 404: no results" / Received: "tool result
  contains an error"` at the ledger assertion. Extractor pins and the
  mirror invariant passed from the start (pure functions, no wiring).
- **GREEN:** `extractToolResultError` added to tool-result-errors.ts
  mirroring the checker exactly; wired at result-lifecycle.ts:247
  through a new `toolResultErrorLine(content)` helper. Two deltas
  beyond the Loop-1 spec, both forced by mechanical gates and audited
  by the Verifier: (1) **`toolResultErrorLine`** centralizes the
  generic fallback beside the extractor (Law 13 — the literal's single
  truth; makes the fallback pin non-vacuous) after the inline form
  pushed result-lifecycle.ts past the 300-line quality ceiling;
  (2) **suite split** — the single declared suite reached 388 lines
  against the same ceiling, so the lifecycle end-to-end pins moved to
  `result-lifecycle.test.ts` beside their subject module (the
  directory's co-location convention); the split suite's gate line is
  declared above. Baseline ratchet: tool-result-errors.ts 23 → 75
  (the quality-report count; `wc -l` reads 74 — the known
  trailing-newline off-by-one class, FID-2026-0907-010).
- **AUDIT (Verifier, implementation):** 8 PASS / 1 NEEDS-REVIEW —
  verdict **SHIP**. PASSes evidence-cited: mirror exactness, fallback
  reachability (unreachable while the mirror holds; engages on drift),
  wiring at :247 with the JSONValue cast intact, rejection path
  untouched (two surgical replacements only), non-tautological pins
  (RED leg proved sensitivity), Law-6-clean (test casts follow the
  tool-executor-sandbox.test.ts fixture convention), honest baseline,
  no regressions (full agent-runtime 1358/0 across 234 files), Law 4
  call-graph (one production consumer: result-lifecycle.ts:1 + :247,
  the runSuccessLifecycle hot path). The NEEDS-REVIEW was this
  closure edit itself — the two deltas documented here are the
  discharge. One doc-precision nit applied: the corpus tripwire
  comment no longer claims to catch future checker-field drift (a
  new checker field needs a matching corpus entry and extractor
  branch — stated in the suite header).
- **ADVERSARIAL (self-refutation of the deltas):** "`toolResultErrorLine`
  is unrequested abstraction" — refuted: it owns the fallback literal
  (previously inline at the call site), is the only way the fallback
  behavior is pinned non-vacuously, and kept the hot-path file under
  the ceiling; YAGNI-Compliance stands (one helper beside its sibling,
  zero new machinery). "The split violates the declared gate path" —
  refuted: the split suite's gate line is declared and live-runs in
  the receipt; the alternative (one 388-line suite) fails a hard
  quality gate.
- **Live-boundary honesty:** the ledger still holds exactly the 36
  legacy records — this session's own tool failures were pre-dispatch
  gate halts (EHEL Law-1/Law-3 blocks, native.ts:97) which never reach
  the result lifecycle and so never append records. The live
  confirmation boundary stands open: the next natural handler
  soft-failure appends the first real-line record.
- **CHANGE DELTA:** +`toolResultErrorLine` helper; suite split with
  added gate line; baseline 23→75; suite-header comment precision.

### Missed Questions

1. *Multiple error parts/fields — which wins?* First error-carrying part in
   array order; within a part `errorMessage` > `error` > `errorCode`. Both
   mirror the checker's existing semantics — extraction can never disagree
   with detection.
2. *Normalize at extraction?* No — `buildExperienceRecord`'s
   `normalizeErrorFirstLine` is the single normalization point (its contract
   comment: the capture path and the analysis path must agree through shared
   helpers). Raw string passes through one truth.
3. *The 36 legacy records?* Untouched — append-only contract, text
   unrecoverable, one honest legacy bucket. New records group correctly from
   landing day.
4. *Other consumers of the literal string?* None — repo-wide grep returns
   exactly one production site; no external PostToolUseFailure hooks are
   declared; the string never renders user-facing.
5. *Pin home?* Co-located flat suite at
   `packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts`
   — the directory's own convention (`execution-policy.test.ts` beside
   `execution-policy.ts`); `experience-capture.test.ts` already covers
   record-building from hook input and needs no change. *(Corrected at
   audit: the record first declared the top-level `src/__tests__/` path;
   the Verifier's ADJUSTED verdict pointed at the co-located sibling
   convention, confirmed by directory listing.)*
6. *Rejection-path drift?* None — it already passes real errors and
   contributed 0/36 records.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `abe4d6a` (code + suites + baseline; governance
      closure follows) — preceded by `cd3a027` (this FID's authoring +
      the FID-0909-004 closure records, drained from the dead session).
- [x] **File:line ranges:** `tool-result-errors.ts` (extractor +
      `toolResultErrorLine`, 75 report-lines); `result-lifecycle.ts:1`
      (import) + `:243-249` (the failed-branch wiring);
      `tool-result-errors.test.ts` (163 lines, 12 tests);
      `result-lifecycle.test.ts` (261 lines, 2 end-to-end pins);
      `dev/quality-baseline.json` (tool-result-errors.ts 23→75).
- [x] **Gate output:** receipt below (`fid:verify --write`, archived
      path); full agent-runtime 1358/0 across 234 files; eslint
      `--max-warnings 0` clean; prettier clean; `quality:report` PASS
      (1467 files); `lint:md` PASS.
- [x] **Reproducibility:** RED leg — revert `:247` to the hardcoded
      literal and run `result-lifecycle.test.ts`: the real-line pin
      fails with the exact quote in Loop 2. GREEN — as committed,
      14/0 across the two suites.
- [x] **Step statuses:** Steps 1-3 + 5 complete; Step 4 (doc check)
      verified — `docs/self-improving-harness.md` shows a real error
      in its record example (grep for the generic literal: no hits),
      no doc change needed.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (two audited
      deltas documented in Loop 2)
- [x] Typecheck/tests/lint pass with pasted tool output (receipt below)
- [x] Production call-graph evidence is present for new or repaired
      wiring (`result-lifecycle.ts:247` — the runSuccessLifecycle hot
      path, exercised by the 1358-test full suite)
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-09-09
- **Fix Description:** `extractToolResultError` + `toolResultErrorLine`
  in `tool-result-errors.ts` extract the real first error line from
  failed tool results; `result-lifecycle.ts:247` passes it as the
  PostToolUseFailure `errorMessage`, with the generic line demoted to
  a shape-drift fallback. New ledger records group by
  (tool, error class) from commit `abe4d6a` forward; the dedup key,
  agenda promotion, and auto-drafted skill naming all become
  error-class-aware.
- **Tests Added:** `tool-result-errors.test.ts` (12: extractor
  pins, detection/extraction mirror invariant over a 22-shape corpus,
  fallback pins) + `result-lifecycle.test.ts` (2: end-to-end ledger
  record via a real hook engine at a temp capture root; success
  records nothing).
- **Verification Evidence:** receipt below; RED 10/1 → GREEN 14/0;
  full agent-runtime 1358/0; typecheck/eslint/prettier/
  quality:report/lint:md all clean.
- **Archived:** 2026-09-09 (`dev/fids/archive/`)

## Lessons Learned

A boolean checker and its data live in different worlds: `hasToolResultError`
answers "is this an error?", and reusing it as the error's *content* shipped
a placeholder that silently degraded every downstream signal. When a
detection helper exists, ask where its extraction sibling is — if the
boolean has no string-returning twin in the same module, every consumer will
improvise, and the improvisation becomes the record. The self-improving
loop's most important input is the one field nobody extracts.