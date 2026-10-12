# FID: read_url failures are the top recorded class and are covered by no lesson

**Filename:** `FID-2026-1012-018-read-url-failure-class-uncovered.md`
**ID:** FID-2026-1012-018
**Severity:** high
**Status:** converged
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

## Verification Gates

This record is **pre-implementation** (`Status: converged`), so **no gates are declared yet**:
a declared gate must point at an artifact that exists, and declaring one now would be a false
declaration. Gates are added under this heading when the status flips to `fixed`/`verified` —
the recurrence probe, `typecheck sdk`, and `quality`.

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

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record
> has been implemented, so what follows records what was CHECKED at the cited `HEAD` — not what
> was built.

- [x] Measurements re-checked: the aggregation over `dev/experiences/raw-traces.jsonl` returned
      the per-class counts pasted in Evidence (114/18 for `404`, 25/7 unextractable, 10/7 `403`,
      9/8 `401`, 7/3 `429`, 7/6 oversized), and `grep -ci 'Failed to fetch URL' dev/LEARNINGS.md`
      plus `grep -ci 'No readable text' dev/LEARNINGS.md` both returned 0.
- [x] The two emission sites were read at `main` @ `bee0610d`
      (`sdk/src/tools/read-url/fetch.ts:169` and `:186`), and the ranking this record expands is
      `docs/design/learnings-root-cause-matrix.md` §3 rows 1, 6 and 13, §4 RC2.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified`; declaring them
      now would be a false declaration.

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

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work above is implemented by whichever pass
flips the record to `fixed`, at which point this section is rewritten in the closure format
(Closed Date / Fix Description / Tests Added / Verification Evidence / Archived) and the
declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 1, 6 and 13; §4 root
  cause RC2; §5 feature E2.
- **Ordering:** independent of FID-2026-1012-017 (a different layer and a different tool), but
  it hands its class to FID-2026-1012-021's recurrence assertion, so the two should be
  implemented with the same instrument.
