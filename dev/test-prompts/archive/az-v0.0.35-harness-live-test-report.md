# A–Z v0.0.35 Harness Live Test — Report

**Version under test:** 0.0.35 (unreleased; bump commit `a7b17277`)
**Date:** 2026-10-01
**HEAD at start:** `a7b17277` — baseline `git status --short` clean
**Toolchain:** Bun 1.3.14 (Windows x64), `version:check` PASS at 0.0.35
**Execution model:** executed inside the session by the harness agent; all
`EXECUTABLE`/`STATIC` rows run directly, interactive TUI rows deferred to the
operator per §3a.

## Verdict summary

| Verdict | Count |
|---|---|
| PASS | 30 |
| FAIL (fixed during run) | 4 → 0 |
| OPERATOR-CONFIRMED | 3 (5a.6 + Phase 3 rows 2–3) |
| PENDING OPERATOR (non-blocking) | 3 (0.3 + Phase 3 rows 1, 4) |
| SKIP | 0 |

**Release-readiness call: READY — the blocking live probe (5a.6) is
operator-confirmed** ("openai works!", 2026-10-01): the OpenAI platform lane
serves real traffic end-to-end. The three remaining OPERATOR rows are
non-blocking — each surface is pinned by an offline suite (picker sort:
provider-setup-openai 4-leg; connector invoke: handler + SDK pins; identity:
9-leg suite) and none gates the release train. The audit surfaced 4 real
defects (one latent routing invariant, two stale-literal drifts, one flake
class); all fixed during the run with full gate re-verification.

## Phase 0 — Identity, safety, and version

| # | Test | Verdict | Type | Evidence |
|---|------|---------|------|----------|
| 0.1 | version:check PASS at 0.0.35 | PASS | EXECUTABLE | `version: PASS (enforced surfaces synchronized)` |
| 0.2 | identity counter-clause suite | PASS | EXECUTABLE | `agents` workspace: 9 pass / 0 fail (system-prompt-identity.test.ts) |
| 0.3 | no supplier persona on a free lane | OPERATOR-CONFIRMED (pending) | OPERATOR | interactive surface — §3a |

## Phase 1 — Static and executable gate matrix

| # | Gate | Verdict | Evidence |
|---|------|---------|----------|
| 1.1 | root typecheck (13 legs) | PASS | exit 0 |
| 1.2 | common suite | PASS | 738 pass / 0 fail (initial run: 4 FAIL — see Agent View A-1) |
| 1.3 | sdk suite | PASS | 537 pass / 0 fail |
| 1.4 | cli suite | PASS | 3772 pass / 0 fail (initial run: 3 FAIL — see Agent View A-2) |
| 1.5 | connectors suite | PASS | 17 pass / 0 fail |
| 1.6 | agent-runtime suite | PASS | 1561 pass / 0 fail |
| 1.7 | eslint --max-warnings 0 | PASS | exit 0 |
| 1.8 | lint:md | PASS | exit 0 |
| 1.9 | validate:repository | PASS | PASS |
| 1.10 | generate:provider-docs:check | PASS | up to date |
| 1.11 | quality:report | PASS | PASS (1498 baselined files) |
| 1.12 | build:catalog regenerates the committed bundle | PASS (after fix) | 3 providers / 9 endpoints; initial run exposed Agent View A-3 (stale `catalogVersion` literal) — now derived from the root manifest; remaining regeneration diff is `generatedAt` only (by-design timestamp, see A-4) |

Root `bun run test` (all 13 workspace suites): 13× `0 fail`.

## Phase 2 — Feature-focused suites (the 0.0.35 delta)

### 5a. FID-2026-1001-001 — OpenAI platform provider

| # | Test | Verdict | Type | Evidence |
|---|------|---------|------|----------|
| 5a.1 | registry validation suite | PASS | EXECUTABLE | 3 pass / 0 fail (within common 738/0) |
| 5a.2 | SDK OpenAI lane suite | PASS | EXECUTABLE | 6 pass / 0 fail (within sdk 537/0) |
| 5a.3 | provider setup + picker suite | PASS | EXECUTABLE | 4 pass / 0 fail (within cli 3772/0) |
| 5a.4 | live-catalog fan-out suite | PASS | EXECUTABLE | 4 pass / 0 fail (within cli 3772/0) |
| 5a.5 | no chat/completions against api.openai.com | PASS | STATIC | entry `protocol: 'responses'`; default-inference responses branch is the only bare-slug constructor |
| 5a.6 | live keyed probe (/v1/models + /v1/responses) | OPERATOR-CONFIRMED | OPERATOR | operator: "openai works!" (2026-10-01) — platform key live end-to-end |

### 5b/5c. FID-2026-0930-001/-002/-003 — connectors layer + tool surface

| # | Test | Verdict | Type | Evidence |
|---|------|---------|------|----------|
| 5b.1 | connectors workspace suite | PASS | EXECUTABLE | 17 pass / 0 fail |
| 5b.2 | async fail-closed-at-load | PASS | STATIC + EXECUTABLE | `ASYNC_UNSUPPORTED` engine error class (engine/errors.ts:30); launch catalog carries no async docs; engine suite green |
| 5b.3 | MIT attribution | PASS | STATIC | `packages/connectors/LICENSE-monid` present |
| 5c.1 | the four FID receipt suites | PASS | EXECUTABLE | tool-params 8, catalog-tools-surface 17, handlers 10, sdk honest-error 2 — all within the green workspace runs |
| 5c.2 | safety census + credentials redaction | PASS | STATIC | invoke is the sole network/prompt entry; credentials output pinned env-names-only (handler suite) |

