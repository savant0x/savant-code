# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

## Task 65 — FID the handoff process findings (2026-09-18) — LOOP 2/3 DONE, G2 PENDING

> Operator picked from the FID-2026-0918-004 handoff pending menu: "3" =
> author FIDs for the process findings that surfaced in the incident report.
> Both findings sit on the learning agenda (EHEL circular block, recurrence
> 2; FID verification-contract gap, recurrence 1).

- [x] **T65-A.** RED: evidence gathered from primary sources (not just the
      summary's attribution): `pre-write-gates.ts` Law 3 block + exempt-path
      scope, `tool-pipeline.ts` credit path, `turn-end.ts` Law 15,
      `echo-compliance.ts` endingTurn-only tracker, `scripts/fid-verify.ts`
      gate-only surface, FID-2026-0918-004's prose-vs-gates mismatch.
- [x] **T65-B.** FID-2026-0918-005 authored (EHEL Law 3 circular block,
      high; two-part target-dirty/other-dirty rule proposed). Status
      `analyzed`; implementation blocked on operator approval of GREEN.
- [x] **T65-C.** FID-2026-0918-006 authored (FID verification-contract
      gap, medium; narrow contract sweep + template + solo-checklist fix
      proposed). Status `analyzed`; implementation blocked on operator
      approval of GREEN.
- [x] **T65-D.** Operator approved all three ("Implement all three FIDs
      005, 006, 007 through Perfection Loop 2/3 with receipts") — all
      implemented 2026-09-18, Loop 2/3 complete, receipts stamped from
      real gate runs (statuses `verified`):
      **005** two-part Law 3 rule (target-dirty hard block + other-dirty
      advisory) via `pre-write-gates-law3.ts` extraction; credit-mechanism
      repro pin landed (detection-only, exit-code-blind — answers the FID's
      open item). **006** contract sweep
      (`fid-verification-contract-sweep.ts` + `scripts/fid-check.ts`)
      wired into validator + `--check`; fixture suites + live `--check`
      negative proof; FID-006 validates under its own contract. **007**
      PATH-fallback candidate (memoized, injectable probe) +
      workspace-correct throw/executor text; live sandbox proof (throw,
      fallback, vendored-first). Closure+archive per G2 pending commit
      authorization.
      **Routed candidates (flagged in Loop 2 ADVERSARIAL):**
      (1) verification crediting is exit-code-blind — a FAILING typecheck
      discharges Law 3/Law 15 (pre-existing FID-2026-0819-001 design) —
      **promoted to FID-2026-0919-015 2026-09-19 (operator directive),
      then implemented same day on operator approval ("Approve implementing
      FID-2026-0919-015 through Loop 2/3 with receipts"): outcome-aware
      crediting via a `commandSucceeded` signal threaded through the
      afterToolCall bag from both call sites (native + custom/MCP parity);
      credit only on success, withhold + advisory on unknown, silent
      withhold on failure; repro pin flipped + 6-test suite; receipt
      stamped 6/6 from live gates, status `verified`.**
      (2) gates parser accepts `gate: test <path>` whose path existence is
      unchecked in the `--check` structural scan (caught only at `--write`).
      **Operator decisions 2026-09-19:** (a) FID-007 part 3 (install-time
      vendor guarantee) — APPROVED, implement now; (b) G2 commit — NOT
      YET, withheld (nothing committed until operator says so).

- [x] **T65-E.** (Approved 2026-09-18, operator: "nothing is out of scope,
      add it") FID-2026-0918-007 authored (code_search ripgrep vendor gap —
      fail-closed resolver with no PATH fallback + no install-time vendor
      guarantee; 13 recurrences; two-surface distinction recorded, outer
      client surface is operator-env-remediation only). Status `analyzed`;
      implementation blocked on operator approval of GREEN (part 3
      install-hook is an operator policy decision inside the FID).

## Task 66 — System audit: Orchestrator→agent flow + security (2026-09-19) — SEC FIDs IMPLEMENTED, G2 PENDING

> Operator directive: "I am going to audit the system. Review the full
> flow of information from the orch to all agents. Along with any
> security issues I need to address. Then create a report." Operator
> also supplied `docs/security-audit-orchestrator-agent-flow.md`
> (2026-09-18, analysis-only, unimplemented) — "this report needs to be
> addressed."

- [x] **T66-A.** Agent's own 2026-09-18 report verified against the live
      tree (all 7 findings re-proven file:line; see report appendix).
- [ ] **T66-B.** FID-007 part 3 implementation (approved decision above).
- [x] **T66-C.** All 7 SEC findings FID'd (0919-008…014). Operator
      approved implementing six ("Approve implementing the six SEC FIDs
      in the recommended order") — ALL IMPLEMENTED 2026-09-19, receipts
      stamped from real gate runs, statuses `verified`:
      **010** span-scoped redirect waiver (worked example rejected);
      **008** `buildChildEnv` allowlist at both spawn sites (sentinel
      credential proven absent from the child via real spawn);
      **011** value-shape secret masking (prefixes + KEY=value + entropy,
      output fields, pre-fan-out); **014** destructive-command floor in
      every mode incl. dev override; **012** `signing_failed` event +
      unaudited-write counter + loud binding catches; **013** capability
      clamp for database templates (fail-closed, local templates
      untouched). 0919-009 (SEC-2): layer 3 (sanitization boundary)
      **DECLINED** by the operator 2026-09-19 — residual
      indirect-injection risk through inherited history is accepted and
      recorded in the FID (mitigating context: the channel's two
      weaponizable downstream payloads are closed by 008 and 010);
      layers 1-2 remain available on request, not approved.
- [x] **T66-D.** Report updated with §6 verification appendix + FID
      mapping; session summaries recorded.
- [x] **T66-E.** FID-2026-0919-015 (exit-code-blind crediting) implemented
      + verified 2026-09-19; see its session summary.
- [x] **T66-F.** FID-2026-0919-016 authored + implemented (operator
      reported `kiosapi/grok-4.6-free` showing 2000.0k vs OpenRouter's
      500k, then directed "fid+perfection loop"). Root cause live-proven:
      (a) `toCanonicalModelId` stripped only the legacy trio prefix —
      kiosapi/ ids missed every exact branch; (b) the version-blind
      family fallback (first id-sorted hit) resolved grok-4.6 to
      x-ai/grok-4.20's 2M window. Fix: registry-driven prefix stripping
      + exact-version preference in both family branches of
      `lookup.ts`. LIVE e2e (real module, real 447-model catalog):
      kiosapi/grok-4.6-free → 500000 / source 'catalog' / max-output
      450000. Gates: FID suite 7/0, sibling suites 61/0 (11 files),
      typecheck ×2, eslint 0, lint:md 0, quality PASS (after compressing
      lookup.ts back under the 300 ceiling), receipt 3/3 via `--write`,
      `--check` PASS.
- [x] **T66-G.** FID-2026-0919-017 authored + implemented (2026-09-19
      resumed session; operator approved the amended GREEN). The
      compaction panel pinned above the input because CompactionSignal —
      the last child of the sticky-bottom scrollbox — painted terminal/
      advisory phases as a fake last message, and the retirement drop
      keyed on the drifting `percentUsed`. Fix: in-flight-only slot
      (compacting only), outcome-identity drop (percent-blind epoch,
      null-guarded), no-orphaned-outcome sidebar labels (blocked /
      ineffective added to formatCompactionStatus), in-flight-only slot
      comment in panels.tsx. Gates: typecheck cli 0, signal 9/0,
      retirement 10/0, format 6/0 (new suite), quality PASS, eslint 0,
      lint:md 0, prettier clean; receipt 5/5 via `--write`, `--check`
      PASS (fingerprint sha256:b1ec125e…). Grounding found two defects
      in the FID itself (A1 gate-path .ts/.tsx mismatch, A2 orphaned
      blocked/ineffective outcomes) — both folded into the converged
      doc before implementation. G2 commit withheld.

## Task 64 — Free-routing scanner optimization (2026-09-18) — RELEASE-DAY

> Operator directive: "today we're going to release, however we need to
> optimize the free routing scanner process." Operator picked option C:
> bounded-concurrency probe pool today + cadence FID for approval.

- [x] **T64-A.** FID-2026-0918-001 authored + implemented (RED-first):
      bounded-concurrency pool (6) for both harvester probe sites
      (probe-merge phase + Stage-E health). Stage-E split to
      `lib/health-probe.ts` (300-line ceiling). Gates: probe-pool 9/0,
      providers tree 110/0, eslint 0, quality PASS, LIVE `--probe` run
      exit 0 (13.7s, 214 records, ~43 probes), receipt stamped 5/5.
      Closure+archive pending the operator commit (G2).
- [x] **T64-B.** FID-2026-0918-002 authored + IMPLEMENTED on operator
      approval (RED-first, 9/0 pins): 3-day re-probe cadence for
      `boundary-unverifiable` hosts — `shouldReprobeUnverifiable` gate +
      `lastProbeAttemptUtc` (type/parse/diff carry-forward/write-back).
      LIVE double-run proof: run 1 stamped 40 hosts, run 2 probed none
      (zero timestamp diffs; wall clock 14.0s → 1.13s). Receipt 5/5
      (typecheck common, probe-cadence, harvest-core, probe, quality).
      Closure+archive pending the operator commit (G2).

## Task 62 — Provider identity re-gauntlet (2026-09-16) — IN PROGRESS

> Operator directive (pick from the post-Task-58 suggestion menu): re-run the
> identity-audit gauntlet on the surviving gateway channels that were never
> identity-audited since integration (tokenrouter, tokenharbor, commandcode,
> opencode-go). Operator amendment: "i dont usually save the keys in
> .env.local, so i need you to add the placeholders and i'll fill out the
> keys; however you can self drive it using tmux too" — placeholders appended
> to .env.local (append-only, values never echoed, Law 12); tokenrouter runs
> NOW via its existing credentials.json key; the other three wait on the
> operator filling the placeholders. Key-name inventory done by grep on
> key NAMES only. Scripts gitignored in dev/scratchpad/active/.

- [x] **T62-A.** Key inventory (names only): TOKENROUTER_API_KEY present in
      ~/.savant-code/credentials.json → keyed cells LIVE. TOKENHARBOR/
      COMMAND_CODE/OPENCODE keys absent everywhere → placeholders appended
      to .env.local (operator fills). GOROUTER/TABITOKEN/VYCEAI/APINEX keys
      exist in .env.local but those providers are NOT in the built-in
      registry (legacy/removed per FID-2026-0906-008 lineage) — out of
      gauntlet scope.
- [x] **T62-B.** Tokenrouter keyed cells (17 of 26 catalog ids reached LIVE
      before the account's credit pool ran dry — 403
      insufficient_user_quota): served-name + tokenizer fingerprint per
      cell; 1 chat cell per Responses-only id to confirm the FID-002
      routing claim; self-ID pass blocked by credit exhaustion (round-2
      all 403).
- [x] **T62-C.** Tokenrouter verdict (2026-09-18): COMPLETE. Round-3
      confirmed terminal exhaustion — every remaining cell (incl. gift-
      eligible gpt-oss-120b and the temperature:1 kimi-k3 param retry)
      403s with `remaining eligible quota: ＄-0.000004`; gift balance is
      itself drained, so no more cells can run. Verdict: **NO DISGUISED
      THIRD-PARTY IDENTITY FOUND, catalog ids CLEAN** (all 17 round-1
      LIVE cells served names matching the routed vendor; two round-1
      anomalies explained — kimi-k3 400 = temperature param bug, fixed by
      temperature:1 but now credit-blocked; deepseek-v4.1 503 = channel
      genuinely unavailable). Open items routed: self-ID pass incomplete
      (operator may top-up and re-run `t62-round3.ts`); FID-2026-0916-002
      Responses-routing claim confirmed for gpt-5.4 + gpt-5.3-codex
      (200, served-name passthrough).
- [x] **T62-D.** Gauntlet run 2026-09-18 (all three keys were filled by
      operator): **tokenharbor** — boundary fail-closed (keyless 401 ✓);
      roster 37 ids; static catalog 17 ids → ZERO dead (full roster
      consistency); all 3 :free identity cells 429 (kimi-k3 launch event
      ended; rolling allowance used) + NEW channel
      `deepseek-v4.1-flash:free` discovered (absent from static catalog;
      same account-level 429; reset 2026-09-19T04:32). **commandcode** —
      keyless /models HTTP 200 (fail-open boundary, security finding);
      roster 70 ids; 2 static ids case-drifted (zai-org/glm-5.2,
      zai-org/glm-5.3 — roster publishes zai-org/GLM-5.2/5.3); paid
      identity cells blocked by zero account credits. **opencode-go** —
      OUT OF GAUNTLET SCOPE: removed from Savant entirely by
      FID-2026-0916-004 (closed 2026-09-16, after this task was
      directive'd); probe of its endpoint found chat cells require a
      non-standard `x-opencode-*` session header (MissingSessionID) —
      moot for the product. **Findings routed to T61+** (below).
- [ ] **T62-followups (routed, not blocking Task 62 closure):**
      (1) commandcode catalog case-drift fix (zai-org/GLM-5.2/5.3) +
      boundary fail-open — candidate FID, operator call;
      (2) tokenharbor `deepseek-v4.1-flash:free` catalog add + free-cell
      identity re-run after 2026-09-19T04:32 allowance reset;
      (3) tokenrouter self-ID completion on operator top-up
      (`bun dev/scratchpad/active/t62-round3.ts`).
- [ ] **T61.** Cloudflare surfacing FID (grounding + Perfection Loop;
      present only).
- [ ] **T63.** Pipeline candidates → curated shortlist + proposal scaffolds.
- [ ] **T67.** [OPEN-OUT-OF-SCOPE] (discovered 2026-09-19 during the
      FID-queue review): `bun test` path arguments are SUBSTRING filters
      — passing `packages/agent-runtime/src/__tests__/spawn-agents-
      message-history.test.ts` from the repo root also swept a stale
      vendored copy under gitignored `resources/freebuff-main/`, which
      failed with a module-resolution error unrelated to the working
      tree. Workaround: run suites from their workspace root. Candidate
      FID if this bites CI or other agents; operator decides whether to
      promote.
- [ ] **T68.** [OPEN-OUT-OF-SCOPE] (discovered 2026-09-19, live kiosapi
      roster sweep `dev/scratchpad/sweep-kiosapi-defaults.ts` after
      FID-2026-0919-018): 8 of 19 kiosapi ids land on the 200k default.
      Classification: (1) case-sensitivity miss — `kiosapi/Qwen/Qwen3-8B`
      vs catalog `qwen/qwen3-8b` (131,072); (2) vendor-known window with no
      fallback row — `kiosapi/atria-dawn-preview` (upstream 262,144 per
      FID-2026-0916-005, and `kiosapi/` is a second gateway selling the
      same upstream); (3) six genuinely OpenRouter-absent ids with silent
      rosters (agnes-2.0/2.5/3.0-flash, big-pickle, sensenova-6.8-flash-
      lite, diffusiongemma-26b-a4b-it) — honest default per
      FID-2026-0914-002; web research for vendor windows is optional.
      Operator decides: promote (1)+(2) to a FID, research (3), or accept.

## Task 60 — stampReceipt EOF fingerprint edge (2026-09-16) — CLOSED

> FID-2026-0916-003 authored, implemented RED-first, closed + archived with
> a 9/9 receipt incl. LIVE e2e both legs (commit `4aa30ab6`). Full record in
> the FID + session summary `2026-09-16-1945`.

## Task 58 — quality:report in the FID closure gate battery (2026-09-16) — CLOSED