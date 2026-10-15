<!-- markdownlint-disable MD013 -->

# FID: Generated Condensed Protocol Copies — Single Source of Truth (ECHO.md → ECHO_PROTOCOL_INSTRUCTIONS + protocol-summary)

**Filename:** `FID-2026-0810-003-generated-condensed-protocol-copies.md`
**ID:** FID-2026-0810-003
**Severity:** medium
**Status:** closed
**Created:** 2026-08-10
**YAGNI-Compliance:** Verified

> **Scope:** Follow-up to FID-2026-0810-002 Change 6, whose Missed-Question 9 recorded:
> *"Should the condensed `ECHO_PROTOCOL_INSTRUCTIONS` and the 15-turn refresh summary also be
> generated? → Follow-up candidate. The full-protocol bundle closes the primary drift risk;
> converting the condensed copies to generated output is noted in Change 6 as future work so
> they share the same source of truth."* This FID delivers that follow-up: both hand-maintained
> condensed copies become **generated output** from one canonical source, so they cannot drift
> from each other or from `ECHO.md`.
>
> **Scope precision (Loop 3 correction):** the source-of-truth model is precisely
> "`ECHO.md` for canonical titles/structure + the generator's curated-directive table for
> condensed wording, bridged by fail-fast validation" — NOT "`ECHO.md` → copies" for wording.
> `ECHO.md` edits to law titles/order, FSM state names, the five questions, circuit-breaker
> titles, lifecycle stages, and authoring-rule phrases flow through regeneration automatically;
> condensed *wording* edits require a generator-table edit (fail-fast validated against
> `ECHO.md`). The docs mirror `docs/echo-protocol.md` is explicitly OUT of scope (documentation,
> not embedded runtime content).

---

## Summary

Two condensed protocol copies are currently **hand-written and structurally duplicated**:

1. `ECHO_PROTOCOL_INSTRUCTIONS` — `common/src/constants/agents.ts:109-246`, a ~140-line
   hand-maintained array joined with `\n`, injected into 5 prompt sites
   (`agents/savant/prompts.ts:53,144,172,205` + `agents/thinker/thinker.ts:95`) and baked into
   the shipped `cli/src/agents/bundled-agents.generated.ts`.
2. `buildProtocolRefreshSummary()` — `packages/agent-runtime/src/echo/protocol-summary.ts:31-72`,
   a ~500-token condensed refresh re-injected every 15 turns (Layer 2 of the session-init
   grounding architecture from FID-2026-0810-002).

Both paraphrase the same canonical `ECHO.md` content — but in **different wording** (e.g. the
refresh says `1. Read 0-EOF before touch — no exceptions, no skimming` while the instructions
say `1. **Read 0-EOF Before Touch** — Every file read completely before any edit. No
exceptions.`) and **different structure** (tables vs. one-liners). FID-2026-0810-002 proved the
drift is real: `protocol-summary.ts` had a stale signing instruction and two hard-coded
single-agent references that no longer exist in `ECHO.md`. Today's only guard is the cheap
substring-sync assertion inside `generate-protocol-bundle.ts:132-161`, which catches *gross*
drift after the fact but does not make the copies share content.

The fix makes `ECHO.md` the single source of truth for the canonical protocol facts (the 15
laws, FSM states, circuit breakers, five questions, FID lifecycle/authoring rules, anti-pattern
core) and generates **both** condensed copies from one canonical data table + renderers, with
the harness-runtime framing (phase gating, session directives, no-signature policy, double-audit
wording) hosted as static sections **in the generator only**. Editing `ECHO.md` law titles,
FSM states, or the five questions flows through regeneration; the two copies can never disagree
because they render from the same facts; the byte-level drift check (already wired into
`validate:repository` and pre-push via `generate:protocol-bundle:check`) now covers the
generated copies too.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript strict monorepo; Bun 1.3.14
- **Branch:** `main` (uncommitted working tree; 0.0.23 pending, unreleased)
- **Version:** `0.0.23` (pending)
- **Boot contract:** harness variant → `ECHO.md` v0.2.0 strict

## Detailed Description

### Problem

**A. The two condensed copies have already drifted from ECHO.md and from each other.**

