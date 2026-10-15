# FID: Free-compute intelligence layer (stability · model index · churn · nudges · fallbacks · quality)

**Filename:** `FID-2026-0915-001-free-compute-intelligence-layer.md`
**ID:** FID-2026-0915-001
**Severity:** medium
**Status:** closed
**Created:** 2026-09-15 (operator asked "do you have any ideas of how we can use
this data?" after the FID-2026-0914-003 report restructure; ruled: "so all 6")
**YAGNI-Compliance:** Verified — six workstreams, each traceable to a live
data source the pipeline ALREADY collects; no new feeds, no new network
surface except the operator-keyed quality gauntlet (W6, manual only).

## Problem

The discovery pipeline (FID-2026-0914-003, closed) accumulates a daily
time-series of the free-compute ecosystem — latency, auth boundary, model
rosters, host death/return — but discards almost all of it on every run:

- `latencyMs` is overwritten per run: one sample, zero memory (no stability
  signal is possible from the current state).
- The model rosters are rendered in the report but never INDEXED: nothing can
  answer "which verified hosts serve model family X?" (needed for fallback
  hints and model-dropout detection).
- The churn claims justifying daily cadence are borrowed from research; we
  now generate first-party churn data and throw it away.
- The announce block surfaces candidates but never RELATES them to what the
  operator actually uses (better-default nudges impossible).
- Everything measured is operational; nothing measures whether a host's
  models ANSWER coding prompts well (the curation decision's missing input).

## Evidence (executed this session)

- A1 — state file: `dev/provider-candidates/candidates.json` (live, 55
  hosts) carries `lastProbe.latencyMs` as a single scalar per host; no
  history array anywhere (read 0-EOF post-restructure).
- A2 — rosters present: `ReportCandidate.models` is populated from
  `card.freeModelsEn` on every run (report restructure, live-verified:
  cerebras 4†, openrouter 300 probed, orcarouter 195).
- A3 — harness precedent: `evals/v2/src/harness.ts` `BenchmarkHarness` +
  injectable `AgentRunner` interface (`v2/src/runner.ts:141`) — W6 follows
  the same injectable-runner pattern without coupling `evals` to `scripts`.
- A4 — 429 precedent: `packages/agent-runtime/src/llm-api/savant-code-web-api.ts:10`
  `RETRYABLE_STATUS_CODES` includes 429 — the LLM-error layer already
  classifies rate limits; the exact chat-path catch seam is a RED-phase
  exit criterion (file:line pin required before W5 wiring).
- A5 — FID queue empty (`ls dev/fids/` → README only); prior FID archived.
- A6 — context-block seam: `common/src/providers/discovery-context.ts`
  builds the announce block from structured facts — the nudge surface
  extends this builder (sanitize-by-construction preserved).

## Workstreams (6)

**W1 — Stability ring buffer.** `CandidateState` gains
`history: Array<{ d: string; up: boolean; ms: number | null; b: string }>`
capped at 14 entries (MQ1), appended once per run inside the SAME
candidates.json file (v2: `_meta.version` bump; `parseStateFile` migrates
v1 by synthesizing a 1-entry history — zero classification impact).
Report candidates table gains `Uptime` (e.g. `93% · 210ms avg`) computed
from the ring. Purity: pure `appendHistory(state, sample, cap)` in
`scripts/providers/lib/diff-state.ts` + pins.

**W2 — Model-first index.** Pure `buildModelIndex(state)` →
`Map<familyToken, Array<{host, boundary, latencyMs, models}>>` where
`familyToken` is a normalized model-family key (e.g. `deepseek`, `qwen`,
`llama`, `glm` — normalization pinned). Consumed by: the report (new
"Model availability index" section, sorted by readiness), dropout
detection (a family a host served yesterday but not today = changed
signal in the audit trail), and W5. Lives in `common` (moved there with
`parseStateFile`/`serializeStateFile` into
`common/src/providers/discovery-state.ts` — Law 13: the CLI reader, the
report, and W5 share one truth; scripts re-export for compatibility).

**W3 — Churn analytics + denylist export.** State gains
`firstSeenLocal` (set on `new`, never mutated). Report gains an
"Ecosystem churn" section: 7-day window counts of new/lapsed/returned +
median observed lifespan of dead hosts (from ring buffer + lapsed keys).
Same module emits `dev/provider-candidates/denylist.json` (gitignored,
MQ4): every rejection/flag ever recorded with reason + date — the
audit-trail's machine-readable form.

**W4 — Better-default nudges.** Extends the context-block builder: when a
HEALTH-TRACKED pipeline provider degraded this run AND a boundary-ok
candidate exists with latency < half the degraded provider's last
latency and ≥1 model, the block gains ONE capped line
(`suggestion available: <host> — see report`). Fires only for
pipeline-tracked providers (no new probing of built-ins); never switches
anything (human gate unchanged). Threshold pinned (MQ2).

**W5 — 429 fallback hints.** Pure `fallbackHint(modelId, modelIndex)` in
common: on a rate-limit failure, returns a one-line hint naming up to 2
OTHER boundary-ok hosts serving the same family (never the failing host,
never auto-switching). RED phase locates the chat-error catch seam
(file:line evidence; candidate: cli send-message error path) and wires
fail-silent, once-per-model-per-session. If no index/no matches → empty
string (zero behavior change on missing data).

**W6 — Quality gauntlet (operator-run).**
`scripts/providers/quality-gauntlet.ts` (`bun run providers:quality --
<host>`): runs a FIXED 8-prompt coding rubric against ONE host using an
operator-supplied key (passed via env var at invocation; never stored,
never logged by the pipeline). Deterministic scoring: exact/compile/run
checks + latency per prompt → `dev/provider-candidates/quality.json`
(gitignored) + a report "Quality (operator-run)" section showing
score/latency per gauntleted host with run date. Injectable fetch/runner
for pins; NEVER auto-scheduled; results carry the operator's key-hold
provenance ("gated on you having a key").

## Hard invariants (unchanged from FID-2026-0914-003)

Zero auto-merge/auto-switch · zero key storage · agent has no destructive
or switching tool · untrusted prose never enters model context · all
artifacts under `dev/provider-candidates/` (gitignored) · once-daily
poll unchanged.

## Steps

1. Move + extend state layer in common (`discovery-state.ts`: parse/
   serialize v2 + history + firstSeenLocal + buildModelIndex +
   fallbackHint + family normalization) — scripts re-export.
2. Harvester: append history, set firstSeenLocal, dropout detection,
   denylist.json emission, nudge inputs into the context block.
3. Report: Uptime column, Model availability index section, Ecosystem
   churn section, Quality section (renders only when quality.json exists).
4. CLI: W5 seam (RED first — locate catch, pin, wire fail-silent).
5. `scripts/providers/quality-gauntlet.ts` + `providers:quality` row.
6. Pins: history cap + append purity; v1→v2 migration zero-blip; family
   normalization fixtures (deepseek-v4, qwen3-coder → families);
   model-index ordering; dropout detection; fallbackHint selection +
   exclusion of the failing host + empty-on-no-data; nudge threshold;
   gauntlet scoring via injected runner; denylist completeness.

## Verification

RED→GREEN per step; typecheck ×4; suites (scripts, cli, common, sdk);
eslint --max-warnings 0; lint:md; prettier; LIVE gate = one harvest run
verifying history/uptime/index/churn render + a dry-run gauntlet against
a mock runner (the LIVE gauntlet against a real host is operator-run by
design and explicitly NOT a merge gate).

## Missed Questions (RULINGS LOCKED — operator, 2026-09-15, all four recommendations accepted)

- **MQ1 — ring buffer window:** **14 days** ✅
- **MQ2 — nudge threshold:** **candidate latency < ½ degraded provider's** ✅
- **MQ3 — gauntlet rubric:** **8 fixed prompts** ✅
- **MQ4 — denylist.json:** **gitignored artifact** ✅

Law-2 approval complete — implementation authorized.

## Perfection Loop record

- **Loop 1 (RED):** A1–A6 evidence above, all tool-executed this session.
- **Loop 2 (self-refutations):** *"Keep latency history in per-date
  files."* Refuted — violates the MQ8 one-file contract the operator
  ruled on. *"Auto-switch to a better candidate."* Refuted — the human
  gate is the product. *"Schedule the gauntlet daily."* Refuted — costs
  operator quota and requires keys; manual-only. *"Index model names
  verbatim."* Refuted — `llama-3.3-70b` vs `Llama 3.1/3.3 family` vs
  `meta/llama-3.3-70b-instruct` never join without family normalization;
  verbatim keys fragment the index into uselessness.
- **Loop 3 (corrections applied):** W2 moved the state layer to common
  (originally scripts-only) because W5's CLI seam must not import across
  trees — caught while grounding the import graph.
- **Loop 4 (convergence):** every workstream cites collected data that
  exists today (A1/A2); seams located or marked RED-exit-criteria (A4);
  no unevidenced claims remain. **Converged; Law-2 presentation follows.**

## Resolution

- **Closed Date:** 2026-09-15
- **Fix Description:** Implemented all six workstreams. W1: `appendHistory`/
  `uptimeFor` (14-sample ring, same-day idempotent, oldest-dropped) in the
  state layer; report gains the `Uptime (14d)` column. W2: `familyToken`
  normalization (whole-string known-family match — vendor prefixes, feed
  prose, and bare ids join; whole-string matching required after the RED run
  exposed `Llama 3.1/3.3 family` losing its family to prefix-stripping) +
  `buildModelIndex` (readiness-sorted) + `detectDropouts` (family disappears
  from a host's roster = flagged audit row); report gains the `Model
  availability index` (LIVE: deepseek ×23, qwen ×20, llama ×16 …). W3:
  `firstSeenUtc` (set on new, never mutated), `churnSummary` (7-day window,
  72h-rule lapsed set, median lifespan), `denylist.json` accumulated
  across runs (host+reason dedup, first/lastSeen); report gains `Ecosystem
  churn`. W4: `nudgeLine` (degraded tracked provider AND boundary-ok
  candidate <½ latency AND ≥1 model → ONE line in the announce block —
  suggests, never switches). W5: `fallbackHint` selection + CLI seam
  `fallback-hints.ts` wired through `handleRunError` (both the throw path
  and the `output.type === 'error'` completion path); 429-only,
  fail-silent on missing data, once-per-model-per-session, failing host
  excluded via the error URL. W6: `quality-core.ts` (fixed 8-prompt rubric,
  deterministic checks, injectable runner, key-refused BEFORE any request,
  key never persisted) + `quality-gauntlet.ts` CLI (`providers:quality --
  <host>`) + report `Quality (operator-run)` section. State layer moved to
  `common/src/providers/discovery-state.ts` (Law 13; scripts keep a
  re-export shim); state v2 (`_meta.version: 2`) with zero-blip v1/legacy
  migration (history synthesized from lastProbe).
- **Tests Added:** 34 pins across `intelligence-layer.test.ts` (ring purity
  + cap + same-day idempotence, v2 shape + zero-blip migrations, family
  fixtures, index ordering, hint exclusion, churn math, nudge threshold
  edges), `fallback-hints.test.ts` (429 gate, session memory, fail-silent
  reads, relay exclusion), `quality-gauntlet.test.ts` (rubric size,
  scoring, key-never-persisted, pre-network key refusal). 131 tests across
  the touched suites, 0 fail.
- **Verification Evidence:** typecheck ×4 exit 0 (common/sdk/agent-runtime/
  cli); eslint `--max-warnings 0` on all touched files; prettier clean;
  lint:md pass; LIVE gate: real `providers:harvest --probe` run — 214→55
  stage-0, 0 new/changed/lapsed (zero classification drift through the v2
  migration), Uptime column populated (100% · 67ms avg …), model index
  rendered, churn section rendered, `chutes.ai` still `RELAY ✗` with ring
  history. Test-fixture pollution of the real quality.json caught at the
  LIVE gate and fixed (tests now pin `stateDir`).
- **Archived:** yes — `dev/fids/archive/` (ledger + CHANGELOG updated)

## Lessons Learned

- **Family normalization must match the WHOLE cleaned string first:**
  stripping vendor prefixes before matching destroyed prose surfaces
  (`Llama 3.1/3.3 family` → `3.3 family` → no family). The two-pass order
  (whole-string known-family match, THEN prefix-strip for unknown
  derivation) is what makes the three surfaces join.
- **Inject a clock into tests that write shared artifacts:** two scoring
  pins omitted `stateDir` and wrote a synthetic `test.host` row into the
  REAL quality.json — caught only at the LIVE gate. Default-out state dirs
  in testable code need an explicit test discipline (or a required param).
- **The catch path sees a different scope than the try path:** the W5
  model id had to be hoisted above `try` — try-scoped consts are invisible
  to the catch block that needs them.

### Post-closure LIVE validation (2026-09-15, operator-directed)

The W6 gauntlet was run against a real host (`orcarouter.ai`, operator
key via env, model `deepseek/deepseek-v4-flash-free`) — the first real
end-to-end execution. Result: **8/8 · 1607ms avg**, quality.json clean
(zero key material), report Quality section renders. The validation caught
a real defect the mocked-runner pins could never see: `fetchRunner` blindly
appended `/chat/completions` and followed redirects automatically, but the
endpoint 301-redirects apex→www — fetch rewrites POST→GET on 301/302, so
requests arrived as `GET /v1/chat/completions` → 404. Fix: `/v1`
normalization mirroring `probeEndpoint` + manual 301/302 re-POST (method
AND Authorization intact, 3-hop bound). This also explains why
orcarouter's stored boundary is `boundary-unverifiable` — its POST probe
dies at the same redirect. Pins stayed green; eslint/prettier re-passed.

**Probe hardened the same way (RED-first):** `probeEndpoint`'s boundary
POST had the identical defect (auto-follow degraded it to GET), which is
why redirect-fronted relays measured `boundary-unverifiable`. Pinned (301
re-POST keeps method+body; relative Locations resolve; 3-hop bound degrades
to unverifiable, never a crash) and fixed; the harvester now re-probes
hosts whose standing verdict is `boundary-unverifiable` so stale
measurement artifacts self-correct. LIVE re-measure: orcarouter.ai
`boundary-unverifiable` → **`boundary-ok` (401, 389ms)**; 17 boundary-ok
hosts, `chutes.ai` still the lone `RELAY ✗`.
