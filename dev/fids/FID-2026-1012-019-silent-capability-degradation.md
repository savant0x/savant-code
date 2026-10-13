# FID: Three tools degrade silently, breaking a rule the ledger already states

**Filename:** `FID-2026-1012-019-silent-capability-degradation.md`
**ID:** FID-2026-1012-019
**Severity:** high
**Status:** fixed
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-023, FID-2026-1012-024

---

## Summary

Four of the highest-volume classes in the mechanical trace ledger are the same failure: a
capability that is absent, broken or cut off is reported to the agent as if it had run and
found nothing. A missing research key becomes an empty result set
(`packages/agent-runtime/src/llm-api/research-sources.ts:125`, 24 hits / 7 sessions), a
code search whose binary cannot be spawned returns nothing (13 hits / 5 sessions) and a code
search that collected zero of the matches its own process found returns nothing (7 hits / 4
sessions), and a read-only command cut at a 30-second bound reports only that it timed out
(7 hits / 6 sessions). The ledger already carries the rule this breaks — *a control's
degradation path needs the same specificity as its success path* (lesson `A governance
control that degrades to an advisory needs a loud, specific degradation`, owning
FID-2026-1006-004) — and that rule was applied to one worktree control instead of to the tool
surface. The agent's next decision is therefore made on a false premise: "found nothing" and
"could not look" are indistinguishable.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `@savant-code/agent-runtime` at the recorded `main` line
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

The trace ledger records one immutable row per tool failure. Aggregated over its 559 records
(68 classes, 195 distinct sessions), this lane's **six classes — 50 records** in the
`FID-2026-1012-022` allocation — share one shape: a capability that did not run, reported as a
capability that ran:

- **`web_search` returns an empty result set when no research key is configured.** The notice
  it returns instructs the *operator* to add a key; it does not tell the agent that the search
  did not happen, and it arrives after the agent has already committed to a research plan.
- **`code_search` returns nothing when its ripgrep process cannot be spawned.** The failure is
  visible only as a tool-level error line that names the missing binary — never as "search
  unavailable, use a different method", which is the decision the agent actually needs.
- **`code_search` returns nothing when its own process reported matches but none were
  collected.** This is the worst shape of the three: the process exited 0, so every signal
  available to the caller says success, and the agent concludes the codebase does not contain
  what the class of defect says it might.
- **`run_readonly_command` reports only "timed out after 30 seconds".** The bound is named but
  the work state is not: was it slow, blocked, or waiting on input, and what was it doing. The
  class itself is owned by `FID-2026-1012-023`; what this record keeps from it is the reading
  rule — a timeout must never read as "found nothing".

None of the four is covered by a lesson. The ledger's coverage of the general rule is real but
was written for a worktree control, not for the tool surface, so the class survived it.

### Expected Behavior

A capability that is missing, broken or cut off names itself, once per run, in the agent's own
terms, and never returns an empty success. "Could not look" and "looked and found nothing" are
different results and must stay different all the way to the decision that consumes them — the
same invariant the ledger already states for controls, applied to every capability a run
depends on. A run should also be able to learn the state of its capabilities *before* a plan
depends on them.

### Root Cause

Each tool's degradation path is written locally and independently, and every one of them
treats "no capability" as "no data". There is no shared contract for what a degraded result
looks like, no run-start capability check, and no producer-side rule that a search which could
not complete must not return the same value as a search that completed with zero hits. The
`code_search` anomaly makes the gap explicit: the caller cannot distinguish a genuine
zero-match from a result-collection failure, so it reports the benign one.

### Evidence

