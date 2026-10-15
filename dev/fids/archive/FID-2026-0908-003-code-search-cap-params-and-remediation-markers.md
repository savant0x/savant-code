# FID: code_search cap parameters in the tool schema + self-remedying truncation markers

**Filename:** `FID-2026-0908-003-code-search-cap-params-and-remediation-markers.md`
**ID:** FID-2026-0908-003
**Severity:** low
**Status:** closed
**Created:** 2026-09-08
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0806-005 (the code_search tool), FID-2026-0824-026
(the evidence-spill precedent this design draws on), SCOPE.md Task 23 T23-A
(the A-Z audit whose Detective sweep surfaced the truncation live)

---

## Summary

`code_search` truncates evidence sweeps through three layered caps — per-file
`maxResults` (15), `globalMaxResults` (250), `maxOutputStringLength` (20,000
chars) — but only `maxResults` is exposed in the tool schema; the other two
are executor-internal, and the run-layer wiring for them already exists dead
(`sdk/src/run/tool-call.ts` reads both from tool input that the params schema
never declares, so zod silently strips them). The truncation markers state the
cap values but not HOW to continue. During the 2026-09-08 A-Z audit, the
Detective's evidence sweep hit the 20,000-char output cap at 102 matches
(ripgrep killed early; tail verified benign by manual re-query). This FID
exposes `globalMaxResults` + `maxOutputStringLength` as optional tool-schema
parameters and makes every truncation marker self-remedying: it names the cap
that fired and the exact remedy (narrow the query first, or raise the specific
cap via the new schema parameter).

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree at v0.0.30 prep (uncommitted); automation
  level 3
- **Evidence (all read 0-EOF 2026-09-08):**
  - Live defect: Detective sweep output carried "[Output size limit
    reached.]" + "Stopped early after 102 match(es)." + "Results limited to
    20 per file" (SCOPE T23-A)
  - `sdk/src/tools/code-search/executor.ts:27-29` — defaults `maxResults =
    15`, `globalMaxResults = 250`, `maxOutputStringLength = 20_000`
  - `sdk/src/tools/code-search/match-collector.ts` — streaming early-stop:
    `matchesGlobal >= globalMaxResults || estimatedOutputLen >=
    maxOutputStringLength` → kill ripgrep
  - `sdk/src/tools/code-search/format.ts:50-53,95` — markers name the cap
    but carry no remedy
  - `sdk/src/run/tool-call.ts:199-210` — `codeSearch()` already receives
    `globalMaxResults` + `maxOutputStringLength` from tool input via
    `getOptionalNumber` (dead wiring: the params schema never declares them)
  - `common/src/tools/params/tool/code-search.ts:27-37` — only `maxResults`
    declared; the description's RESULT LIMITING section hardcodes "250"

## Detailed Description

### Problem

A model cannot size its own sweeps: passing `globalMaxResults` or
`maxOutputStringLength` today is silently stripped by the zod schema (object
default mode is strip, not reject — the worst failure shape, since the model
believes the cap was raised). Evidence-heavy sweeps (audit-style multi-pattern
greps) die at 20,000 chars regardless, and the truncation markers are
dead-ends: they name the cap but give no continuation path.

### Expected Behavior

- The schema declares both caps as optional integers with bounded ceilings and
  executor-matching defaults; parsed values flow through the existing
  `tool-call.ts` wiring into `codeSearch()`.
- Every truncation marker is self-remedying: it names the cap that fired with
  its value and the remedy — narrow the search first (pattern, `cwd`, `-g`
  globs), or raise the specific cap via the named parameter.

### Root Cause

The executor grew the two defensive caps; the tool-schema surface was never
widened, and `tool-call.ts` was wired in anticipation — leaving dead wiring
plus silent schema stripping.

## Impact Assessment

### Affected Components

- `common/src/tools/params/tool/code-search.ts` (schema + description)
- `sdk/src/tools/code-search/format.ts` (marker text only — the three
  builder functions; no behavior change)
- `sdk/src/__tests__/code-search-caps-markers.test.ts` (NEW — the pins)
- Not affected: `executor.ts` / `match-collector.ts` (caps already flow);
  `tool-call.ts` (already wired); default behavior (schema defaults equal
  executor defaults — identical tool behavior unless the model passes
  explicit values)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Low: additive optional tool parameters with bounded ceilings; marker
  text only on the truncation paths; defaults preserve byte-identical
  behavior for existing callers
- [ ] Low

## Proposed Solution

### Approach

1. **Schema exposure** (`common/src/tools/params/tool/code-search.ts`):
   `globalMaxResults` (int, positive, ≤ 5000, optional, default 250) and
   `maxOutputStringLength` (int, positive, ≤ 200000, optional, default
   20000). Update the `maxResults` describe and the description's RESULT
   LIMITING section (both currently hardcode "250"); add one example showing
   an audit-sized sweep.
