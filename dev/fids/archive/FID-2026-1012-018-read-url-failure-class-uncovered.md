# FID: read_url failures are the top recorded class and are covered by no lesson

**Filename:** `FID-2026-1012-018-read-url-failure-class-uncovered.md`
**ID:** FID-2026-1012-018
**Severity:** high
**Status:** closed
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-024

---

## Summary

`read_url | Failed to fetch URL: 404 Not Found` is the **single largest recorded failure class
in this repository**: **114 hits across 18 distinct sessions**, last seen 2026-10-10. Together
with the tool's other outcomes — `No readable text found at URL` (25/7), `403` (10/7), `401`
(9/8), `429` (7/3) and `Response exceeded 2000000 bytes` (7/6) — the lane runs to **11 classes and
181 records** on one tool, its allocation in the `FID-2026-1012-022` census. The ledger covers it
with **zero** mentions: `grep -ci 'Failed to fetch URL' dev/LEARNINGS.md` returns 0. The class is a
flat per-call error with no taxonomy, no negative caching and no signal that a URL should not be
tried again, so a hallucinated or mangled URL is re-attempted across sessions and nothing
accumulates.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122 (unchanged; this class is entirely inside the fetch path)
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

`read_url` returns one flat error per attempt, regardless of why the attempt failed. The
consequences compound across the four outcomes measured here:

- **Not found (114 hits / 18 sessions).** A URL that does not exist is retried in later turns
  and later sessions with no memory that it was already known-bad, because nothing records a
  negative result.
- **Denied and rate-limited (403: 10/7; 401: 9/8; 429: 7/3).** Each is reported as a per-call
  status with no policy attached — no backoff, no credential hint for the 401, no distinction
  between "you are not allowed" and "you asked too often".
- **Oversized (7/6).** The 2,000,000-byte refusal is a per-call answer, so the caller has no
  way to learn the shape of what it should have asked for.
- **Unextractable (25/7).** `No readable text found at URL` reports a failure with no
  information about whether the response was empty, binary, JS-rendered or blocked — the four
  causes need four different next actions.

Because the model sees a flat string, the only behaviour it can adopt is "try another URL",
which is exactly the behaviour that produced 114 not-found attempts. The ledger never captured
this class, so the dog-fooding loop never got a chance to act on it; the volume has been
accumulating since 2026-09-17 unseen.

### Expected Behavior

Each fetch outcome should be classified, and the classification should drive the next action:
a not-found is final for the run and offers a search fallback instead of a dead end; a denied
or unauthorized response names the credential boundary once; a rate-limited response carries a
retry policy; an oversized response names the cap and suggests a ranged or targeted read; an
unextractable response names which of the four extractability causes it observed. Repeated
attempts at the same URL within a run are answered from a negative cache rather than by
another network round trip.

### Root Cause

**Every upstream condition collapses into one flat per-call error at the fetch boundary.**
`read_url`'s error text is produced at two sites only:

- `sdk/src/tools/read-url/fetch.ts:169` —
  `` `Failed to fetch URL: ${response.status} ${response.statusText}` ``
- `sdk/src/tools/read-url/fetch.ts:186` — `errorResult(url, 'No readable text found at URL')`

Neither site classifies the failure, caches it, canonicalises the URL, or reports anything at
class level, so nothing in the system can distinguish a transient upstream problem from a URL
that will never resolve — and the model is left to brute-force its way through.

### Evidence

