# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

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

## Task 60 — stampReceipt EOF fingerprint edge (2026-09-16) — CLOSED

> FID-2026-0916-003 authored, implemented RED-first, closed + archived with
> a 9/9 receipt incl. LIVE e2e both legs (commit `4aa30ab6`). Full record in
> the FID + session summary `2026-09-16-1945`.

## Task 58 — quality:report in the FID closure gate battery (2026-09-16) — CLOSED