- `protocol-summary.ts:26-27` carried a stale signing instruction ("Sign all authored documents
  as Savant only") that contradicts the operator's no-signature policy — until FID-2026-0810-002
  Change 6 purged it.
- `protocol-summary.ts:26` and `:58` carried the only two hard-coded single-agent references in
  harness-injected context (purged by Change 6).
- The two copies phrase the same laws differently (see examples above), so a law renamed in
  `ECHO.md` would require **two manual edits in two files with different wording** — a
  duplication trap.

**B. The only current guard is a substring check, not content sharing.**
`generate-protocol-bundle.ts:132-161` asserts `ECHO.md` headings (`## The 15 Laws`,
`## Perfection Loop FSM`) and phrases ("Perfection Loop FSM", "read 0-eof") exist in the two
condensed copies. It catches a law section vanishing, but cannot prevent:

- wording drift (title typo in one copy),
- structural divergence (one copy drops a rule),
- duplicate-edit burden (any `ECHO.md` fact change needs two manual edits).

**C. Token discipline (FID-018) makes verbatim-extraction unsafe.**
The instructions constant is injected into every agent's system prompt; the refresh is injected
every 15 turns. Blindly embedding whole `ECHO.md` sections would balloon prompt tokens and undo
the FID-018 trims. The condensed copies must stay condensed — which is why they were
hand-written in the first place. The fix must preserve the condensed budget while killing the
drift.

### Expected Behavior

- `ECHO.md` is the **single source of truth** for canonical protocol facts.
- Both `ECHO_PROTOCOL_INSTRUCTIONS` and the 15-turn refresh content are **generated outputs**
  (files marked `GENERATED — DO NOT EDIT`), rendered from one canonical data table that is
  **validated against `ECHO.md`** at generation time.
- The two copies can never disagree: same facts, two renderers (full view for instructions,
  compact view for the refresh).
- Editing `ECHO.md` (law title/order, FSM state names, five questions, circuit-breaker titles,
  lifecycle stages) → regenerate → both copies update; the drift check fails validation if the
  generated files are stale.
- The harness-runtime framing that has **no `ECHO.md` home** (FSM phase-gating tables, transition
  rules, when-to-skip-RED, session directives, no-signature policy, "Double audit (harness)"
  wording, condensed anti-pattern subset) lives **once, in the generator** as static template
  sections — not in the runtime files.
- Public surface unchanged: `ECHO_PROTOCOL_INSTRUCTIONS` remains importable from
  `@savant-code/common/constants/agents`; `protocol-summary.ts` keeps exporting
  `ECHO_CRITICAL_SENTINEL`, `PROTOCOL_REFRESH_INTERVAL`, `isCriticalContextText`, and
  `buildProtocolRefreshSummary()` with identical signatures.
- Token budget: generated instructions ≈ today's size (±5%); generated refresh ≈ today's size.

### Root Cause

- `ECHO_PROTOCOL_INSTRUCTIONS` is authored by hand as a string array
  (`common/src/constants/agents.ts:109-246`), with no reference to `ECHO.md`.
- `buildProtocolRefreshSummary` returns a hand-written template literal
  (`packages/agent-runtime/src/echo/protocol-summary.ts:31-72`), with no reference to `ECHO.md`.
- FID-2026-0810-002 Change 1 generated the **full-file** bundle
  (`protocol-bundle.generated.ts`) but explicitly left the **condensed** copies as a follow-up
  (Missed Question 9).

### Evidence

- `common/src/constants/agents.ts:109-246` — hand-maintained `ECHO_PROTOCOL_INSTRUCTIONS` array.
- `packages/agent-runtime/src/echo/protocol-summary.ts:31-72` — hand-written refresh template.
- `scripts/generate-protocol-bundle.ts:132-161` — substring-sync assertions (the only guard).
- `ECHO.md:145-172` — canonical `### Laws 1-4` / `### Laws 5-15` tables (titles + directives).
- `ECHO.md:193-206` — `## The Five Questions`.
- `ECHO.md:248-294` — `## Perfection Loop FSM` (ASCII diagram, `### State Transitions`,
  `### Circuit Breaker Rules`).
- `ECHO.md:455-496` — `## FID Lifecycle` (`### FID Authoring Rules`).
- `ECHO.md:587-605` — `## Anti-Patterns` table (13 rows; the condensed copy keeps a subset).
- `ECHO.md:398` — "One problem at a time" (Working Style); `ECHO.md:618` — Honest Assessment;
  `ECHO.md:651` — Emergency Procedures.
- **No ECHO.md anchors for:** FSM Phase Gating tool-access tables / transition rules /
  when-to-skip-RED (`grep -niE 'phase-gated|idle|transition_phase' ECHO.md` → only line 66, the
  roster table, mentions "phase-gated"); the no-signature policy (`grep -niE 'signature|signing'
  ECHO.md` → zero hits); "Double audit" appears only as the Hybrid-Mode section at `ECHO.md:376`.
- Consumers: `agents/savant/prompts.ts:1,53,144,172,205`, `agents/thinker/thinker.ts:1,95`
  (import `ECHO_PROTOCOL_INSTRUCTIONS`); `packages/agent-runtime/src/echo/enforcement.ts:11` +
  `packages/agent-runtime/src/context-compactor/phases.ts:1` (import from `./protocol-summary`).
- Tests: `common/src/__tests__/agents.test.ts:3-14` asserts 6 phrases in
  `ECHO_PROTOCOL_INSTRUCTIONS`; `agents/__tests__/savant-strict.test.ts:25` asserts
  "full ECHO Perfection Loop"; no test references `buildProtocolRefreshSummary` directly
  (grep → zero hits in `*.test.ts`).
- Drift wiring already present: `package.json:34-35`
  (`generate:protocol-bundle` / `generate:protocol-bundle:check`), `.githooks/pre-push:61-64`,
  `scripts/validate-repository.ts` (protocol checks).

### Impact Assessment

- Without the fix, every future `ECHO.md` law/FSM change requires two hand edits with different
  wording, and the copies can silently diverge (the exact bug class FID-2026-0810-002 proved
  real).
- The change is self-contained: no runtime behavior change (the rendered text is kept
  equivalent), no public API change, no new dependencies (reuses the existing generator +
  prettier path).
- The risk is in **content parity**: the generated output must reproduce today's shipped text
  (or a deliberate, reviewed delta) so prompts and the refresh behave identically.

#### Affected Components

- `scripts/generate-protocol-bundle.ts` — extended: canonical-fact extraction + validation +
  two new renderers + two new generated outputs; `--check` covers all four outputs
  (full bundle + instructions + refresh).
- `common/src/constants/echo-protocol-instructions.generated.ts` (new) — generated
  `ECHO_PROTOCOL_INSTRUCTIONS` string.
- `common/src/constants/agents.ts` — array replaced by re-export from the generated module
  (public import path unchanged).
- `packages/agent-runtime/src/echo/protocol-refresh.generated.ts` (new) — generated refresh
  content string.
- `packages/agent-runtime/src/echo/protocol-summary.ts` — refresh body replaced by import of the
  generated content; sentinel/interval/`isCriticalContextText`/function signature unchanged.
- `cli/src/agents/bundled-agents.generated.ts` — regenerated (embeds the updated prompts).
- Tests: `common/src/__tests__/agents.test.ts` (phrase assertions kept, verified against
  generated output), new generator unit tests for extraction/validation, new parity test
  (generated output ↔ rendered equivalence).
- Docs/tracking: CHANGELOG, LEARNINGS, session summary.

#### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: content-generation refactor with a parity requirement (shipped prompt text must
  not silently change); mitigated by a byte-level drift check and a parity test.