```text
$ bun -e '<aggregate dev/experiences/raw-traces.jsonl by toolName+errorFirstLine>'

   114  18 sessions  first 2026-09-17  last 2026-10-10  read_url | Failed to fetch URL: 404 Not Found
    25   7 sessions  first 2026-09-19  last 2026-10-11  read_url | No readable text found at URL
    10   7 sessions  first 2026-10-09  last 2026-10-12  read_url | Failed to fetch URL: 403 Forbidden
     9   8 sessions  first 2026-09-16  last 2026-10-10  read_url | Failed to fetch URL: 401 Unauthorized
     7   3 sessions  first 2026-09-17  last 2026-10-09  read_url | Failed to fetch URL: 429 Too Many Requests
     7   6 sessions  first 2026-09-17  last 2026-10-09  read_url | Response exceeded 2000000 bytes

$ grep -ci 'Failed to fetch URL' dev/LEARNINGS.md
0
$ grep -ci 'No readable text' dev/LEARNINGS.md
0

$ grep -n 'Failed to fetch URL\|No readable text found' sdk/src/tools/read-url/fetch.ts
169:        `Failed to fetch URL: ${response.status} ${response.statusText}`,
186:      return errorResult(url, 'No readable text found at URL')
```

One tool accounts for roughly 31% of every recorded failure in the repository, and the ledger —
the artifact whose purpose is to log failures so they can be fixed — has never mentioned it.

## Impact Assessment

### Affected Components

- `sdk/src/tools/read-url/fetch.ts` (both emission sites; the taxonomy and negative cache)
- The `read_url` tool contract and its result shape, as consumed by the agent loop
- Any research or documentation-reading flow, which pays the retry cost per turn
- `dev/experiences/raw-traces.jsonl` as the instrument that will judge the fix

### Risk Level

- [x] High: a top-volume class that burns turns and network budget in every research session,
  with no classification, no caching and no ledger coverage.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Give fetch outcomes a taxonomy and let the taxonomy drive the next action. The class is cheap
to fix precisely because it is flat today: four causes and one cache, at two call sites. The
verification is a **recurrence assertion** over the trace ledger — the class must stop
appearing — rather than a green suite alone.

### Steps

1. Re-measure the class with the aggregation in RED at implementation time and record the
   numbers before any change.
2. Classify every fetch outcome at `fetch.ts`: `not-found`, `denied` (401/403, credential
   boundary named once), `rate-limited` (429, with a retry policy), `oversized` (the 2 MB cap,
   reported with the observed size and a targeted-read suggestion), `unextractable` (the four
   causes named at `:186`).
3. Make `not-found` one-shot per run and hand back a search fallback instead of a dead end.
4. Cache negative results per run (URL → classification) so a repeat attempt is answered
   locally, and report the class-level count in the result so the pattern is visible to the
   agent rather than only to the ledger.
5. Canonicalise the URL before the first attempt (trailing slash, fragment, common tracking
   parameters) so trivially different spellings of the same dead link share one cache entry.
6. Write no lesson until the recurrence assertion holds, per FID-2026-1012-021's loop rule.

### Verification

- The same aggregation re-run over the window after the fix, recorded here, showing the class
  count for `404`, `403`, `401`, `429`, oversized and unextractable separately — the taxonomy
  is what makes the reduction interpretable.
- A recurrence probe (exit 0 clean / 1 with issues) declared as a gate when the status reaches
  `fixed`, plus `typecheck sdk` and `quality`.
- Negative control: a genuinely unavailable host still surfaces as a failure, so classification
  does not become silent success.

**Not a gate:** the recurrence assertion. It reads the capture rather than this record's artifacts, and no
class can be asserted clean until the 14-day / three-session observation window runs; it becomes the
closure gate when that window completes (`FID-2026-1012-021` owns the machinery).

## Verification Gates

- gate: test sdk/src/__tests__/read-url.test.ts
- gate: test sdk/src/__tests__/read-url-ssrf.test.ts
- gate: test sdk/src/__tests__/read-url-outcomes.test.ts
- gate: test sdk/src/__tests__/read-url-run-cache.test.ts
- gate: typecheck sdk
- gate: typecheck common
- gate: quality

### Verification Receipt

