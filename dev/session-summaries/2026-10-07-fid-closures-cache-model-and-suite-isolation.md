# The active queue is empty: the cache program, the `/model` gap and the suite leak are closed

**Date:** 2026-10-07
**Automation level:** 3 (operator rulings, verbatim: "approve, grant automation
level 3" and "approve, work until everything is completed, no more blockers and
all fixed with echo compliance")
**Register items touched:** T155, T160 and T161 (all opened earlier in the day,
all implemented, verified, receipted, closed and archived in this pass); T119,
T62-followups, T122 and T147 remain open and none of them is an active record

The operator asked for the three records still sitting in `dev/fids/` to be
finished, loop-passed, changelogged and archived. Two of the three turned out to
be carrying a premise that was wrong, and in both cases the correction came from
a measurement rather than from a reading: one record blamed the operator's cache
for a leak that was actually a **live fetch published by a fire-and-forget boot
warm**, and another held two steps open on a **paid endpoint the operator had
never approved**. Nothing was pushed.

## What was done

**Local commits (no push, no release):**

1. `d396d091` — `fix(cli): stop a superseded catalog build publishing
   (FID-2026-1007-006)`. Two defects, one owner. `gatewayInflight` held the first
   build's promise for the rest of the process, so the post-TTL path returned the
   stale catalog and `CATALOG_TTL_MS` was dead code — a production bug found
   while tracing a test failure. And nothing told an in-flight build it had been
   superseded, so a build whose caller had moved on still published into the
   process-wide `gatewayCache`. Measured with a one-run instrumented guard: **82
   claims against 37 suppressed publishes**, 36 of them claimed from
   `cli/src/server/gateway.ts:114` — the fire-and-forget `void
   fetchGatewayModels()` boot warm the server test harness raises once per
   `startTestGateway()`. Every publishing path now claims a build token first; a
   superseded build returns its own catalog to its own caller and writes neither
   the cache, nor the listeners, nor the disk. The fan-out and the merge move to
   `gateway-live-results.ts` and `gateway-catalog-merge.ts` to stay under the
   300-line ceiling, and the two pins live in
   `openrouter-models-gateway-cache.test.ts`.
2. `8c92d087` — `test(cli): give the suite its own config directory
   (FID-2026-1007-006)`. Isolation was opt-in — only files that called the
   gateway harness got a temp `SAVANT_CODE_CONFIG_DIR`, and every other file
   resolved `~/.savant-code-dev` through `getConfigDir()` for settings,
   credentials, `message-history.json`, project data and the disk cache. The
   workspace preload now owns the override, and the pin asserts the property from
   a file that sets nothing.
3. `edc761a8` — `fix(cli): wire ChatAnywhere into the /model picker
   (FID-2026-1007-005)`. The operator's report was two halves and both were real:
   the provider contributed `[]` to a 166-row, 21-provider catalog, and the
   `⭐ FREE KEY` section hoisted every free-RELATED row, so a correct wiring would
   still have relocated the whole roster out of its own group. A synchronous
   builder off the checked-in 27-model map feeds the merge list, `hasFreeToken`
   replaces `isFreeTierEntry` as the hoisting rule (the operator's rule was about
   the marker), the key lane renders only for a provider that contributed rows,
   and `catalogPairingIssues` closes the class two-directionally.
4. `ea25591c` — `docs(fids): stamp the /model and cache-isolation receipts
   (FID-2026-1007-005, -006)`. Both records to `fixed` with their Perfection Loop
   run and their receipts taken against the implementation commits, including the
   correction paragraph FID-2026-1007-006 owes its own draft.
5. `2d0d0724` — `docs(fids): close the last three open records
   (FID-2026-1006-005)`. All three archived with status `closed`, receipts
   re-stamped LIVE at the archived paths (**8/8, 8/8 and 5/5** declared gates exit
   0), closure sections in `dev/fids/archive/README.md`, and the register and
   active-queue README updated.
6. `365b4b8d` — `docs(changelog): record three closures and lessons
   (FID-2026-1007-005)`. Three `### Fixed` entries and three lessons;
   `learnings:check` now reports 42 structured entries (was 39).

## What the measurements changed

**FID-2026-1007-006's draft named the wrong source.** The received value
(`"OpenAI: GPT-5"` for a mocked `"GPT-5"`) exists byte for byte in
`~/.savant-code/gateway-catalog.json`, so the record concluded the suite was
reading the operator's cache. Measured: the suite's default config dir resolves to
`~/.savant-code-dev`, which holds **no catalog at all**. The string was in the
operator's cache because the same live upstream wrote both. Instrumenting the new
guard named the leaking file in one run, and the record's root cause, evidence and
lessons were rewritten against that — with the draft's error recorded rather than
edited away.

**FID-2026-1006-005's two "blocked" steps had no owner.** Steps 8 (the Anthropic
`tool_addition`/`tool_removal` betas) and 10 (the live `>75%` hit ratio) were
recorded as blocked on a live endpoint and provider billing. Tracing the
requirement backwards ended at the record's own reconciliation of the vendor
report's Approval Point 3 — not at the operator, who rejected it outright when
asked. Both are re-scoped to what the environment can measure:

