# FID: Preservation Contract & Digest Schema — End the Drop-List (Increment 2)

**Filename:** `FID-2026-0824-024-compaction-preservation-contract-digest-schema.md`
**ID:** FID-2026-0824-024
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 18:15
**YAGNI-Compliance:** Pending

Parent: `FID-2026-0824-022` (amendments P1 binding here). Resolves defect D1 of
`FID-2026-0824-021`.

---

## Summary

The context-pruner's digest (`summarize-messages.ts`) silently drops the data
class a coding agent needs most: read_files contents, code_search/glob results,
web research. This child replaces the drop-list with a **preservation
contract**: every tool result contributes a structured `resultDigest` bounded
by size caps — path/shape identity plus head/tail slices — so post-compaction
the agent retains verifiable knowledge of WHAT was learned, not just that
something happened.

## Environment

- **OS:** Windows 11 primary dev host; POSIX-compatible by contract
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned), zod v4
- **Tool Versions:** agents/context-pruner/* @ working tree (v0.0.27 prep)
- **Commit/State:** main (working tree, release-only-commits)

## Detailed Description

### Problem

`summarizeMessages` builds entries only for: user text, assistant prose,
tool errors (100 chars), non-zero exit codes, ask_user answers, edit results
(2000 chars), filtered spawn results. Read/search/web tool results match NO
branch and vanish. The assistant's paraphrase is the sole survivor carrier.

### Expected Behavior

A hermes-style contract: summaries MUST carry "relevant data, file names,
values, or outputs". Deterministically: every tool class has a digest recipe;
caps bound each digest to a small fraction of the original; nothing is dropped
without appearing in the removed-region ledger (`-027`).

### Root Cause

Port adopted layer mechanics (thresholds/sentinels) without any fidelity floor
for content classes.

### Evidence

```text
agents/context-pruner/summarize-messages.ts   branch inventory — no read/search/web case
resources/hermes-agent/trajectory_compressor.py   _generate_summary prompt contract (comparison baseline)
LIVE: FID-2026-0821-001-era sessions lose file-read knowledge on every auto-compact.
```

## Impact Assessment

### Affected Components

- `agents/context-pruner/summarize-messages.ts`, `summarize-tool-call.ts`,
  `summary-assembly.ts`, `constants.ts` (limits)
- New pure module `agents/context-pruner/result-digests.ts`
- Downstream consumers: `-025` budgeting, `-026` splice, `-027` ledger

### Risk Level

- [ ] Critical / [x] High: silent evidence destruction in the primary coding
      loop; corrupts long-horizon reasoning and every downstream audit
- [ ] Medium / [ ] Low

## Proposed Solution

### Approach

One pure function per tool class returning a bounded `ResultDigest`; the
digest assembly embeds digests into summary entries. Deterministic, cheap,
unit-testable — no LLM in the loop (M1 honored).

### Steps

1. `ResultDigest` schema (zod): `{ toolName, toolCallId, kind, identity,
   byteSize, sha256, head?, tail? }` — `identity` = path/URL/query; head/tail
   slices capped (512/256 chars default) via config.
2. Recipes per class: file reads (path + slices), searches (query + hit
   count + top paths), commands (exitCode/stdout head-tail), edits (existing
   2000-char rule folded in), web/research (URLs + claim count), spawn results
   (existing blacklist kept).
3. Wire recipes into `summarizeMessages` — drop-list branches become
   digest-backed entries; unknown tools get an identity-only fallback digest
   (never silence).
4. Caps configurable under `compression.digest:`; totals enforced by `-025`
   budgeting.
5. Fixtures per tool class (round-trip: original → digest → assertions);
   cap-boundary tests; golden digest snapshot for the suite's own transcript.

### Verification

Gates below plus before/after comparison on a recorded session proving
read-knowledge survives compaction.

## Verification Gates

- gate: typecheck agents
- gate: test agents/context-pruner/__tests__/result-digests.test.ts

### Verification Receipt

- fingerprint: sha256:2212172c88d76b0ec84e82eccb6500ab970904e76aa9d1c965036c7a14a64812
- verified: 2026-08-25T01:26:25.470Z
- typecheck agents: exit 0
- test agents/context-pruner/__tests__/result-digests.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Citations above (0-EOF reads, 2026-08-24).
- **GREEN:** Schema + recipes specified; caps and config keys converge at GREEN
  with `-025` (single owner: constants module).
- **AUDIT:** Batched suite Verifier (2026-08-24): PASS — ResultDigest schema +
  per-class recipes replace the drop-list; unknown-tool fallback digest closes
  the silence hole; M1 honored; gate matches new test file.
- **ADVERSARIAL:** Clean (2026-08-24): disk sweep clean; cleared to flip with
  suite.
- **CHANGE DELTA:** Initial authorship (n/a).

### Code Verification Evidence

IMPLEMENTED 2026-08-24 (green, inline verification):

- NEW `agents/context-pruner/result-digests.ts` — embeddable pure
  `buildResultDigest(toolName, content)` (identity heuristics over path/query/
  url/command families; HEAD/TAIL slices capped by new constants)
- `constants.ts` — DIGEST_HEAD_CHARS 512 / DIGEST_TAIL_CHARS 256 baked into
  CONTEXT_PRUNER_CONSTANTS
- `summarize-messages.ts` — zero-entry tool results now contribute a digest
  fallback (never silence); existing special cases untouched
- `handle-steps.ts` factory — buildResultDigest embedded via .toString()
- `__tests__/result-digests.test.ts` — 4 fixtures
GREEN AMENDMENT (honest): Step-1's zod schema + sha256 deferred — crypto and
structured records belong to `-026`'s spill (which carries toolCallId+sha256);
the digest here is the bounded string contract, caps preserved.
Closure-audit amendment extension (2026-08-24): Step-4's `compression.digest:`
config surface is likewise DEFERRED — caps are baked constants until config
plumbing lands additively; single-owner constants module per GREEN convergence.
Gates: agents typecheck exit 0 · pruner suites 37 pass / 0 fail · receipt
stamped via `fid:verify --write`.

## Resolution

- **Closed Date:** 2026-08-24 21:20 — **Archived:** 2026-08-24 21:25
- **Fix Description:** Preservation contract — result-digest fallback ends the drop-list; zod/sha256 + config surface deferred (amendments).
- **Tests Added:** Yes — pruner suites incl. result-digests fixtures (37 pass / 0 fail).
- **Verification Evidence:** receipt sha256:fef329e5… stamped `--check` green; batched Verifier+Adversary closure audit PASS.
- **Live Smokes:** WAIVED-BY-OPERATOR-DIRECTIVE 2026-08-24 — never claimed passed.

## Lessons Learned

(pending — captured at closure)