- fingerprint: sha256:bfce01bbb7a855d9759efeb51499be071d8fdc2bdd4b645f3a8a3b21cb36503a
- verified: 2026-10-14T17:58:04.776Z
- test sdk/src/__tests__/read-url.test.ts: exit 0
- test sdk/src/__tests__/read-url-ssrf.test.ts: exit 0
- test sdk/src/__tests__/read-url-outcomes.test.ts: exit 0
- test sdk/src/__tests__/read-url-run-cache.test.ts: exit 0
- typecheck sdk: exit 0
- typecheck common: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** `read_url` holds ~172 recorded failures, led by 114 `404`s across 18 distinct
  sessions (last 2026-10-10) — the largest class in the repository — and the ledger's coverage
  of it is **zero** by direct `grep -ci` on both message texts. The two emission sites are
  `sdk/src/tools/read-url/fetch.ts:169` and `:186`, neither of which classifies or caches.
- **GREEN:** classify the five outcome families, make not-found one-shot with a search
  fallback, cache negatives per run, canonicalise the URL, and report the class count.
- **AUDIT:** the aggregation and both greps are pasted in Evidence and are reproducible; the
  two emission sites were read at `bee0610d`; the matrix row this record expands is
  `docs/design/learnings-root-cause-matrix.md` §3 row 1 and §4 RC2.
- **ADVERSARIAL:** (a) Is the 114 really one class? The trace stores only the first line, so it
  may span several upstream causes — which is itself the finding (the error shape cannot tell
  them apart), and the fix's taxonomy is what will make the count interpretable. (b) Could
  negative caching hide a URL that later becomes available? Per-run scope bounds that: the
  cache dies with the run. (c) Does a search fallback invent an answer? No — it substitutes a
  discoverable next step for a dead end, and the original failure is still reported. (d) Does
  canonicalisation risk merging distinct resources? Only on fragments and tracking parameters,
  which do not select content.
- **CHANGE DELTA:** 0% source — this record made no code change; it is a converged
  pre-implementation design.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** 11 classes / 181 records, including 405/503/PDF/DNS/SSRF outcomes omitted
  from the narrow steps. Two injected 404 calls make two fetch attempts. HTTP error
  results still contain only URL/errorMessage; the five status probes reproduce this.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: classify all owned
  outcomes, cache within a run, preserve every SSRF redirect check, and retain path
  slashes and query parameters in identity. Diagnose only causes the response proves;
  unknown extraction stays unknown. A fallback is advice, never an invented result.
- **AUDIT:** SDK URL/SSRF baseline passes. The current broad expected-failure filter
  excludes 404 and extraction errors regardless of context; FID-024 must repair that
  before this lane's recurrence claim can be trusted.
- **ADVERSARIAL / missed question:** Does an upstream refusal itself prove a defect?
  No, nor prove correctness. Investigate handling/repetition and retain the outcome.
  All 11 classes remain owned; exact planned tests and exposure rules are in the review.
- **CHANGE DELTA:** Planning correction only; no class is classified dormant or fixed.

### Loop 3 — Implementation pass (2026-10-12, operator-authorized)

- **RED (re-measured this pass, the instrument of FID-2026-1012-022):**
  `bun scripts/experiences-recurrence.ts` reports all 11 keys owned by this record `unresolved` at their
  recorded volumes — `read_url` 404 ×114, unextractable ×25, `http-403` ×10, `http-401` ×9, `http-429` ×7,
  `fetch-oversized` ×7, plus `http-405`, `fetch-unsupported`, `fetch-blocked`, `fetch-dns` and `http-503`
  from Loop 2's widened set.