- [ ] Low

## Proposed Solution

### Approach

**One canonical data table + validated extraction + two renderers.**

**Change 1 — Canonical fact extraction from ECHO.md (robust parser).** The generator parses
`ECHO.md` into a canonical facts object, fail-fast when anchors are missing:

- `laws`: parsed from the `### Laws 1-4` and `### Laws 5-15` tables (number, title, directive),
  with the condensed directive kept from a **canonical directive table in the generator**
  (today's curated wording, preserved so tokens and text stay stable) and **validated** against
  the `ECHO.md` row (title must match exactly; directive must contain a key phrase from the
  `ECHO.md` row, e.g. Law 1 → "Every file read completely before any edit").
  **Parser hardening (Loop 3):** (1) normalize every cell before comparing — strip `**`
  markers, trim, collapse whitespace — the "title must match exactly" check fails against
  condensed text otherwise; (2) branch on the **header row**, not row-width guessing: the
  Laws 1-4 table is 4-column (with Enforcement), the Laws 5-15 table is 3-column (with Why);
  (3) stop each table slice at the **end of the table** (next non-table line), never by slicing
  to the next `##` heading — the `#### Law 13: Utility-First, Universal Logic` subsection at
  `ECHO.md:173` sits immediately after the Laws 5-15 table and would be swallowed.
- `fsmStates`: state names in order from the `### State Transitions` table
  (RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE).
- `circuitBreakers`: rule titles from `### Circuit Breaker Rules`.
- `fiveQuestions`: the five questions verbatim from `## The Five Questions`.
- `fidLifecycle`: the stage names from `## FID Lifecycle` (`Created → Analyzed → Fixed →
  Verified → Closed → Archived`) — the stages live in a **fenced code block**, so extraction
  must be code-fence-aware (scan the ``` ```text ``` fence between `## FID Lifecycle` and
  `### When to Create a FID`), not a table parse (Loop 3).
- `fidAuthoringRules`: canonical rule phrases from `### FID Authoring Rules` (Recorder-only,
  `dev/fids/` location, filename format, template, status values).
- `antiPatterns`: the condensed subset (today's 8 entries) validated to each exist in the
  `## Anti-Patterns` table (title match, on normalized titles — bold markers stripped, trailing
  pipe trimmed).

**Change 2 — Harness framing hosted in the generator (static).** Sections with no `ECHO.md`
home move into the generator as typed template sections, authored **once**: header/version line,
"bound by the ECHO Protocol" intro, Perfection Loop FSM condensed diagram + optimization
shortcuts, Circuit Breaker summaries, FID lifecycle paragraph, FSM Phase Gating (phases/tool
access table, transition rules, when-to-skip-RED, self-correct optimization), anti-pattern
wording, session directives, double-audit (harness) wording, and the no-signature policy line.
These are the generator's `FRAMING` constants — the single place to edit them.

**Change 3 — Two renderers, one facts object.**

- `renderInstructions(facts, framing)` → the full `ECHO_PROTOCOL_INSTRUCTIONS` text (today's
  structure: header, 15 laws, FSM, circuit breakers, five questions, FID authoring, anti-patterns,
  phase gating).
- `renderRefresh(facts, framing)` → the compact refresh (sentinel + governing-law line + laws
  one-liners + FSM one-line + lifecycle one-line + double-audit + session directives).

**Change 4 — Generated outputs + re-exports.**

- Emit `common/src/constants/echo-protocol-instructions.generated.ts`:
  `export const ECHO_PROTOCOL_INSTRUCTIONS: string = <JSON.stringify(rendered)>` (JSON-string
  escaping avoids the template-literal backtick landmine from LEARNINGS).
- Emit `packages/agent-runtime/src/echo/protocol-refresh.generated.ts`:
  `export const PROTOCOL_REFRESH_CONTENT: string = <JSON.stringify(renderedRefreshBody)>`.
- `agents.ts`: `export { ECHO_PROTOCOL_INSTRUCTIONS } from
  './echo-protocol-instructions.generated'` (removes the inline array; import path unchanged).
- `protocol-summary.ts`: `import { PROTOCOL_REFRESH_CONTENT } from
  './protocol-refresh.generated'`; `buildProtocolRefreshSummary()` returns
  `` `${ECHO_CRITICAL_SENTINEL}\n${PROTOCOL_REFRESH_CONTENT}` `` — signature and other exports
  unchanged.

**Change 5 — Drift check covers all outputs.** `generate:protocol-bundle --check` byte-compares
all four generated outputs (full bundle + instructions + refresh) and re-runs the ECHO.md-fact
validation. The existing wiring (`validate:repository`, pre-push) needs no new scripts — the
check command already gates them. Prettier formatting of all generated files (same explicit
`.prettierrc` resolution as today).

**Change 5a — Retarget the existing content assertions (Loop 3).** `runContentAssertions`
currently substring-checks `common/src/constants/agents.ts` — after the change that file only
re-exports, so the checks must point at the **generated instructions module** (or the
renderer output). The `single[ _-]?agent` harness-boundary sweep and `boundaryFiles` list must
also add the **two new generated files** (`echo-protocol-instructions.generated.ts`,
`protocol-refresh.generated.ts`) — they become harness-injected content and stay in the
zero-reference gate.

**Change 6 — Tests.**

- Keep/extend `common/src/__tests__/agents.test.ts` phrase assertions (they must pass against
  the generated output — proving parity).
- New generator test surface: extraction fails on missing anchors; law-title validation catches
  a title typo (with `**` markers intact — normalized comparison); both renderers emit today's
  phrases; a **parity test** imports the generated modules and compares **decoded string
  values** (not file bytes) for the phrases the old hand-written copies contained — the
  instructions array today uses `\u2014` escapes while `JSON.stringify` emits literal `—`, so a
  byte-diff would false-fail; the byte-level drift check and the decoded-value parity test are
  complementary, not conflicting (Loop 3).
- **Parity-oracle accuracy (Loop 3):** "full ECHO Perfection Loop" is asserted in
  `agents/__tests__/savant-strict.test.ts:25` against the STRICT agent's `instructionsPrompt` —
  a separate prompt string, NOT a substring of `ECHO_PROTOCOL_INSTRUCTIONS`. It is **dropped**
  from this FID's parity list; only the six `agents.test.ts` phrases are the constant's parity
  oracle.
- Token-budget check: the generator test asserts the rendered instructions/refresh are within
  ±5% of the current joined-array / template-literal **character counts** (baseline recorded in
  the test), giving the Verification step a measurable definition (Loop 3).
- `packages/agent-runtime` echo tests remain green (sentinel/interval untouched; the refresh
  renderer composes `ECHO_CRITICAL_SENTINEL + '\n' + content` so `isCriticalContextText` keeps
  matching — Loop 3).
- Regenerate `cli/src/agents/bundled-agents.generated.ts` via `prebuild:agents`.

**Explicit non-goals (operator-recorded):** the single-agent document
(`dev/echo-v0.1.2-single-agent.md`) stays out — third-party harness protocol, never bundled,
zero references in harness-injected context (FID-2026-0810-002 gate preserved). The full-file
bundle (`protocol-bundle.generated.ts`) is untouched by this FID. `ECHO.md` itself is not
edited. No new dependencies.

### Steps

1. Confirm operator approval to implement (planning-only until then).
2. Extend `scripts/generate-protocol-bundle.ts`: ECHO.md fact extraction + validation; FRAMING
   constants; `renderInstructions` + `renderRefresh`; emit the two new generated modules.
3. `common/src/constants/agents.ts` → re-export from generated module.
4. `packages/agent-runtime/src/echo/protocol-summary.ts` → import generated refresh content.
5. Update `common/src/__tests__/agents.test.ts` if needed; add generator unit tests + parity
   test; keep echo tests green.
6. Regenerate: `bun run generate:protocol-bundle` (+ `--check`), `prebuild:agents` from `cli/`.
7. Full validation: typecheck (common, agent-runtime, cli, sdk), full suites, ESLint,
   markdownlint, Prettier, `validate:repository`, `generate:protocol-bundle:check`.
8. Docs/tracking: CHANGELOG under 0.0.23, LEARNINGS entry, session summary, FID closure +
   archive.

### Verification

- `bun run generate:protocol-bundle` → emits all four outputs; re-run is byte-identical
  (idempotent).
- `bun run generate:protocol-bundle --check` → PASS; after touching `ECHO.md` (or a generated
  file) → FAIL with actionable message.
- Extraction validation: rename a law title in a scratch copy of `ECHO.md` → generator fails
  with the exact mismatch. (Tested via unit test, not by mutating the real ECHO.md.)
- Parity: generated `ECHO_PROTOCOL_INSTRUCTIONS` contains all 6 phrases from
  `agents.test.ts` ("## FID Authoring Rules", "dev/fids/", "FID-YYYY-MMDD-NNN",
  "templates/FID-TEMPLATE.md", "Only the Recorder",
  "created | analyzed | fixed | verified | closed"); refresh content contains the no-signature
  line, laws 1-15, FSM, lifecycle, double-audit, session directives. ("full ECHO Perfection
  Loop" is NOT a parity oracle — it belongs to the STRICT agent's own instructionsPrompt.)
- Token budget: instructions ≈ today's joined-array character count (±5%); refresh ≈ today's
  template-literal count (±5%), measured by the generator test (Loop 3).
- Public surface: imports of `ECHO_PROTOCOL_INSTRUCTIONS` from `@savant-code/common/constants/agents`
  unchanged; `protocol-summary.ts` exports unchanged.
- Full gate: typecheck × 4, full suites (common, agent-runtime, cli), ESLint `--max-warnings 0`,
  markdownlint, Prettier, `validate:repository`, drift check.
- Harness-boundary: `grep -rniE 'single[ _-]?agent'` over harness-injected context still
  zero — including the two NEW generated files (Loop 3).

## Perfection Loop

### Loop 1 — RED

- **RED:** Both condensed copies are hand-written duplicates of `ECHO.md` content with
  different wording and structure; FID-2026-0810-002 proved real drift (stale signing,
  single-agent references) that the substring-sync assertions could not prevent in time; every
  `ECHO.md` fact change requires two manual edits in two files.
- **GREEN:** Generate both copies from one canonical facts table extracted from and validated
  against `ECHO.md`, with harness framing hosted once in the generator; re-export/import so the
  public surface is unchanged; keep the byte-level drift check; preserve the token budget.
- **AUDIT:** All evidence verified in-tree (see Evidence). Consumers and tests inventoried.
  No conflicting intent found in FID-018 (token trims are preserved) or FID-2026-0810-002
  (this is its explicitly-recorded follow-up). The no-signature/single-agent boundaries are
  preserved. Existing tests give a ready parity oracle (`agents.test.ts` phrases).
- **CHANGE DELTA:** Pure FID (planning document). No code written.

### Loop 2 — AUDIT (2026-08-10, independent review)

- **AUDIT METHOD 1 (static analysis):** file:line claims re-verified in-tree:
  `agents.ts:109-246` (array), `protocol-summary.ts:31-72` (template),
  `generate-protocol-bundle.ts:132-161` (substring guard), `prompts.ts:53,144,172,205` +
  `thinker.ts:95` (injection), `enforcement.ts:11` + `context-compactor/phases.ts:1`
  (sentinel imports), `agents.test.ts:3-14` (phrase oracle), `package.json:34-35` +
  `.githooks/pre-push:61-64` (drift wiring). All ✅.
- **AUDIT METHOD 2 (adversarial checks):**
  1. **Will the generated text silently change shipped prompts?** — Mitigated by a parity
     test (the 6 `agents.test.ts` phrases + "full ECHO Perfection Loop") and a token-budget
     check; any intended delta must be reviewed and recorded.
  2. **Is parsing ECHO.md markdown tables brittle?** — Yes if we parse for *content*; we parse
     only for *titles/state names/questions* (simple `| **N** | **Title** |` row shapes) and
     validate against the canonical directive table; a table-format change in ECHO.md fails
     fast with an actionable message (generator unit test covers a missing-anchor case).
  3. **Does this break the FID-018 token trims?** — No: the canonical directive table
     preserves today's wording; the framing sections move verbatim into the generator.
  4. **Does the SDK or single-agent path touch these constants?** — No: the constants are
     harness-product prompt/refresh content; the single-agent variant is untouched.
  5. **Is JSON-string escaping safe?** — Yes: `JSON.stringify` output in a `.generated.ts`
     avoids the backtick/template-literal landmine recorded in LEARNINGS (FID-018 noted
     array-join for the same reason); `\n`/quotes/em-dashes all round-trip.
- **AUDIT VERDICT: PASS with corrections** (corrections folded in above: parity test added,
  table-format brittleness documented + unit-tested, token-budget check added to Verification).

### Loop 3 — AUDIT of parser robustness + boundary completeness (2026-08-10, adversarial)

- **RED:** Independent review re-inspected the actual `ECHO.md` table shapes and the consumer
  surface, and flagged 14 concrete gaps:
  1. **Bold-marker normalization** — law/state cells are `**1**`, `**RED**`, `**Read 0-EOF
     Before Touch**`; "title must match exactly" fails against condensed text unless `**` is
     stripped and whitespace collapsed *first*.
  2. **Two law tables, different schemas** — Laws 1-4 is 4-column (with Enforcement), Laws
     5-15 is 3-column (with Why); branch on the header row, never row-width guessing.
  3. **`#### Law 13` subsection at `ECHO.md:173`** sits immediately after the Laws 5-15 table;
     slicing to the next `##` heading would swallow it — stop at end-of-table.
  4. **FID lifecycle stages are in a fenced code block, not a table** — extraction must be
     code-fence-aware.
  5. **Anti-patterns validation** must use normalized titles (bold stripped, trailing pipe
     trimmed).
  6. **`runContentAssertions` must retarget** from `common/src/constants/agents.ts` (becomes a
     re-export) to the generated instructions module / renderer output.
  7. **The `single[ _-]?agent` sweep + `boundaryFiles` must add the two NEW generated files.**
  8. **"full ECHO Perfection Loop" is NOT a substring of `ECHO_PROTOCOL_INSTRUCTIONS`** — it
     belongs to the STRICT agent's separate `instructionsPrompt`; using it as a parity oracle
     would force unwanted text into the generated constant. Dropped from the oracle.
  9. **`docs/echo-protocol.md`** is a third protocol mirror — declared explicitly out of scope
     (docs, not embedded runtime content).
  10. **Token-budget check needs a measurable definition** — character counts (±5%) with the
      baseline recorded in the generator test.
  11. No-signature boundary correctly framed ✓ (zero `signature` hits in `ECHO.md`).
  12. **Escape normalization in the parity test** — the instructions array uses `\u2014`
      escapes; `JSON.stringify` emits literal `—`; compare decoded string values, not bytes.
  13. **Honesty about the source-of-truth model** — wording is authored in the generator's
      curated table validated against `ECHO.md`; the header now states the precise model.
  14. **Refresh sentinel composition** — the renderer must reproduce
      `ECHO_CRITICAL_SENTINEL + '\n' + content` so `isCriticalContextText` keeps matching.
- **GREEN:** All 14 folded into the FID: parser hardening + normalization (Change 1),
  code-fence-aware lifecycle extraction (Change 1), retargeted content assertions + sweep
  extension (Change 5a), corrected parity oracle + decoded-value parity + token-budget
  definition (Change 6), scope-precision header note, and refresh composition requirement.
- **AUDIT VERDICT: PASS with corrections.** The architecture is unchanged and sound; the
  corrections harden the parser, close the boundary sweep, and make parity/token checks
  measurable. The FID is ready for operator approval to implement.

### Missed Questions

1. **Should the whole instructions text move into the generated file, or only the facts?** →
   The whole rendered text is generated (facts + framing composed in the generator). The
   runtime files only re-export/import. That is what makes the copies single-sourced.
2. **What if ECHO.md gains a new law or state?** — Extraction adds it; the canonical directive
   table must gain a matching entry or the validation fails (fail-fast) — forcing the author
   to update both the table and, implicitly, the copies in one place.
3. **Should the five questions be extracted verbatim?** — Yes; they are identical in both
   copies today and exist verbatim in ECHO.md:193-206.
4. **Where do the phase-gating tables live?** — In the generator's `FRAMING` constants (no
   ECHO.md home; they describe the runtime EHEL tool gating, which is enforced in
   `packages/agent-runtime`). They remain single-authored in one file.
5. **Does the refresh's sentinel stay in protocol-summary.ts?** — Yes;
   `ECHO_CRITICAL_SENTINEL`/`PROTOCOL_REFRESH_INTERVAL`/`isCriticalContextText` are code, not
   protocol content; they stay in the hand-written file.
6. **Is a new script needed?** — No; `generate-protocol-bundle.ts` already owns protocol
   generation and its `--check` is already wired into pre-push and `validate:repository`.
   Extending it avoids a second drift gate to wire.
7. **Who edits the canonical directive table when ECHO.md law wording changes?** — The operator
   (or the implementing agent under automation), in the generator; the validation catches the
   mismatch so it cannot be forgotten.
8. **Should the generated files be committed?** — Yes (like `protocol-bundle.generated.ts`),
   so the shipped package and the drift gate are deterministic; they are regenerated and
   byte-checked.

## Code Verification Evidence

- [x] `agents.ts:109-246` — hand-maintained instructions array (read 0-EOF)
- [x] `protocol-summary.ts:31-72` — hand-written refresh template (read 0-EOF)
- [x] `generate-protocol-bundle.ts:132-161` — substring-sync guard (read)
- [x] `ECHO.md:145-172` — canonical law tables (titles + directives)
- [x] `ECHO.md:193-206` — five questions verbatim
- [x] `ECHO.md:248-294` — FSM diagram + State Transitions + Circuit Breaker Rules
- [x] `ECHO.md:455-496` — FID Lifecycle + Authoring Rules
- [x] `ECHO.md:587-605` — Anti-Patterns table
- [x] Consumers/tests inventoried (prompts, thinker, enforcement, phases, agents.test,
  savant-strict.test, package.json, pre-push, validate-repository)

## Resolution

- **Status:** closed (implemented 2026-08-10 under automation level 3; operator approved
  the converged plan, then granted implementation)
- **Related:** Follow-up to FID-2026-0810-002 (Change 6, Missed Question 9)

## Implementation Record

**Change 1 — Core generator module** `scripts/protocol-copies.ts`: ECHO.md fact extraction
(15 laws from the two law tables, 6 FSM states, 7 circuit-breaker rules, 5 questions,
lifecycle stages, anti-pattern titles) with fail-fast validation against ECHO.md's actual
table shapes (blank-line-tolerant table scan, code-fence-aware lifecycle parsing,
header-row filtering); `FRAMING` constants for the harness-runtime-only content (phase
gating, session directives, no-signature policy, double-audit wording); two renderers
`renderInstructions` (full view) and `renderRefresh` (compact 15-turn view).

**Change 2 — Generator extension** `scripts/generate-protocol-bundle.ts`: emits
`common/src/constants/echo-protocol-instructions.generated.ts` and
`packages/agent-runtime/src/echo/protocol-refresh.generated.ts`; content assertions and
the harness-boundary sweep retargeted to the generated files; byte-level drift check
(`generate:protocol-bundle:check`) now covers all four generated modules.

**Change 3 — Runtime wiring:** `common/src/constants/agents.ts` re-exports
`ECHO_PROTOCOL_INSTRUCTIONS` from the generated module (hand-written array removed);
`packages/agent-runtime/src/echo/protocol-summary.ts` imports `PROTOCOL_REFRESH_CONTENT`
from the generated refresh module. Public API unchanged; sentinel/interval logic stays in
the hand-written file.

**Change 4 — Tests:** new `scripts/__tests__/protocol-copies.test.ts` (15 assertions:
extraction, validation, renderers, parity); existing `agents.test.ts` passes against the
generated constant (all 6 parity phrases green); `savant-strict.test.ts` unchanged and
green.

**Change 5 — Verification:** token budget measured on decoded values — instructions
8,866 → 9,067 (+2.3%), refresh 2,026 → 2,075 (+2.4%), both within ±5% (FID-018 trims
preserved); typecheck × 4 (sdk, common, agent-runtime, cli); full suites green
(agent-runtime 769, common 563, sdk 460, cli 2,938, scripts 36); ESLint `--max-warnings
0`; markdownlint; Prettier clean; `validate:repository` PASS; protocol-bundle drift
check clean; agents bundle regenerated (`cli/scripts/prebuild-agents.ts`) with 14 new
instructions occurrences and **zero** single-agent references.

> FID closed and archived to `dev/fids/archive/` 2026-08-10 after the operator approved
> the converged plan (Perfection Loop Loops 1–3: RED → AUDIT with 14 corrections folded
> into Loop 3 → approval).