- **Step 8** is an evaluation whose subject is measurable in the tree: neither
  directive appears anywhere (scoped grep, 0 matches), the tool set is assembled
  once per run (`loop-context.ts` ← `loop.ts:57`), the one mid-session mutation
  happens at context creation before the first provider call
  (`loop-context-drive.ts:55`), and a role handoff is a new loop context. The
  betas have nothing to smooth, so adoption is declined with its reopening
  condition stated rather than left waiting on a paid endpoint.
- **Step 10** measures the necessary condition for a provider cache hit, which
  the shipped instrument computes: over a generated 12-turn corpus, **100%
  prefix stability** when nothing structural changes, **81.8% with exactly one
  warning** on a genuine tool change, and **byte-identical model-facing payloads
  across a reorder** under the shipped seam. The provider-side hit ratio is a
  stated boundary, not a claim.
- **Step 11** was already implemented by `FID-2026-1007-004` (`e9322b38` +
  `eb2ee0f3` + `49c7bab4`) — the record was carrying a status drift, which is
  exactly what the Ground-Truth rule names.

The step-10 probe's own first draft was wrong in a useful way and the correction
is recorded: it labelled one leg "pre-canonicalization" and expected the reorder
corpus to fracture there. It did not, because the canonicalization that removes
the false fracture lives one layer down in the hash input, which both legs share.
The numbers were right and the label was a claim.

## Verification

RED-first, per FID. Reverting `gateway.ts` alone restores the original red in
full — `3964 pass / 18 skip / 4 fail`, exit 1, with
`openrouter-models-lookup.test.ts:34` receiving `"OpenAI: GPT-5"` — and the two
cache-ownership pins fail (`0 pass / 2 fail`). Reverting `test-setup.ts` alone
fails the config-dir pin (`Expected: false` / `Received: true`). Reverting the
ChatAnywhere merge fails its membership pin. All restored green.

Post-fix: `cli` suite `3969 pass / 18 skip / 0 fail` across 482 files;
`typecheck cli` and `typecheck common` exit 0; `quality:report` PASS after the
300-line splits; `learnings:check` PASS (42 structured); `lint:md` exit 0;
`provider-parity-check` PASS with the live census reporting **`chatanywhere: 27`**
and "every modelsRef provider contributes rows"; `scripts/__tests__/provider-catalog-parity.test.ts`
8 pass / 0 fail.

## Boundaries stated rather than claimed

- The **provider-side cache hit ratio** is not measured and cannot be here. The
  instrument-level prefix-stability ratio is, and it is what step 10 reports.
- The Anthropic beta directives are **not implemented**. The evaluation concludes
  they have no subject in this harness; the reopening condition (a tool set that
  mutates after a run's first provider call) is recorded in the step.
- The `⭐ FREE KEY` section's behaviour is pinned by tests, not by looking at the
  rendered picker — no TUI smoke was run this pass.
- `docs/design/Savant_ECHO Cache Optimization Research.md` and
  `docs/design/hindsight-extraction-brief.md` remain untracked inputs this pass
  does not touch; `docs/archive/reports/echo-astra-review-2026-10-06.md` likewise.
- Nothing was pushed and no release was cut.