- **GREEN (implemented):** `sdk/src/tools/read-url/outcomes.ts` carries the taxonomy (status → kind,
  next action and whether the outcome is final for the run), the extraction-miss classifier (empty body,
  markup-with-no-text, or an explicitly unproven cause), the canonical URL identity, and the bounded
  per-run negative cache. `sdk/src/tools/read-url/fetch.ts` uses them at every refusal site, and
  `response-body.ts` was extracted so both stay inside the 300-line ceiling. Two rules govern the shape
  of everything emitted: the **first line of each message is byte-identical to the pre-taxonomy shape**
  (`Failed to fetch URL: …`, `No readable text found at URL`, `Response is too large …`,
  `Unsupported content type: …`, the SSRF refusal), so the capture keeps counting the same class, and the
  advice lands on the following lines where the model reads it. Only run-final outcomes are memoized: a
  429 or a 5xx is advised and never remembered, so a rate limit cannot become a permanent dead end.
- **AUDIT:** `sdk/src/__tests__/read-url-outcomes.test.ts` (new, 17 cases) plus the two baseline suites —
  35 pass / 0 fail: status classification and cacheability, the search fallback, the three extraction
  causes, identity (fragment removed; trailing slash, port and query preserved; credentials never in the
  key), cache behaviour and its bound, and three end-to-end fetches (a repeated 404 answered from the memo
  with **one** network call, a 429 fetched twice and memoized never, an oversized response and a PDF
  refusal carrying their guidance). Full SDK suite 664 pass / 0 fail across 105 files;
  `bun run validate:repository` PASS.
- **ADVERSARIAL:** (a) *Does the taxonomy hide the failure?* No — every outcome is still reported as a
  failure with the same first line; only the advice is added. (b) *Could negative caching hide a URL that
  becomes available?* The cache is per run and bounded, and only outcomes the taxonomy marks final are
  admitted; a transient condition is never memoized, and `clearReadUrlNegativeCache()` gives an explicit
  run boundary. (c) *Does the search fallback invent an answer?* It substitutes a discoverable next step
  for a dead end; no result is fabricated and the original failure is preserved in the message.
  (d) *Does the canonical key merge distinct resources?* It drops only the fragment (and the userinfo, so
  no credential is persisted); path, trailing slash, port and query are preserved.
- **BASELINE CHANGED, deliberately:** `sdk/src/__tests__/read-url-ssrf.test.ts` asserted the blocked-host
  error by exact equality; the refusal now carries its policy advice on a second line, so the assertion
  was updated to the new shape (same first line). The SSRF checks themselves — including re-validation on
  every redirect — are untouched and still covered.
- **SCOPE correction:** this record's register line did not cover its own test surfaces
  (`sdk/src/__tests__/read-url*.test.ts`); the line was extended in the same pass as the write, the same
  correction recorded for `FID-2026-1012-017`.
- **CHANGE DELTA:** ~0.6% of the record.

### Loop 4 — Run-boundary correction (2026-10-13)

- **RED:** At `09264a0b`, `readUrl` defaults to the process-wide
  `readUrlNegativeCache`. Its reset function has only test callers. The production
  SDK dispatcher supplies no cache, although `runOnce` builds a fresh runtime
  implementation for each invocation. Loop 3's claim that one process means one
  run is false for the embeddable client and the long-lived CLI.
- **GREEN:** Allocate one bounded negative cache in `buildAgentRuntimeImpl`, pass
  it through `handleToolCall` to `readUrl`, and remove the process-wide singleton.
  Direct reads without an injected cache have independent lifetimes. Children
  sharing the runtime callback share its cache; a fresh invocation, including a
  resumed invocation, revalidates URLs. No serialized cache or public run option
  is added. Existing repeated-read tests must supply their intended shared cache.
- **AUDIT:** `runOnce` → `buildWiredAgentRuntime` → `buildAgentRuntimeImpl` →
  `requestToolCall` → `handleToolCall` → `readUrl` is reachable. Source searches
  find singleton/reset consumers only in fetch and its outcome test. Add controls
  through the real runtime dispatcher: repeat suppression within a run, a fresh
  fetch in another runtime, and a late repeat in the first runtime proving the
  second run did not clear its state. Direct-reader isolation gets its own pin.
