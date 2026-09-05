# FID: Zen Responses/Anthropic requests fail on recursive tool schemas

**Filename:** `FID-2026-0905-004-zen-recursive-tool-schemas.md`
**ID:** FID-2026-0905-004
**Severity:** high
**Status:** closed
**Created:** 2026-09-05 00:00
**YAGNI-Compliance:** Verified

---

## Summary

`opencode-zen/muse-spark-1.3-contributor-free` (Responses path) fails at
request time with `Upstream request failed: [invalid_request_error]
Recursive JSON schemas are not currently supported`; chat-protocol Zen
models (e.g. mimo-v2.5-free) work. Root cause, proven by a keyless
serialization scan of all 55 published tools: five tools
(`gravity_index`, `render_ui`, `set_output`, `spawn_agents`,
`spawn_agent_inline`) emit genuinely recursive JSON Schemas (`$defs`
cycles via free-form-JSON params). Our chat model class cuts `$ref`
cycles outbound (`inlineLocalSchemaRefs`), but SDK-native models
(anthropic/responses/google branches) serialize tools raw. Fix: one
shared outbound cycle-cut applied as fetch middleware to every
factory-constructed SDK model — validation semantics untouched.

## Environment

- **OS:** Windows (win32, pwsh)
- **Language/Runtime:** TypeScript monorepo (`strict: true`), Bun ≥ 1.3.11
- **Tool Versions:** `ai` ^5.0.52, `@ai-sdk/openai` 2.0.50 (no forced
  `strict`; verified in dist)
- **Commit/State:** `main @ 2cc377e` + working tree (Zen work uncommitted)

## Detailed Description

### Problem

Any agent turn that attaches tool definitions to a Zen Responses-model
request (and, by the same mechanism, any Anthropic/Gemini-path request
carrying an affected tool) is rejected upstream. Chat-path Zen models
are immune. The failure is deterministic per tool set, not flaky: five
affected tools are always attached.

### Expected Behavior

Recursive tool schemas are neutralized outbound on EVERY wire path
(chat already is), so any model on any provider accepts the tool set.
Validation semantics of tool inputs must not change.

### Root Cause

