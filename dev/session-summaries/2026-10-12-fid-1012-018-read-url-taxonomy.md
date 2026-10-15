# FID-2026-1012-018 — read_url outcome taxonomy (2026-10-12)

**Status:** implemented, `fixed`. **Program of record:** `dev/fids/FID-2026-1012-022`
(`### Work order` + `### Status board`); this pass worked wave **A1**, record `-018`.
**Register:** `SCOPE.md`. Nothing is pushed; local commits only.

## What landed

- `sdk/src/tools/read-url/outcomes.ts` (new) — the taxonomy: HTTP status → kind, next action and whether
  the outcome is final for the run (`not-found`, `unauthorized`, `denied`, `method-not-allowed`,
  `rate-limited`, `unavailable`, `server-error`, `client-error`, `oversized`, `unsupported-content`,
  `blocked`, `dns`, `unextractable`); the extraction-miss classifier (empty body, markup-with-no-text, or
  an explicitly unproven cause); the canonical URL identity; the bounded per-run negative cache.
- `sdk/src/tools/read-url/fetch.ts` — every refusal site classified; repeats answered from the memo;
  `response-body.ts` extracted so both files stay under the 300-line ceiling.
- `sdk/src/__tests__/read-url-outcomes.test.ts` (new, 17 cases) and the updated blocked-host expectation in
  `read-url-ssrf.test.ts`.

Two rules decide the shape of everything emitted:

1. **The first line of every message is byte-identical to the pre-taxonomy shape** (`Failed to fetch URL: …`,
   `No readable text found at URL`, `Response is too large …`, `Unsupported content type: …`, the SSRF
   refusal). The advice goes on the following lines. This keeps the capture counting the same class
   (`common/src/util/experience-classes.ts`) instead of silently renaming it.
2. **Only run-final outcomes are memoized.** A 429, a 5xx, a DNS failure or a timeout is advised and never
   remembered, so a transient condition cannot become a permanent dead end. The cache is bounded (100
   entries), its key drops the fragment and the userinfo only (so no credential is persisted), and
   `clearReadUrlNegativeCache()` marks an explicit run boundary.

RED re-measured: all 11 owned keys `unresolved` — 404 ×114, unextractable ×25, 403 ×10, 401 ×9, 429 ×7,
oversized ×7, plus 405, unsupported, blocked, dns and 503.

Gates run this pass: the three `read-url` suites 35 pass / 0 fail · full SDK suite 664 pass / 0 fail across
105 files · `bun run --cwd=sdk typecheck` exit 0 · `validate:repository` PASS · `fid:verify --check` PASS
with the record's five declared gates verified live and its receipt stamped · Prettier and ESLint clean.

No class claim is made and `dev/experiences/fix-boundaries.json` stays empty: the 14-day / three-session
observation window has not started.

## Findings raised, not parked

- **A baseline expectation changed by design.** `read-url-ssrf.test.ts` asserted the blocked-host error by
  exact equality; the refusal now carries its policy advice on a second line, so the assertion moved to the
  new shape. The SSRF checks themselves — including re-validation on every redirect — are untouched.
- **SCOPE correction.** This record's register line did not cover its own test surfaces
  (`sdk/src/__tests__/read-url*.test.ts`); the line was extended in the same pass as the write — the same
  correction `FID-2026-1012-017` needed, which suggests the register template should name test surfaces for
  every class lane up front.

## Still open

1. **Wave A1 remainder:** `-019` (capability integrity, 6 classes / 50 records), `-020` (edit-path friction,
   13 / 72), then `-021` (the recurrence-to-fix machinery).
2. **Observation windows:** every `fixed` class lane needs real sessions over 14 days before any class claim
   or lesson.