- **ADVERSARIAL:** Clearing a global at run start would break concurrent runs;
  closure-owned caches avoid that race. Overrides retain dispatch precedence.
  Transient outcomes remain uncached, first failure lines remain unchanged,
  and every network attempt retains SSRF validation. This correction makes no
  horizon/expectedness change and establishes no production repair assertion.
- **CHANGE DELTA:** Converged additive correction under the existing level-3
  authorization; SCOPE now includes the two production dispatch seams.
- **IMPLEMENTATION EVIDENCE:** Both new controls failed before the correction
  (another runtime received the memoized 404; independent readers made only one
  fetch), then passed. Four URL suites: 37 PASS / zero FAIL. Full SDK:
  693 PASS / one platform SKIP / zero FAIL. All seven expanded FID gates PASS.
  Manual re-read confirms override precedence and SSRF checks are unchanged;
  there is no process-wide cache left. Live census: 589 rows / 58 stable classes,
  zero issues; all eleven fetch classes remain unresolved with unchanged counts.

### Missed Questions

1. Why is this class absent from the ledger while classes with a fraction of its volume have
   lessons? → Because the ledger is written from *incidents* the agent finds interesting, and
   a flat tool error never became one; FID-2026-1012-021 exists to make recurrence, not
   interest, the trigger.
2. Should the taxonomy live in the tool result or in an error type? → In the tool result the
   model reads, because the model's next action is what changes; a typed error that never
   reaches the model leaves the 114-attempt behaviour intact.
3. Do the 401/403 cases indicate a missing credential rather than a defect? → Unknown from the
   trace, and the classification must separate them from not-found so that the answer becomes
   visible: a credential boundary named once is a fact the operator can act on, whereas a
   generic per-call failure never surfaces as an ask.

### Code Verification Evidence

> Implemented in Loop 3: the outcome taxonomy, canonical identity and per-run negative cache, wired at
> every refusal site in the fetch path. The gate output below is the evidence for what landed; the
> receipt under `### Verification Receipt` records the live re-run.

- [x] Measurements re-checked: the aggregation over `dev/experiences/raw-traces.jsonl` returned
      the per-class counts pasted in Evidence (114/18 for `404`, 25/7 unextractable, 10/7 `403`,
      9/8 `401`, 7/3 `429`, 7/6 oversized), and `grep -ci 'Failed to fetch URL' dev/LEARNINGS.md`
      plus `grep -ci 'No readable text' dev/LEARNINGS.md` both returned 0.
- [x] The two emission sites were read at `main` @ `bee0610d`
      (`sdk/src/tools/read-url/fetch.ts:169` and `:186`), and the ranking this record expands is
      `docs/design/learnings-root-cause-matrix.md` §3 rows 1, 6 and 13, §4 RC2.
- [x] **Taxonomy and cache implemented:** `sdk/src/tools/read-url/outcomes.ts`,
      `sdk/src/tools/read-url/fetch.ts`, `sdk/src/tools/read-url/response-body.ts`; production callers
      confirmed by grep (`classifyHttpStatus` ← `fetch.ts` `!response.ok`; `classifyExtractionMiss` ←
      `fetch.ts` empty-extraction branch; `canonicalUrlKey`/`readUrlNegativeCache` ← `readUrl` entry;
      `readUrl` ← `sdk/src/run/tool-call.ts`). Loop 4 replaces the singleton with
      `createNegativeCache` ← `buildAgentRuntimeImpl` → `handleToolCall` → `readUrl`.
- [x] **Suites green this pass:** the three `read-url` suites at
      `sdk/src/__tests__/read-url.test.ts`, `sdk/src/__tests__/read-url-ssrf.test.ts` and
      `sdk/src/__tests__/read-url-outcomes.test.ts` — 35 pass / 0 fail; full SDK suite 664 pass / 0 fail
      across 105 files; `bun run --cwd=sdk typecheck` exit 0; `bun run validate:repository` PASS;
      Prettier and ESLint clean on every changed file.
