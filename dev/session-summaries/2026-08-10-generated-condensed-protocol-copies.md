<!-- markdownlint-disable MD013 -->

# Session Summary: 2026-08-10 — Generated Condensed Protocol Copies (FID-2026-0810-003)

**Session ID:** 2026-08-10-generated-condensed-protocol-copies
**Duration:** 2026-08-10 — FID-2026-0810-003 implementation + closeout
**Status:** complete

**Governing protocol:** ECHO v0.2.0 harness (`ECHO.md`, `harness.protocol` in
`protocol.config.yaml`). The single-agent document
(`dev/echo-v0.1.2-single-agent.md`) is the protocol of a third-party harness the
operator uses when building outside savant-code; it does not govern this session
and is NOT part of the savant-code product. The harness contains zero
single-agent references by design (verified by sweep).

---

## Initial State

- **OS:** Windows (win32), bash shell
- **Branch:** `main` (uncommitted working tree; 0.0.23 pending, unreleased)
- **Version:** `0.0.23` (pending — `VERSION` + manifests aligned)
- **Backlog:** zero active FIDs; this session created and closed
  FID-2026-0810-003 (follow-up to FID-2026-0810-002).

## Session Objective

Implement FID-2026-0810-003: replace the two hand-maintained condensed protocol
copies (`ECHO_PROTOCOL_INSTRUCTIONS` in `common/src/constants/agents.ts` and the
15-turn refresh in `packages/agent-runtime/src/echo/protocol-summary.ts`) with
**generated output** so every embedded protocol copy shares one source of truth
(`ECHO.md` for canonical facts + the generator's curated-directive table for
condensed wording, bridged by fail-fast validation).

## What Happened

1. **FID-2026-0810-003** was created as a planning FID. Perfection Loop Loops
   1–2 mapped the canonical ECHO.md content (15 laws, FSM states, circuit
   breakers, five questions, FID lifecycle/authoring rules, anti-patterns) and
   confirmed two facts: FSM phase gating + session directives have **no ECHO.md
   home** (harness-runtime framing), and the no-signature policy is harness
   framing, not ECHO.md text.
2. **Loop 3 (adversarial AUDIT)** returned 14 concrete corrections — including
   that the source-of-truth model must be stated precisely (ECHO.md for
   titles/structure + generator table for wording, NOT "ECHO.md → copies"), that
   the docs mirror `docs/echo-protocol.md` is out of scope, and that parity must
   compare **decoded** string values (the `\u2014` escape pitfall). All 14 were
   folded in; the FID converged and was presented.
3. **Operator approved** the converged plan ("Approve — implement now") under
   automation level 3.
4. **Implementation** (todo-tracked, 9 steps):
   - **Change 1 — `scripts/protocol-copies.ts`:** ECHO.md fact extraction with
     fail-fast validation against the actual table shapes. Two real parser bugs
     were found and fixed during development: a blank line between the law-table
     headings and tables broke the row scan (skip leading blanks), and the
     numbered-list scanner stopped at continuation lines (scan to next heading).
     Laws 5–15's third column is `Why`, not `Directive` — key-phrase validation
     uses title+directive across both schemas.
   - **Change 2 — `scripts/generate-protocol-bundle.ts`:** emits
     `echo-protocol-instructions.generated.ts` (full view) and
     `protocol-refresh.generated.ts` (compact view); content assertions + the
     harness-boundary sweep retargeted to the generated files; byte-level drift
     check covers all four generated modules. Fixed a rewrite regression that
     dropped `readFileSafe`.
   - **Change 3 — runtime wiring:** `agents.ts` re-exports
     `ECHO_PROTOCOL_INSTRUCTIONS` from the generated module (hand-written array
     replaced via a careful head-preserving rebuild script — the shell-quoting
     first attempt was abandoned after inspection confirmed the file was
     untouched); `protocol-summary.ts` imports `PROTOCOL_REFRESH_CONTENT`.
     Public API unchanged.
   - **Change 4 — tests:** `scripts/__tests__/protocol-copies.test.ts` (15
     assertions); existing `agents.test.ts` parity phrases green against the
     generated constant; `savant-strict.test.ts` unchanged and green.
   - **Change 5 — verification:** token budget on decoded values — instructions
     8,866 → 9,067 (+2.3%), refresh 2,026 → 2,075 (+2.4%), within ±5%
     (FID-018 trims preserved); typecheck × 4; full suites green; ESLint
     `--max-warnings 0`; markdownlint; Prettier; `validate:repository` PASS;
     protocol-bundle drift check clean; agents bundle regenerated.
5. **Tracking/closeout:** CHANGELOG entry added after the FID-002 entry; FID
   marked closed with an Implementation Record; session summary written;
   LEARNINGS.md entry added.

## Key Decisions (operator)

- **Source-of-truth model:** `ECHO.md` for canonical titles/structure; the
  generator's curated-directive table for condensed wording, fail-fast validated
  against ECHO.md — the copies can never disagree because they render from the
  same facts.
- **Harness framing stays in the generator:** phase gating, session directives,
  no-signature policy, and double-audit wording have no ECHO.md home and are
  hosted once in `FRAMING` constants.
- **Docs mirror out of scope:** `docs/echo-protocol.md` is documentation, not
  embedded runtime content; not generated, not drifted.
- **Generated files are committed** (like `protocol-bundle.generated.ts`) so the
  shipped package and the drift gate stay deterministic.

## Verification Evidence

- `bun test scripts/__tests__/protocol-copies.test.ts` → 15/15 green
- `cd common && bun test src/__tests__/agents.test.ts` → green (6 parity phrases)
- Token budget (decoded values): instructions +2.3%, refresh +2.4% (±5% bound)
- Typecheck × 4 (sdk, common, agent-runtime, cli) → exit 0
- Full suites: agent-runtime 769, common 563, sdk 460, cli 2,938, scripts 36
- `bun x eslint . --max-warnings 0` → clean
- `bun run lint:md` → clean; Prettier check → clean
- `bun run validate:repository` → PASS
- `bun run generate:protocol-bundle:check` → clean (drift)
- `bun --cwd cli scripts/prebuild-agents.ts` → bundle regenerated; 14 new
  instructions occurrences; zero single-agent references in harness-injected
  context

## Files Touched

- New: `scripts/protocol-copies.ts`,
  `scripts/__tests__/protocol-copies.test.ts`,
  `common/src/constants/echo-protocol-instructions.generated.ts` (generated),
  `packages/agent-runtime/src/echo/protocol-refresh.generated.ts` (generated),
  `dev/session-summaries/2026-08-10-generated-condensed-protocol-copies.md`
- Modified: `scripts/generate-protocol-bundle.ts`,
  `common/src/constants/agents.ts`,
  `packages/agent-runtime/src/echo/protocol-summary.ts`,
  `cli/src/agents/bundled-agents.generated.ts` (regenerated),
  `CHANGELOG.md`, `dev/LEARNINGS.md`,
  `dev/fids/archive/FID-2026-0810-003-generated-condensed-protocol-copies.md`

## Lessons Learned

Generated content is only trustworthy when the generator fails fast on the
source's real shape. Two parsing assumptions (no blank line after a table
heading; no continuation lines in numbered lists) were wrong for ECHO.md and
were caught by direct probes before the first clean run — every extractor was
verified against the actual file, not the intended one. And parity measurement
must operate on the **decoded** runtime values (escaped unicode, joined arrays),
not raw source characters, or token-budget and content checks silently mislead.