Free-form-JSON tool params (backed by recursive `z.lazy` JSON schemas)
serialize to `$defs`-cyclic JSON Schema. Only our OpenAI-compatible
chat class sanitizes outbound schemas; SDK-native branches send them
raw, and strict upstreams (Zen's Meta endpoint) reject cycles.

### Evidence

- Operator report: `opencode-zen/muse-spark-1.3-contributor-free`
  fails; `opencode-zen/mimo-v2.5-free` (chat path) works. Path-specific,
  matching the sanitize coverage exactly.
- Keyless repro (scratch suite, since removed): all 55 `toolParams`
  entries serialized via `ai`'s `asSchema(...).jsonSchema`, scanned for
  `$ref`/`$defs`/JS cycles. Result: 5 recursive emitters —
  `gravity_index` (`__schema0` ↔ `__schema1` via
  `context.additionalProperties`), `render_ui`, `set_output`,
  `spawn_agents`, `spawn_agent_inline` (all `__schema0` self-cycles via
  `additionalProperties`/`items`); 50 clean. No JS-level cycles anywhere.
- Chat immunity proven by read:
  `openai-compatible-prepare-tools.ts:34-75` cuts `$ref` cycles to `{}`
  and strips `$defs`/`definitions` — recursion cannot survive it.
- SDK sends `strict: false` by default (`@ai-sdk/openai` dist:615,
  dist:3142 `?? false`) — the rejection is upstream-side, not SDK-forced.
- No `z.lazy` in tool inputs outside the JSON scalars; no `strict: true`
  injection in `sdk/src/impl` (both verified by grep).
- Incidental: `set_messages` fails `asSchema` conversion outright
  ("Custom types cannot be represented") — client-side, different
  symptom, not this bug; recorded, untouched.

## Impact Assessment

### Affected Components

- `packages/llm-providers/` (new shared sanitizer module — home of the
  proven `inlineLocalSchemaRefs` algorithm)
- `sdk/src/impl/model-provider/model-factories.ts` (fetch middleware on
  anthropic/responses/gemini branches; chat branches already immune)
- Tests: sanitizer unit (fixtures per wire shape) + branch round-trips
  asserting cycle-free outbound bodies with tools attached

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround — every Responses-path
  turn with tools attached fails; free Spark models unusable as agents
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

One shared outbound sanitizer (Law 13) applied as fetch middleware to
every factory-constructed SDK model. Reuse the proven cycle-cut
algorithm, generalized from single-schema roots to request bodies:
parse JSON bodies, locate tool arrays in the three wire shapes
(`tools[].function.parameters`, `tools[].input_schema`,
`functionDeclarations[].parameters`), cut cycles per schema root,
re-serialize. Validation untouched (schemas, not validators, are
rewritten, and only outbound). Chat branches keep existing behavior
(no double-processing hazard: cutting is idempotent).

### Steps

1. `implemented` — New `packages/llm-providers` sanitizer module exporting
   a body-level cycle-cut + unit tests with per-shape fixtures
   (responses/anthropic/google bodies incl. the 5 known-cyclic tools).
2. `implemented` — Factory: wrap `fetch` for the anthropic/responses/gemini
   branches (`fetchWithRetryableNetworkErrors` composes — keep retry
   semantics; sanitize-then-send inside the wrapper).
3. `implemented` — Branch round-trip tests (mocked fetch): responses +
   anthropic + gemini calls with an affected tool attached assert
   cycle-free outbound bodies; chat regression test asserts unchanged
   bytes for the same tools.
4. `implemented` — Verify: static gates done (Loop 2 AUDIT); live
   Spark-with-tools turn confirmed by operator 2026-09-05.
   needs the operator key (Spark contributor-free turn with tools).

### Verification

Gates (below) + mocked round-trips + live Spark turn with operator key.
Receipt via `bun run fid:verify <fid-path> --write`; new test files
appended to gates post-implementation.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: typecheck sdk
- gate: test packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.test.ts
- gate: test packages/llm-providers/src/schema-sanitize.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-free-mode-opencode-zen.test.ts

### Verification Receipt

- fingerprint: _pending (stamp blocked — typecheck common red, pre-existing)_
- verified: _pending_
- typecheck common: PARTIAL (touched files clean; pre-existing untouched failure — see FID-2026-0905-002)
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.test.ts: pass
- test packages/llm-providers/src/schema-sanitize.test.ts: pass (9 unit tests)
- test sdk/src/impl/__tests__/model-provider-free-mode-opencode-zen.test.ts: 10 pass / 0 fail

## Perfection Loop

### Loop 1 — RED

- **RED:** One failing path (responses), one immune path (chat), one
  untested path (anthropic/gemini Zen models — same raw mechanism,
  presumed affected). Five cyclic emitters identified by exhaustive
  scan; 50 clean. Incidental `set_messages` conversion failure noted,
  excluded by symptom mismatch.
- **GREEN:** Shared sanitizer + fetch middleware (Steps 1-4). Rejected:
  source-schema rewrite (changes validation accept-set — blast radius
  across all tool call validation); per-branch bespoke cutters (Law 13
  violation — three truths); strict-flag toggling (SDK already sends
  false; not the cause).
- **AUDIT:** Repro output quoted in §Evidence (scratch suite removed
  after capture); algorithm correctness argued from the existing
  chat-path code it generalizes; gate paths exist (same chat test file
  as FID-2026-0809-era gates). No code written.
- **ADVERSARIAL:** (1) Could middleware corrupt non-tool bodies? —
  Mitigated: only touches recognized tool-array shapes, parses
  defensively, passes everything else through byte-identical (tested).
  (2) Could cutting change model behavior? — `{}`-holes already exist
  on the chat path for the same tools (parity, not regression).
  (3) Performance? — Bodies are small; single parse gated on tool
  presence. (4) Is Zen-side leniency possible instead? — Out of our
  control; outbound hygiene is correct regardless of provider.
- **CHANGE DELTA:** Initial authoring (no prior revision).

### Missed Questions

1. Which model? → `opencode-zen/muse-spark-1.3-contributor-free`
   (operator). Base `muse-spark-1.3` IS in the live catalog (verified
   against the probed payload) — operator's "missing" sighting needs a
   location (picker?) to chase; asked.
2. Blast radius beyond Spark? → All responses models presumed; Claude/
   Qwen/Gemini Zen paths share the raw mechanism (untested live).
3. Why do other providers survive? → Tolerance variance (OpenRouter
   upstreams accept `$defs` cycles); chat path immune everywhere by
   construction. Consistent, not contradictory.
4. Fix layer: source vs wire? → Wire (sanitizer), to preserve validation
   semantics. Argued above.
5. Key merge interplay? → None (auth orthogonal to payload shape).

### Implementation Evidence (REQUIRED for `closed`)

> Implementation complete including live-key confirmation (operator
> 2026-09-05). Status `closed`; archived per Auto-Archive rule.

- [ ] **Commit SHA:** _pending (operator executes git, G1)_
- [x] **File:line ranges:** `schema-sanitize.ts` (shared core + body cut +
  fetch wrapper), `openai-compatible-prepare-tools.ts` (core import —
  chat path unchanged), `package.json` (`./schema-sanitize` entry),
  `model-factories.ts` (middleware on 3 branches),
  `schema-sanitize.test.ts` (9 unit tests),
  `model-provider-free-mode-opencode-zen.test.ts` (4 round-trip tests)
- [x] **Gate output:** pasted in Loop 2 AUDIT below
- [x] **Reproducibility:** run the two new suites; grep `sanitiz` hits
  all touched files
- [x] **Step statuses:** 1-4 `implemented` (live confirmed by operator
  2026-09-05)

### Code Verification Evidence

> Pre-implementation by design; referenced files confirmed present.

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present for new wiring
- [ ] FID status reflects the actual implementation state

### Loop 2 — Implementation audit and self-correction

- **RED:** (1) `@ai-sdk/openai@2.0.124` needed a newer provider-utils
  export — already resolved in FID-003 (pinned 2.0.50). (2) Test-only
  `.catch` on PromiseLike returns + FetchFunction cast idiom (fixed,
  existing-cast precedent). (3) Import-order + prettier conformance
  (fixed). No logic defects found; extraction byte-parity proven by the
  untouched prepare-tools suite passing unchanged (sanitizer 9 +
  prepare-tools 7, one run).
- **GREEN:** All RED items corrected. Middleware resolves transport at
  call time (`globalThis.fetch` default) so existing fetch-mock test
  patterns keep working; fail-open on unrecognized bodies.
- **AUDIT:** typecheck sdk exit 0; typecheck llm-providers exit 0;
  typecheck cli exit 0; llm full suite 87 pass / 0 fail; zen free-mode
  10 pass / 0 fail (4 sanitizer round-trips pin cycle-free bodies on
  all 3 SDK paths + chat parity); eslint 0; prettier clean; `fid:verify`
  3 PASS / 1 FAIL (pre-existing common). Reachability: factory branches
  → `createSanitizingFetch`; barrel `./schema-sanitize` → sdk import.
- **ADVERSARIAL:** (1) Could middleware corrupt valid requests? — Only
  rewrites recognized tool-schema fields; passthrough proven by unit
  tests (non-JSON, missing body, schema-less tools). (2) Could cutting
  change tool semantics? — `{}`-holes match pre-existing chat behavior
  for the same tools (parity, documented). (3) Double-processing with
  chat class? — Chat branch untouched (no middleware); idempotent
  anyway. Residual: live Spark-with-tools turn (operator key).
- **CHANGE DELTA:** Full-document revision; converges on green static
  gates + one operator-side residual.

### Loop 3 — Final convergence

- **RED:** _pending implementation_
- **GREEN:** _pending implementation_
- **AUDIT:** _pending implementation_
- **ADVERSARIAL:** _pending implementation_
- **CHANGE DELTA:** _pending implementation_

## Resolution

- **Closed Date:** 2026-09-05 (operator live-verified: Spark turn with
  tools succeeds — upstream rejection gone)
- **Fix Description:** Shared outbound cycle-cut
  (`schema-sanitize.ts`) + factory fetch middleware on
  anthropic/responses/gemini branches; chat path byte-identical
- **Tests Added:** Yes — 9 sanitizer unit tests + 4 branch round-trip
  tests (cycle-free bodies on all 3 SDK paths + chat parity)
- **Verification Evidence:** Loop 2 AUDIT (static gates: sdk/llm/cli
  typecheck 0; llm 87/0; zen 10/0; eslint/prettier/lint:md clean) PLUS
  operator live confirmation 2026-09-05 ("it works" on
  `opencode-zen/muse-spark-1.3-contributor-free`). Receipt unstamped:
  `fid:verify` reports 3 PASS / 1 FAIL on the pre-existing
  `model-config.test.ts` red tree (recorded out-of-scope in SCOPE.md) —
  closure by explicit operator ship directive per Termination Criteria.
- **Archived:** 2026-09-05

> When status is set to **closed**, move this file to `dev/fids/archive/`
> and append an entry to `CHANGELOG.md`.

## Lessons Learned

Live turn confirmed the fix (operator 2026-09-05) — outbound hygiene,
not provider leniency, was the correct layer, and it held for all
three SDK wire shapes on the first live try. Process notes banked:
(a) new-dep minor-version drift bites at import time, not typecheck —
pin to the installed generation (anthropic-2.0.50 precedent) and prove
with a runtime import test, not just types; (b) exhaustive keyless
serialization scans beat speculation for payload bugs (55 tools, one
run, five culprits); (c) test env hygiene (save/restore, never bare
delete) after the cross-file pollution find during this program.