- [x] **Not claimed:** that any class has stopped recurring. No fix boundary is written for these keys,
      so `dev/experiences/fix-boundaries.json` stays empty, every owned key reports `unresolved`, and the
      14-day / three-session observation window has not started.

## Boundaries

- The trace records only each failure's first line, so the 114 `404` records may cover several
  upstream causes and several distinct URLs; the record's claim is about the *emitted shape*,
  which is measured, not about a single root cause.
- No fetch was executed in this pass. The classification targets are read from the two emission
  sites; the fix's RED must re-measure before changing anything.
- `429` and `403` may be correct upstream behaviour rather than defects. The finding is that the
  system cannot tell them apart or act differently on them, which is what the taxonomy fixes.
- Nothing in the ledger was edited by this record, and no lesson is proposed for the class until
  the recurrence assertion holds.

## Resolution

**Implemented — `Status: closed` under the operator-approved Q25 waiver.**

Loop 3 landed the taxonomy and the cache: every fetch outcome is classified (`not-found`, `unauthorized`,
`denied`, `method-not-allowed`, `rate-limited`, `unavailable`, `server-error`, `client-error`,
`oversized`, `unsupported-content`, `blocked`, `dns`, `unextractable`), each carries the next action the
model should take, a not-found is final for the run and points at a search instead of a dead end, and
repeats are answered from a bounded per-run memo without a second network request. The message's first
line is unchanged from the pre-taxonomy shape, so the capture still counts the same class while the model
receives the guidance.

Loop 4 corrects the original process-wide cache lifetime. Each SDK run invocation
owns a separate memo through its runtime callback; direct readers share state
only when their caller supplies a cache. Fresh invocations can retry a recovered
resource without clearing another run's memo.

The deterministic implementation gates are green, but no class has been shown to stop recurring:
`dev/experiences/fix-boundaries.json` stays empty and every owned key reports `unresolved` from
`bun scripts/experiences-recurrence.ts`. Q25 permits archival of this implementation-complete lane
only under the named waiver below; it does not claim repair, silence or qualified production observation.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 1, 6 and 13; §4 root
  cause RC2; §5 feature E2.
- **Ordering:** independent of FID-2026-1012-017 (a different layer and a different tool), but
  it hands its class to FID-2026-1012-021's recurrence assertion, so the two should be
  implemented with the same instrument.

### Implementation Evidence

- [x] **Commit SHA:** `64ea8c06` (fetch taxonomy and cache) and `d9cee722` (run-isolated cache correction).
- [x] **File:line ranges:** `sdk/src/tools/read-url/fetch.ts:73-237`; `sdk/src/tools/read-url/outcomes.ts:124-242`;
      `sdk/src/run/agent-runtime-impl.ts:67-102`; `sdk/src/run/tool-call.ts:177-183`.
- [x] **Gate output:** the seven declared gates in the receipt above exit 0.
- [x] **Reproducibility:** production callers and the run-scoped cache path are cited in Code Verification Evidence.
- [x] **Step statuses:** implementation steps 1-5 `implemented`; qualified observation step `blocked` by the
      absence of a proved production observation window, with Q25 recorded as the operator ruling permitting
      archival without converting that boundary into a repair claim.

## Closure Record

- **Closure waiver:** Q25 — `dev/experiences/closure-waivers.json`; `fixCutoff: 2026-10-13T23:22:20Z`.
- **Closed Date:** 2026-10-14
- **Fix Description:** fetch outcomes are classified, canonicalized and cached per SDK run; transient outcomes
  remain retryable, while final outcomes receive actionable guidance.
- **Tests Added:** Yes — outcome taxonomy and run-cache regression coverage.
- **Verification Evidence:** 7/7 declared gates exit 0; recurrence probe exit 0 with all owned classes still
  `unresolved`, which is reported as the explicit Q25 observation boundary rather than a repair claim.
- **Archived:** 2026-10-14