```text
# Volumes and recency, aggregated from dev/experiences/raw-traces.jsonl (2026-10-12)
records=559  classes=70  distinct sessions=195
classes at the >=3-distinct-session promotion bar (FID-2026-1005-003): 27

  24 hits /  7 sessions  last 2026-10-10  web_search | No web search results were returned. Add a research API key …
  13 hits /  5 sessions  last 2026-09-17  code_search | Failed to execute ripgrep: ENOENT: no such file or directory,
                                          uv_spawn '<path>/rg.exe'. Vendored ripgrep not found; ensure
                                          @codebuff/sdk is up-to-date or set CODEBUFF_RG_PATH. …
   7 hits /  4 sessions  last 2026-10-10  code_search | Code search anomaly: ripgrep exited 0 (matches existed) but
                                          0 matches were collected — …
   7 hits /  6 sessions  last 2026-10-10  run_readonly_command | Command timed out after 30 seconds

# Ledger coverage of these classes in the live file
$ grep -ci 'ripgrep' dev/LEARNINGS.md
0
$ grep -ci 'timed out' dev/LEARNINGS.md
0
$ grep -ci 'web_search\|web search' dev/LEARNINGS.md
1        # an incidental prose mention, not a lesson about the degradation
```

Emission sites confirmed in the tree:

- `packages/agent-runtime/src/llm-api/research-sources.ts:125` — the empty-result notice for a
  missing research key.
- `sdk/src/native/ripgrep-path-fallback.ts` — savant's own ripgrep resolver (FID-2026-0918-007).
  **Attribution open:** the recorded ENOENT text names `@codebuff/sdk` and `CODEBUFF_RG_PATH`,
  so whether the failing resolver is savant's or the host's must be established before that leg
  is assigned. Nothing in this record claims it is savant's defect.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/llm-api/research-sources.ts` (the research/web-search surface)
- The `code_search` tool's spawn and result-collection path (ripgrep resolution — attribution
  open per the evidence above)
- The read-only command runner's timeout path (exact call site **NEEDS-REVIEW**: not located by
  the searches this record cites)
- Every agent plan that consumes a search result: the false premise propagates into synthesis,
  file edits and FID evidence

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

High because the failure is silent and directional: it does not stop work, it misdirects it,
and the four classes together account for 51 recorded failures across 22 distinct sessions.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

One degradation contract, enforced at the producers rather than at each call site: a result
carries whether the capability ran, and a capability that did not run names itself once, with
the action that fixes it. Then a run-start self-check so a plan can see its capabilities before
depending on them, and the two `code_search` legs made producer-side explicit — no spawn, no
collect, and no ambiguity between them.

### Steps

1. Re-measure the four classes from `dev/experiences/raw-traces.jsonl` at implementation time;
   this record's RED is a 2026-10-12 snapshot and is not a claim about the current window.
2. Define the degradation contract (a typed result stating the capability, that it did not run,
   why, and the one action that resolves it) and its rendering, before touching any individual
   tool — one shape, not four local messages.
3. Make the research surface return that contract for a missing key instead of an empty result
   set, while keeping it a *named degradation* rather than a hard failure: a run that never
   searches must not break.
4. Fix the `code_search` legs: resolve the ripgrep failure attribution first (step 6), then make
   a spawn failure and a zero-collected-matches anomaly both explicit errors, distinguishable
   from a completed search with no hits.
5. Give the read-only timeout path a named outcome carrying the bound and the measured duration,
   so a cut is visible as a cut.
6. Establish the ENOENT attribution — run savant's `sdk/src/native/ripgrep-path-fallback.ts`
   resolver and the host's path against the recorded shape and record which one fails — before
   assigning that leg to either side.
7. Add the run-start capability check: report each capability's state once, before a plan
   depends on it, with no per-turn repetition.
8. Declare the recurrence assertion required by FID-2026-1012-021: each class must be absent
   from the trace ledger for the following window before any lesson is written about it.

### Verification

Re-aggregate the four classes from `dev/experiences/raw-traces.jsonl` over the window that
follows implementation and report their counts and last-seen dates beside this record's
baseline; assert in a focused test that a missing capability produces one named, actionable
notice and never an empty success; assert that a search which could not run is distinguishable
from a completed zero-hit search; and assert the timeout path reports its bound. The gate
declarations, the test paths and the receipt are added when this record reaches
`fixed`/`verified` — asserting them now would be a false declaration.

## Verification Gates