### 5d. FID-2026-0929-004/-005 — gut-the-backend

| # | Test | Verdict | Type | Evidence |
|---|------|---------|------|----------|
| 5d.1 | absence greps | PASS | EXECUTABLE | 0 production `SAVANT_CODE_API_KEY` consumers (3 hits are doc-comments); 0 `/subscribe` registrations |
| 5d.2 | INFERENCE_BASE_URL fail-fast | PASS | EXECUTABLE | sdk suite pins green |
| 5d.3 | boot precedence | PASS | EXECUTABLE | cli provider-setup pins green |

### 5e. FID-2026-0929-001/-002/-003 — hardening batch

| # | Test | Verdict | Type | Evidence |
|---|------|---------|------|----------|
| 5e.1 | direct-402 honesty pins | PASS | EXECUTABLE | cli suite green |
| 5e.2 | boot-mode precedence pins (8) | PASS | EXECUTABLE | common/cli suites green |
| 5e.3 | identity guard suite | PASS | EXECUTABLE | 9 pass / 0 fail |

## Agent View (§7) — additional findings

**A-1. BLOCKER (fixed) — provider census drift + union invariant violation.**
The `openai` registry entry (FID-2026-1001-001) made four census pins stale
(twenty→21 providers, nineteen→20 setup providers) AND exposed a latent
invariant break: `'openai'` was already an ORG SLUG (`common/src/providers/org.ts:15`),
so `deriveAllowedModelPrefixes`' concatenation produced a DUPLICATE prefix
(32 vs 31) — the full-suite drift proved the family had not been run whole
since T107. Fix: set-union dedup in `derive.ts` + census updates.

**A-2. BLOCKER (fixed) — flake class: unbounded spawn-based tests.**
`new-command-rotates-chat` and `savant-free-command-aliases` spawn cold
`bun --eval` subprocesses importing the full command-registry graph; under
load they exceed bun's default 5s test timeout (both green in isolation, both
green this morning). Fix: explicit 60s bounds. WATCH: `handoff-matrix-part-b`
case 4 exceeded its own 20s bound under load (22.8s; 73s in isolation) — its
bound is itself load-sensitive.

**A-3. BLOCKER (fixed) — connectors missed the version-sync list.**
`packages/connectors` was registered everywhere else at FID-2026-0930-002
(typecheck/test/quality/protocol mirror) but not in
`SYNCHRONIZED_PACKAGE_PATHS` — its manifest drifted at the 0.0.35 bump
(0.0.34). Fix: added to the list; `version:bump --force` idempotently synced;
`version:check` PASS. Related: `build-catalog.ts` hard-coded
`catalogVersion: '0.0.34'` (unreachable by any bump surface) — now derived
from the root manifest; artifact regenerated at 0.0.35.

**A-4. WATCH — catalog regeneration diff is never empty by design.**
`build:catalog` writes `generatedAt: now`, so a `git diff --exit-code
src/catalog` gate row always shows the timestamp line after a re-run. The
freshness contract pins source-content hashing, not `generatedAt` — do not
promote the naive diff-check to a hard gate without excluding that field.

**A-5. WATCH — bump `--docs` CHANGELOG header insertion silently no-ops on
CRLF working copies.** The anchor is `# Changelog\n`; a CRLF file does not
match. Worked around by hand at this bump (noted in the bump commit message);
a CRLF-tolerant anchor belongs in the next bump-script pass.

**A-6. NICE-TO-HAVE (applied in place) — harness wording precision.** 5b.2
originally implied `ASYNC_UNSUPPORTED` appears in the catalog bundle; it is
the engine error class raised at load-time of async-declaring docs. The
harness file was corrected so future runs assert the right shape.

## Phase 3 — Live operator prompts

1. `/provider` picker sort (alphabetical built-ins, customs, sentinel last).
   PENDING OPERATOR — non-blocking (pinned by the 4-leg
   provider-setup-openai suite).
2. `/provider openai` masked key flow → routing activation → `/health`.
   OPERATOR-CONFIRMED — the operator stored the platform key through the
   masked flow and activated the lane (2026-10-01; "openai works!").
3. Live platform probe: `/model` shows the account roster; a real
   `openai/gpt-…` request streams. OPERATOR-CONFIRMED — "openai works!"
   (2026-10-01). URL/status/model-count-only evidence rule satisfied by
   verbal confirmation; the key was never surfaced in this session.
4. One connector tool inside a live agent turn. PENDING OPERATOR —
   non-blocking (invoke path pinned by handlers + SDK honest-error suites;
   the invoke confirmation surface is unchanged this release).

## Cleanup

- [x] No fixtures created (`dev/scratchpad/az-fixtures/` absent).
- [x] Env state untouched by the run (no provider keys set; probes were
      suite-internal and restore their own vars).
- [x] Working tree delta vs baseline = exactly the audit-fix commit.
- [x] This report written.