2. **Self-remedying markers** (`sdk/src/tools/code-search/format.ts`):
   - `buildLimitedOutput` size-cap reason → "[Output size limit reached (cap
     N chars). Re-run with a narrower pattern, cwd, or -g globs; or pass
     maxOutputStringLength to raise this cap.]"; global-cap reason →
     "[Global limit of N results reached. Re-run with a narrower pattern,
     cwd, or -g globs; or pass globalMaxResults to raise this cap.]"
   - `buildCloseOutput`: `killedForLimit` message same remedy; per-file
     message → "Results limited to N per file (pass maxResults to raise).
     Truncated files: ..."
3. **No executor/collector changes** — the caps already flow; defaults are
   unchanged.

### Steps

1. [x] **RED:** `sdk/src/__tests__/code-search-caps-markers.test.ts` — pins:
   (a) schema parse applies defaults (250 / 20000); (b) schema echoes
   explicit values; (c) schema rejects zero/negative/non-int caps; (d)
   `buildLimitedOutput` size-cap marker names the cap + the
   `maxOutputStringLength` remedy; (e) global-cap marker names the
   `globalMaxResults` remedy; (f) `buildCloseOutput` per-file + global
   messages carry their remedies. **Done 2026-09-08** — RED confirmed:
   6 fail / 0 pass (8 expect calls) — every schema pin failed on the
   silent strip (`globalMaxResults` absent from parsed output), every
   marker pin failed on the dead-end text.
2. [x] **GREEN:** the schema + marker changes per the Approach. **Done
   2026-09-08** — `code-search.ts` gains both cap params (int, positive,
   ceilings 5000 / 200000, executor-matching defaults, updated describes +
   RESULT LIMITING + one audit-sized example); `format.ts` gains the
   self-remedying marker text in `buildLimitedOutput` (both branches) and
   `buildCloseOutput` (per-file + killedForLimit). The sibling pin
   `code-search-part-c.test.ts:149` (`includes('Output size limit')`)
   holds — the marker keeps its prefix.
3. [x] **VERIFY:** **Done 2026-09-08** — typecheck sdk/common/agent-runtime/
   cli all exit 0; new suite 6/0 (19 expects) + code-search-part-a..d
   suites 37/0 (114 expects) across the five files; eslint
   `--max-warnings 0` on all three touched files; prettier clean (post
   `--write`); quality PASS after one honest baseline bump
   (`common/src/tools/params/tool/code-search.ts` 145 → 174 — the schema
   additions; `format.ts` measured 125 vs baseline 126, no bump needed).

### Verification

Gates below run green with a stamped receipt. The schema pins cover the
silent-strip defect; the marker pins cover the dead-end defect; the existing
part-a..d suites cover behavioral parity for default callers.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: test sdk/src/__tests__/code-search-caps-markers.test.ts

### Verification Receipt

- fingerprint: sha256:c3ea8f7b855943590140f0a652fd1dfb3f844e35f8d3fc7ef838cd6193c90af1
- verified: 2026-09-09T03:58:52.241Z
- typecheck sdk: exit 0
- typecheck common: exit 0
- test sdk/src/__tests__/code-search-caps-markers.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the truncation observed live in the A-Z audit (SCOPE T23-A); the
  schema gap (only `maxResults` declared — `code-search.ts:27-37`); the dead
  run-layer wiring (`tool-call.ts:199-210` reads keys the schema strips);
  markers as dead-ends (`format.ts:50-53,95`).
- **GREEN:** schema exposure + self-remedying markers per the Approach.
- **ADVERSARIAL pre-check:** "Why not just raise the defaults?" → the
  defaults protect the parent context (20KB is the compaction budget's
  friend); the fix is agent-sized caps + remedy text, not silent inflation.
  "Why expose caps at all — isn't narrowing enough?" → narrowing is the
  PRIMARY remedy and the markers now say so first; raising is the
  audited-sweep escape hatch (the A-Z audit needed three manual compensating
  queries because the caps were unreachable). "Schema bloat?" → two optional
  ints with hard ceilings (5000 / 200000), one added example.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Does the zod schema strip unknown keys today?* → Yes (zod v4 object
   default is strip): a model passing `globalMaxResults` today is silently
   ignored. After this FID they parse — the silent strip is the worst part
   of the current shape and is what the pins guard.
2. *Do defaults change behavior?* → No: schema defaults equal executor
   defaults (250 / 20_000); the tool behaves identically unless the model
   passes explicit values.
3. *Marker length bloat?* → Each remedy adds one clause; markers appear only
   on truncation paths.

### Loop 2 — IMPLEMENTATION (2026-09-08)

- **RED (pasted):** `bun test src/__tests__/code-search-caps-markers.test.ts`
  (cwd sdk) → **6 fail / 0 pass, 8 expect() calls** — schema pins failed
  because zod stripped the undeclared cap keys; marker pins failed on the
  old dead-end text (e.g. received
  `[Global limit of 250 results reached.]` with no remedy clause).
- **GREEN (pasted):** same suite → **6 pass / 0 fail, 19 expect() calls**;
  combined battery with code-search-part-a..d → **37 pass / 0 fail, 114
  expect() calls across 5 files**; typecheck sdk + common + agent-runtime
  + cli all exit 0; eslint `--max-warnings 0` ×3 files; prettier clean.