- gate: test common/src/util/__tests__/capability-notice.test.ts
- gate: test packages/agent-runtime/src/llm-api/__tests__/research-sources-web.test.ts
- gate: test sdk/src/__tests__/code-search-flags.test.ts
- gate: test sdk/src/__tests__/capability-preflight.test.ts
- gate: test sdk/src/__tests__/ripgrep-path-fallback.test.ts
- gate: test packages/agent-runtime/src/run-agent-step/__tests__/capability-preflight.test.ts
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:e365d87c0859141fda5340bc6fd75a14e6046978008f4e2bfc1d69604ae1efc7
- verified: 2026-10-13T22:34:28.032Z
- test common/src/util/__tests__/capability-notice.test.ts: exit 0
- test packages/agent-runtime/src/llm-api/__tests__/research-sources-web.test.ts: exit 0
- test sdk/src/__tests__/code-search-flags.test.ts: exit 0
- test sdk/src/__tests__/capability-preflight.test.ts: exit 0
- test sdk/src/__tests__/ripgrep-path-fallback.test.ts: exit 0
- test packages/agent-runtime/src/run-agent-step/__tests__/capability-preflight.test.ts: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** four classes, 51 recorded failures across 22 distinct sessions, asserted to be one
  shape — a capability that did not run reported as a capability that ran; ledger coverage of
  the individual classes is zero, and the general rule the ledger does carry was applied to one
  control rather than to the tool surface.
- **GREEN:** one degradation contract at the producers, a run-start capability check, and the
  two `code_search` legs made explicitly distinguishable; the ENOENT leg is not assigned until
  its resolver is attributed.
- **AUDIT:** the counts and dates are re-read from the ledger and pasted above; the two emission
  sites named are the ones this record's searches returned; the third class's call site is
  marked NEEDS-REVIEW rather than guessed.
- **ADVERSARIAL:** (a) does a degradation notice risk becoming noise the model ignores? It is
  emitted once per run, with the resolving action, which is the shape the ledger's own rule
  prescribes — and noise is the current state, where the notice is indistinguishable from data.
  (b) Should a missing research key fail the run? No: a run may legitimately not need search, so
  it is a named degradation, not a hard failure. (c) Is the `code_search` anomaly a third
  defect rather than a leg of this one? It is the same defect observed at the consumer instead
  of the producer; both are fixed by the contract, and the record keeps them in one place so
  the invariant is stated once.
- **CHANGE DELTA:** 0% — pre-implementation. The record converged on a design; no source file
  has been touched.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** Allocation is six classes / 50 records; timeout ownership is FID-023.
  Search anomalies already return `errorMessage` through close-payload → executor;
  research exhaustion follows a keyless fallback. These are not silent zero-hit fixes.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: inspect every producer
  and consumer, preserve real errors, and distinguish completed-empty, unavailable and
  incomplete results. Investigate all six shapes, including flags/type failures and
  host-vs-SDK resolver provenance; do not blame a missing BYOK key without evidence.
- **AUDIT:** SDK fail-loud/fallback suites pass. That proves truthful reporting for
  covered fixtures, not repaired search collection. The 26 later code-search failures
  contradict an age-based resolution claim for the former wrapper class.
- **ADVERSARIAL / missed question:** Is a loud anomaly a successful search? No.
  Preflight must not deny unused capabilities or human work. Host attribution and live
  causes remain explicit NEEDS-REVIEW; planned tests/window are in the shared review.
- **CHANGE DELTA:** Planning correction only; all six allocated classes remain owned.

### Loop 3 — Implementation (2026-10-13)