- **Baseline:** `common/src/tools/params/tool/code-search.ts` 145 → 174
  (honest measured bump; the two cap params + describe text). `format.ts`
  125 (baseline 126 — decreased, untouched).
- **CHANGE DELTA:** <10% of the FID (evidence + status fields only).

### Loop 3 — Independent Verifier audit (2026-09-08)

- **AUDIT verdict: no FAILs** — 5 PASS + 2 NEEDS-REVIEW, both discharged
  post-audit with fresh tool evidence:
  1. *"Only missing surface" claim* → grep confirms
     `sdk/src/run/tool-call.ts:205-208` reads both caps via
     `getOptionalNumber`, and `grep -rn "codeSearch("` across
     agent-runtime/cli/common returns zero other call sites — the schema
     was the sole contract gap.
  2. *killedForLimit attribution* → `match-collector.ts:84` sets the flag
     only inside the streaming cap-kill check (global results OR output
     size), never on ripgrep error/timeout paths — the close message's
     combined "or" hedge is factually safe.
- **CHANGE DELTA:** <10% (this audit record only).

## Implementation Evidence

- `common/src/tools/params/tool/code-search.ts` (174 ln post-bump):
  `globalMaxResults` + `maxOutputStringLength` declared (int, positive,
  `.max(5000)` / `.max(200000)`, optional, defaults 250 / 20000);
  `maxResults` describe now cross-references the related caps; RESULT
  LIMITING section lists all three caps with ceilings + the remedy
  sentence; one new example shows an audit-sized sweep
  (`globalMaxResults: 1000, maxOutputStringLength: 50000`).
- `sdk/src/tools/code-search/format.ts` (125 ln): `buildLimitedOutput`
  size-cap branch → `"[Output size limit reached (cap N chars). Re-run
  with a narrower pattern, cwd, or -g globs; or pass
  maxOutputStringLength to raise this cap.]"`; global-cap branch → the
  mirrored `globalMaxResults` remedy; `buildCloseOutput` per-file →
  `"Results limited to N per file (pass maxResults to raise)."` and
  killedForLimit → the combined global/size remedy naming both params.
- `sdk/src/__tests__/code-search-caps-markers.test.ts` (NEW, 82 ln): six
  pins — defaults, echo, rejection bounds (0 / negative / non-int /
  over-ceiling), and the three marker texts.
- Behavior parity: schema defaults equal executor defaults, so default
  callers are byte-identical (proven by part-a..d remaining green).
- Law 4 reachability: the params flow through the pre-existing
  `sdk/src/run/tool-call.ts:199-210` wiring (read 0-EOF) — no new call
sites needed; the zod silent-strip defect is what the pins guard.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`code-search.ts` 174 ln
      post-bump; `format.ts` 125 ln; `code-search-caps-markers.test.ts` NEW
      82 ln)
- [x] Implementation matches the Proposed Solution (schema exposure +
      self-remedying marker text; executor/collector/`tool-call.ts`
      untouched as scoped)
- [x] Typecheck/tests/lint pass with pasted tool output (RED 6-fail pasted;
      GREEN 6/0 + 37/0 across five suites pasted; typecheck ×4 exit 0;
      eslint `--max-warnings 0` ×3 files; prettier clean)
- [x] Production call-graph evidence: the params flow through the
      pre-existing `sdk/src/run/tool-call.ts:199-210` wiring (read 0-EOF;
      no new call sites needed — the schema was the missing contract surface)
- [x] FID status reflects the actual implementation state (`fixed`)
- [x] Hygiene gate fix (verify-step discovery): the example patterns in
      `code-search.ts` carried literal `TODO`/`FIXME` tokens which trip the
      production-placeholder scan — both examples re-patterned
      (`'deprecated'` / `'deprecated|legacy'`); no behavioral surface
      touched (examples are model-facing documentation only)

## Resolution

- Implemented 2026-09-08 (status `fixed`): a model can now size its own
  sweeps through declared, bounded schema parameters, and every truncation
  marker is self-remedying — it names the cap that fired with its value and
  the remedy (narrow first, or raise the named parameter). The silent-strip
  failure shape is structurally guarded by the echo + rejection pins. The
  live A-Z-audit scenario (the 20,000-char sweep) is now recoverable in one
  re-query by passing `maxOutputStringLength`/`globalMaxResults` instead of
  three manual compensating queries.
- **Archived:** 2026-09-08 — moved to `dev/fids/archive/` per the operator
  closure directive; receipt re-stamped at the archived path with all
  declared gates re-run.

## Lessons Learned

- Dead wiring is a smell in both directions: `tool-call.ts` reading input
  keys the params schema never declared meant the transport was built but
  the contract surface was not — zod strip mode made the gap invisible
  (no error, just silently ignored parameters).
- Truncation markers should be self-remedying: name the cap that fired,
  its value, and BOTH remedies (narrow the query; raise the named cap).
  A marker that only states the fact is a dead end for the consuming
  model.
- The quality counter counts one line more than `wc -l` for this file
  (174 vs 173) — baseline entries must use the quality counter's value,
  not `wc`.