- **RED (re-measured at implementation time, `main` @ `64ea8c06`):** the capture held 563 records / 56
  stable classes (FID-2026-1012-024's instrument collapses the 68 legacy aliases). This lane's three
  savant-side classes: `web_search` `research-unavailable` **24 hits / 7 sessions / last 2026-10-10**;
  `code_search` `search-executable-missing` **17 hits / 8 sessions / last 2026-10-04**; `code_search`
  `search-incomplete` **7 hits / 4 sessions / last 2026-10-10**. The timeout class
  (`run_readonly_command` `timeout`, FID-023's) measured **15 hits / 10 sessions / last 2026-10-13**.
- **GREEN:** one shared degradation contract (`common/src/util/capability-notice.ts`), the research
  surface and the `code_search` flag path re-pointed at it, and the notice deduped per run scope.
- **AUDIT:** the declared gates are listed above and stamped below; the re-measure is verbatim in this
  entry, not summarised.
- **ADVERSARIAL — did the class move, or stop?** It has **not** yet stopped: all three classes are
  live at the last measure, and every fix in this pass lands **after** it. The honest state is
  "implemented, observation window open", never "class fixed". Two sub-answers this pass established
  rather than assumed:
  1. **ENOENT attribution settled (step 6 of the plan).** The recorded text —
     `Failed to execute ripgrep: ENOENT … Vendored ripgrep not found; ensure @codebuff/sdk is up-to-date
     or set CODEBUFF_RG_PATH` — appears **nowhere in this repository** (`grep -rn 'Vendored ripgrep|CODEBUFF_RG_PATH'
     sdk/src common/src packages cli/src` → no match). Savant's own spawn failure reads
     `Failed to execute ripgrep at "${rgPath}": … Repair with 'bun run --cwd=sdk fetch-ripgrep' or set
     SAVANT_CODE_RG_PATH.` (`sdk/src/tools/code-search/executor.ts:268`) and its resolver names its own
     candidates and the workspace-correct repair (`sdk/src/native/ripgrep.ts:204-215`). So the 17
     `search-executable-missing` records were produced by the **host bundle's** resolver, and this lane
     fixes nothing there — the class is a host-side cause, recorded so it is not re-derived as savant's.
  2. **The timeout class changed shape without leaving.** The newest timeout record
     (`2026-10-13T03:10:27.155Z`, `run_readonly_command`) carries the **new** FID-023 contract text —
     `Command timed out after 600 seconds. Termination requested; verify cleanup before another execution.
     Narrow the command or choose an explicit …` — one hour *after* FID-023's fix commit
     (`653db58d`, 2026-10-12T21:46:52-04:00), with `expectedness: undetermined`. That is the shape 022's
     convergence rule calls “still open”: a legitimate timeout and a silent one are still one class,
     because the capture has no expected-outcome field. FID-024 owns separating them; FID-023's record
     now carries the observation.
- **CHANGE DELTA:** +1 contract module, +1 extracted notice builder, +3 tests; the research surface,
  the `web_search` handler, the class registry and the `code_search` flag parser changed. No production
  class claim, no lesson, no `fix-boundaries.json` entry — the window has not started.

### Missed Questions

### Loop 4 — Run-start capability preflight (2026-10-13)

**Plan:** Four review steps. Subject: truthful client capability checks before planning.

#### Thought 1

The CLI's `initializeApp` probes ripgrep for a human warning, while
`createLoopContext` assembles the model's initial history without that result.
The search executor uses its own module URL for resolution. A server-side probe
or a probe of a different bundling context could certify the wrong executable.

#### Thought 2

Add an optional, ephemeral client capability callback to the run dependency
contract. The SDK supplies it beside its tool-execution wiring; the child
context extractor forwards it. Reuse the search executor's exact resolution
function and bound a local `--version` check. Host overrides remain unverified
and never trigger a bundled-binary probe. No session schema changes are needed.

#### Thought 3

Research configuration is evidence of configured sources only. Centralize the
selector's key names for preflight; retain the keyless fallback when no key is
present. The runtime filters to its effective tools, honors offline policy and
adds one tagged history message before planning, leaving the system/tool prefix
stable. A resumed run replaces the previous tagged message and refreshes state.

#### Thought 4

The alternative of persisting availability in file context would become stale
across runs and add snapshot classifications. The callback keeps the executing
client authoritative. Tests must prove prompt delivery, refresh, child forwarding,
override handling, missing/broken binary outcomes, safe research and no probe of
unused tools. PATH resolution refreshes when PATH/PATHEXT or binary name changes.

#### Final

Implement the callback and tagged preflight under the master's level-3 grant.
All notices are advisory and bounded; no network request, raw credential,
command replay, tool-array mutation or class-repair claim follows a preflight.
Extend FID-019's scoped targets for these named seams before source writes.
Record the new test gates after the files exist, then re-stamp the receipt.

- **RED evidence:** The new `createLoopContext` integration test failed with
  zero `CAPABILITY_PREFLIGHT` messages before wiring, then passed with one
  refreshed message. This proves delivery at the production planning seam.
- **Implementation:** Optional `probeClientCapabilities` travels through SDK
  runtime assembly and `extractSubagentContextParams`. Both preflight and
  search call `resolveCodeSearchRipgrep`; a bounded, shell-free version check
  uses the existing credential-free child environment. Concurrent children
  share one in-flight probe; configuration changes invalidate its cache.
  The runtime limits an unresponsive host callback to 2,500 ms and preserves
  the system prompt and tool array. Research configuration and execution now
  share `WEB_SEARCH_API_KEYS`.
- **AUDIT:** Full SDK suite 686 PASS / 1 SKIP / zero FAIL; full runtime suite
  2,115 PASS / zero FAIL; common 879 PASS / 4 SKIP / zero FAIL. Full root
  typecheck and scoped zero-warning ESLint PASS. The live client probe returns
  `code_search: ready` because local ripgrep starts, explicitly without a search.
  Runtime suite log: `dev/scratchpad/active/2026-10-13-fid019-runtime-tests.log`.
- **ADVERSARIAL:** A working executable that is not ripgrep is rejected by the
  real version adapter. Unused tools, host overrides and cancelled runs skip
  probing. Offline research remains unavailable; a configured key is never
  treated as completed network access. Probe exceptions omit raw text and
  credential values. The original host-resolver failure remains unproved;
  this check does not declare any historical class repaired.

1. **Is the ripgrep ENOENT savant's defect or the host's?** → **Answered in Loop 3: the host's.**
   The recorded text names `@codebuff/sdk` and `CODEBUFF_RG_PATH`, and neither string exists in this
   repository; savant's own resolver and spawn failure name `SAVANT_CODE_RG_PATH` and the
   workspace-correct repair command. The class stays owned here as a census row, but the cause is the
   host bundle's resolver — nothing in this lane edits it.
2. **Is a silent empty result ever the right answer?** → No, and the distinction is the whole
   finding. Zero hits is data; no capability is a missing prerequisite. Collapsing them is what
   the four classes have in common.
3. **Does this overlap with FID-2026-1012-017's incomplete-arguments class?** → They interact:
   an agent given a phantom empty result may spend its next tool call inventing inputs, which is
   the emission-side class. They stay separate records, but 017's budget work must preserve the
   difference between "could not run" and "ran and found nothing".

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record has
> been implemented, so what follows records what was CHECKED at `main` @ `bee0610d` — not what
> was built.

- [x] Every cited path exists at the cited commit, read directly: the research notice at
      `packages/agent-runtime/src/llm-api/research-sources.ts:125` and savant's ripgrep resolver
      at `sdk/src/native/ripgrep-path-fallback.ts`.
- [x] Measurements re-checked: the four class counts, session counts and last-seen dates in the
      Evidence block, aggregated from the 559-record trace ledger on 2026-10-12, plus the three
      ledger-coverage greps against the live `dev/LEARNINGS.md`.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status reaches `fixed`/`verified` and the artifacts
      exist.

## Boundaries

- The trace stores each failure's **first line**, so a class can stand for several sub-causes;
  the counts are volumes, not a root-cause attribution, and step 1 re-measures before any fix.
- The read-only timeout class's exact call site was not located in this pass — marked
  NEEDS-REVIEW rather than guessed. Loop 3 located it and left it with its owner: the contract lives in
  `common/src/util/command-execution.ts` (FID-023); this record keeps only the reading rule.
- The ripgrep ENOENT attribution is unresolved by design; the record fixes nothing there until
  it is established.
- No live session was instrumented to reproduce a silent degradation; the classes are measured
  from recorded runs, not observed live in this pass.

## Resolution

**Implemented — `Status: fixed` (deterministic gates green; recurrence assertion OPEN).**

- **Closed Date:** 2026-10-13 (implementation pass; the record stays open in the sense that the
  class window has not run — no lesson is written).
- **Fix Description.** One degradation contract now exists — `common/src/util/capability-notice.ts`:
  a notice names the capability, states `unavailable` / `did not complete` in its first clause, carries
  the measured reason, the single resolving action and what the result is **not** evidence of; the
  lead clause is stable per state so the capture keeps a measurable class. The research surface is its
  first consumer: on exhaustion `searchWebSource` reports **which providers were configured** and that
  the keyless port ran and returned nothing (`packages/agent-runtime/src/llm-api/research-notice.ts`,
  built from the selector's observed state), replacing the message that read as a completed search of
  lower quality. `web-search.ts` still reports every failure and drops only the repeated advice, via a
  bounded per-run notice log. `code_search` gained the structural guard this record's plan named: a
  model-supplied `--` terminator and a trailing value-taking flag with no value are dropped with a
  warning (`sdk/src/tools/code-search/flags.ts`), because the caller appends its own `--` before the
  pattern and either shape silently changed the search. `common/src/util/experience-classes.ts` maps
  the new research lead to the existing `research-unavailable` cause and keeps the legacy pattern, so
  the 24 recorded rows do not split into a second class.
- **Tests Added:** `common/src/util/__tests__/capability-notice.test.ts` (7 cases: lead per state,
  render order, once-per-scope claim, bounded overflow, owner reset);
  `sdk/src/__tests__/code-search-flags.test.ts` (6 cases: dropped terminator, flags kept around it,
  dropped trailing value-flag, booleans untouched, non-flag arguments still re-homed, no second
  terminator forwarded); and two new cases in
  `packages/agent-runtime/src/llm-api/__tests__/research-sources-web.test.ts` — the no-key notice
  (`Web search is unavailable: no research provider is configured (checked SERPER_API_KEY, …)`) and the
  configured-but-empty notice (`Web search did not complete: no configured provider produced a result
  (SERPER_API_KEY) …`), which is the distinction between "nothing configured" and "configured and
  empty" that the class is made of.
- **Verification Evidence:** `common` 866 pass / 4 skip / 0 fail (109 files) · `sdk` 670 pass / 1 skip
  / 0 fail (106 files) · `packages/agent-runtime` 2,066 pass / 0 fail (316 files) · typecheck `common`,
  `sdk`, `packages/agent-runtime` all exit 0 · `quality:report` PASS (1,502 baselined files) ·
  `validate:repository` PASS · ESLint `--max-warnings 0` and Prettier clean on every touched file.
  Red-measure at `64ea8c06`: 563 records / 56 stable classes; this lane's three classes live and
  unstopped (24/7, 17/8, 7/4) — pasted verbatim in Loop 3.
- **Archived:** not archived. Per FID-2026-1012-022's closure condition a child closes only when its
  classes show no new records in the declared window; the window has not started.
- **Open, and why this record is not `closed`:** (a) the recurrence window (14 days / 3 sessions) has
  not run, so no class claim exists and no fix boundary is recorded (`dev/experiences/fix-boundaries.json`
  stays empty); (b) the run-start capability preflight (plan step 7) is now
  implemented by Loop 4: the SDK owns the local probe, child calls share its
  run-scoped result, and the runtime refreshes one tagged planning notice;
  it is advisory and claims no search completion; (c) the flags/type failures
  (`unrecognized file type`, `unrecognized flag`) already surface ripgrep's own actionable stderr
  through the anomaly path, so no producer-side list of valid types was added — a hardcoded list would
  rot against the pinned binary. All three are stated as open rather than counted as done.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 7, 12, 14 and 15,
  §4 root cause RC3, §5 feature E3.
- **Ordering:** consumes the recurrence assertion defined by `FID-2026-1012-021` (the lesson is
  written only after the class stops); shares the research surface with `FID-2026-1012-018`
  (fetch taxonomy) and must preserve the "could not run" distinction that
  `FID-2026-1012-017` depends on.
