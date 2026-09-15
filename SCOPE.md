# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

## Task 51 — Bazaarlink identity-audit gauntlet + prorisehub propose (2026-09-15)

> Operator directives: "Run the identity-audit gauntlet on bazaarlink's free
> channels before integrating" + "Registry-propose newapi.prorisehub.com
> next". Interpreted scope: keyed gauntlet on the 3 free channels
> (auto:free, deepseek/deepseek-v4-flash-0731free:free,
> qwen/qwen3.7-flash:free) per the Tasks 43/44 precedent — tokenizer
> fingerprint (fixed string, injection tell), served-name from the
> response `model` field, self-ID EN + ZH, leak probe, routing variance
> ×3 on auto:free — ~15 calls of the 50/day budget. Prorisehub: propose
> scaffold only (Stage C). FID authoring follows AFTER gauntlet results;
> the curated model-set ruling is taken via ask_user before authoring.
> Personal-use intelligence; zero product code; key never printed (Law 12).

- [x] **T51-A.** SCOPE logged (this block); intent recorded before coding
      (Law 8).
- [x] **T51-B.** Prorisehub propose scaffold generated + hygiene-placed
      (dev/scratchpad/archive/2026-09-15-provider-proposals/).
- [x] **T51-C.** Gauntlet run (15 cells, serial, ~13 of the 50/day
      budget). Evidence below; script gitignored in scratchpad/active/.
- [x] **T51-D.** Verdict presented; operator ruled "Qwen free only" via
      ask_user; **FID-2026-0915-006 authored** (created; one-model static
      catalog per the ruling; gauntlet evidence embedded; 5-gate declaration).
- [x] **T51-E.** FID-2026-0915-006 IMPLEMENTED (operator "Implement
      FID-2026-0915-006"): RED-first widened closed-world pins (2 failing
      captured); registry entry + catalog map + MODEL_CATALOGS + shim +
      fallback table + cli fetcher + gateway merge; MQ3 amended to `strip`
      with evidence; 8 docs surfaces synced; typecheck ×4 + 12-workspace
      test chain 0 fail + eslint/prettier/lint:md/docs-check/quality all
      green; Step-5 LIVE keyed round-trip via the production chain PASS
      (exact echo, no injection class); 5-gate receipt stamped. Status
      `fixed`; archive awaits operator closure (G2).

## Task 50 — Exclusion-list review + zenmux re-rank (2026-09-15) — REVIEW ONLY

> Operator directives: "Wait for a harvest run to verify zenmux.ai's auth
> boundary, then re-rank" + "Review the discovery pipeline's exclusion lists
> for over-blocking". Zero code changes; findings recorded, fixes are
> separate Law-2 approvals.

- [x] **T50-A.** zenmux.ai verified on a fresh LIVE run: still `unverified`
      boundary AND the latest probe failed (ring 0% this run, was 100%).
      DROPPED from the proposal shortlist.
- [x] **T50-B.** Down-class sample LIVE-verified as genuinely API-dead
      (poe.com 404 no API surface; catgpt/microsand/celebras unreachable).
      No down-class over-blocking.
- [x] **T50-C.** Relay + risky classes: exclusions upheld. Relay = the
      LLMjacking protection (api.llm7.io serves open 200 — exactly the
      class the gate exists for). Risky = the operator's MQ2 hard-exclusion
      ruling; LIVE 200s on sampled risky hosts (routerpark, freemodel.dev,
      togoapi) reflect liveness, not trustworthiness (Tasks 43/44 evidence:
      substitution + injection). Operator may optionally re-review.
- [x] **T50-D.** FINDING (audit-trail gap): 112+ feed records (98
      `categoryConfirmed:false` + 9 `monitor-directory` + 5 `free-product`)
      drop at stage-0 with ZERO audit-trail representation — the report's
      "every gate decision" claim is false for >52% of the feed.
      [OPEN-OUT-OF-SCOPE] Proposed fix: stage-0 silent-class breakdown in
      the report audit trail (counts + hosts per reason). FID on request.
- [x] **T50-E.** FINDING (feed pollution, upstream): 11 mangled host
      strings exist in the raw feed itself (host+`invite` concatenations,
      100-char `xn--` blobs). Our pipeline renders them faithfully as
      `down` exclusions; the defect is the feed's, not ours. No action.
- [x] **T50-F.** bazaarlink.ai proposal scaffold generated (propose tool;
      moved to dev/scratchpad/archive/2026-09-15-provider-proposals/ for
      scratchpad-root hygiene; 0 validator findings).
- [x] **T50-G.** Keyed curation checklist COMPLETE (operator added
      BAZAARLINK_API_KEY): docs base pinned `api.bazaarlink.ai/v1` (two
      aliases verified equivalent LIVE, identical 174-model roster);
      keyed 200 with vendor-published context_length (free channels:
      deepseek-v4-flash 1,048,576 / qwen3.7-flash 1,000,000; auto:free
      dynamic); `auto:free` round-trip HTTP 200 `"cost": 0` (~88 tokens
      of routing metadata injected — transparency note); named `:free`
      channel 402-by-design on zero credit (quota-then-paid per vendor
      docs); free tier 10 RPM / 50 req/day from the vendor's live config
      (blog's 150/day stale); privacy policy: prompts never stored,
      never trained on, keys SHA-256-hashed, upstream-provider training
      caveat explicit. Evidence in the scaffold file. Registry
      integration remains a separate Law-2 approval.

## Task 49 — Operator seed intake into the discovery pipeline (2026-09-15)

> Operator directive: "expand our free provider list" with a pasted 24-URL
> list (21 unique hosts). Rulings recorded via ask_user: seed as tracked
> candidates (flow-injection into the harvest stream — the only mechanism
> that survives diffCandidates' absent-from-feed drop); probe from site
> root; default category commercial-aggregator; skip chatanywhere.tech
> (respected free-relay exclusion) and the three integrated providers
> (orcarouter/infron/unorouter already live in the registry). FID
> authored: FID-2026-0915-003 (analyzed, awaiting Law-2 approval).

- [x] **T49-A.** Grounding + LIVE probe evidence gathered (read-only,
  pipeline UA): 18 of 19 candidate hosts probed; boundary 401/403 ×7,
  open-200 model lists ×4, redirect/POST-only/502 hosts flagged for the
  pipeline's manual-redirect probe. Evidence recorded in the FID.
- [x] **T49-B.** Disposition per operator rulings: 16 seeds + 5 skips
  (integrated ×3, feed host, chatanywhere). URL normalization recorded
  (dashboard/profile suffixes stripped to site roots).
- [x] **T49-C.** FID-2026-0915-003 authored + ledger row added (analyzed).
- [x] **T49-D.** Implementation COMPLETE (operator automation directive
  2026-09-15 approved all pending FIDs + full Perfection Loop + archival):
  `seed-hosts.ts` (16 SeedCards, operator-precedence merge — corrected
  LIVE after run 1 exposed feed-precedence silently defeating 2 rulings),
  harvest merge seam + first-sight provenance rows, 6 pins. Gates: 5-gate
  receipt stamped (typecheck cli/common, discovery-seams + harvest-core,
  LIVE probe); pipeline suite 82/342/0 fail; LIVE runs: 16/16 seeds
  tracked (8 boundary-ok, 6 unverifiable, 2 open-relay-rejected — b.ai,
  platform.experientiallabs.ai; safety gate unchanged). FID archived with
  002. Commit `bebc6c1a`.
- [x] **T49-E.** Typosquat tier-2 adjudication (operator pick, 2026-09-15):
      `api.cohere.ai` ruled a legitimate vendor host — LIVE evidence:
      same IP (34.96.76.122) serving byte-identical 401 JSON as
      api.cohere.com; the Cohere SDK ecosystem documents
      `https://api.cohere.ai/v1` as the default base URL (the brand
      cannot impersonate itself). `LEGITIMATE_ALLOWLIST` extended
      deliberately (the FID-2026-0914-003 mechanism for exactly this
      class, same as `api.z.ai`); allowlist pin added to
      harvest-core.test.ts (impersonator lookalikes still flag).
      LIVE rerun: flags 7 → 6, cohere cleared from the audit trail,
      candidate tracking unchanged. Simple-task path — no FID.
- [x] **T49-F.** Remaining 6 typosquat flags adjudicated (operator pick,
      2026-09-15) — all legitimate, two classes: (1) canonical vendor API
      hosts absent from VENDOR_HOSTS — api.ai21.com (AI21 Labs/Jamba,
      documented base api.ai21.com/studio/v1, LIVE FastAPI JSON 404) and
      api.bfl.ai (Black Forest Labs/FLUX, documented host, image-gen API
      with no /v1/models by design) — added to VENDOR_HOSTS (now also
      screen future lookalikes; pins prove single-char lookalikes reject
      at tier 1); (2) brand apexes of already-listed vendors —
      fireworks.ai, hyperbolic.xyz, novita.ai (LIVE: apexes serve web
      frontends while their api.* hosts answer in the vendors' API
      dialects) plus operator-integrated orcarouter.ai (FID-2026-0911-002)
      — added to LEGITIMATE_ALLOWLIST. LIVE rerun: flags 6 → 0, all
      candidates still tracked. Simple-task path — no FID.

## Task 48 — Scratchpad-clutter hygiene remediation (2026-09-15) — DONE

> Operator directive: "Fix the scratchpad-clutter hygiene items flagged by
> validate:repository" (the 4 items flagged [OPEN-OUT-OF-SCOPE] at boot,
> now scoped in). Rule: `scripts/hygiene.ts` collectScratchpadIssues —
> scratchpad root must stay README + active/ + archive/ + .gitkeep.

- [x] **T48-A.** Moved all 4 root artifacts (day1-announce-key.txt,
      day1-candidates-snapshot.json, fa-sites.json,
      typecheck-chain-2026-09-15.log) to
      `dev/scratchpad/archive/2026-09-15-audit-artifacts/` — retention
      preserved (hygiene never deletes).
- [x] **T48-B.** Corrective note added to the 2026-09-15-1800 session
      summary (the only tracked file referencing a moved path); git grep
      confirms zero other tracked references.
- [x] **T48-C.** `validate:repository` re-run: 15 → 11 issues; zero
      `[hygiene.scratchpad-clutter]` findings remain.

## Task 47 — Implement FID-2026-0915-002 file-cap split program (2026-09-15) — IMPLEMENTATION

> Operator directive: "Approve implementation of FID-2026-0915-002 (file-cap
> split program) and begin GREEN." Approved scope: implement the converged
> FID exactly as authored — 11 over-cap files split along their documented
> existing seams (move-only + re-export facades; embeddedHelpers Batch B for
> the context-pruner trio; describe-boundary test splits with assertion
> parity) — plus the exit-criteria gates (quality:report PASS, 12-workspace
> typecheck, suites, eslint/prettier/lint:md, LIVE harvest rerun) and the
> FID metadata normalization flagged at boot (status `converged` →
> `analyzed` + two missing template headings), pending the operator ruling
> below. Git execution remains operator-side (G1).
>
> **Operator rulings (FINAL, 2026-09-15):** (1) COMMIT C1 FIRST — and the
> AGENT executes the commit series (stage/commit/push), per the operator's
> correction "the agent pushes, not the user" (the 2026-09-05 G1 amendment
> permits agent-executed granular commits to origin main; force-push and
> release mutation remain prohibited). (2) FID-2026-0915-002 header status
> → `analyzed` (the admissible active-queue value) + the two missing
> template headings. The operator's vocabulary observation ("converged =
> the perfection loop is completed; `fixed` is old language") is recorded
> as [OPEN-OUT-OF-SCOPE] — separate disposition, not Task 47 scope.

- [x] **T47-A.** Operator rulings FINAL (2026-09-15): C1 commits land first
      AND the agent executes them (agent pushes — G1 amendment); FID header
      → `analyzed` + two missing headings; vocabulary modernization
      recorded as [OPEN-OUT-OF-SCOPE], not implemented this task.
- [x] **T47-B.** FID-2026-0915-002 metadata: header status → `analyzed` +
      `### Missed Questions` + `### Code Verification Evidence` added;
      ledger row updated; `validate:repository` re-run — 18 → 15 issues,
      zero fid.* findings. (Later superseded by T47-G: status → `fixed` at
      closure per the operator's vocabulary ruling.)
- [x] **T47-C.** Pre-split baselines captured: pipeline suites 76 tests /
      216 expect() / 0 fail; agents phase-1+serialization 45/115; full
      agents suite 342 tests / 901 expect() (stash-verified at clean HEAD);
      root gate 421 tests / 5737 expect() / 67 files. Law-4 consumer maps
      via git grep (code_search tool was misbehaving this session — grep
      fallback per Loop discipline).
- [x] **T47-D.** All 12 splits DONE, move-only on pinned seams: rows 1-5
      (discovery-state 640→268/157/257; harvest 589→214/160/90/288; report
      423→247/65/176; test suites split with exact 76/216 parity) + rows
      6-8 via Batch B embeddedHelpers (preserved-state 362→286/111,
      structured-summary 324→268/89, summarize-messages 310→244/112;
      handle-steps.ts registers the 3 new modules; serialization tests +
      prebuild:agents bundle regeneration green) + rows 9-12 (right-sidebar
      301→272/43; run-results 326→261/77; spawn-agent-inline
      309→273/144; provider-wizard-steps 301→89/243). Rows 2/3/4 each went
      one seam deeper than planned (measured shortfall recorded in the FID
      Lessons); row 9 destination renamed to right-sidebar-header.tsx
      (recorded deviation).
- [x] **T47-E.** Gates all PASS: quality:report `PASS (1498 baselined
      files)`; root typecheck exit 0 + per-workspace chain exit 0; root test
      gate 421 pass / 0 fail / 5737 expect(); eslint `--max-warnings 0`
      exit 0 (12 split-residue warnings fixed); prettier + lint:md exit 0;
      all re-verified after the prettier reformat.
- [x] **T47-F.** LIVE `providers:harvest --probe` exit 0 — 214 records →
      55 stage-0; all report sections render; candidates.json
      `_meta.version: 2` — shape parity confirmed.
- [x] **T47-G.** FID → `fixed` with full Code Verification Evidence +
      Lessons; ledger row updated (fixed, implementation complete, awaiting
      operator archive); 8 path-scoped code commits `67e77d37` → `9fbe5364`
      + records commit (hashes in the FID Resolution); push executed by the
      agent (G1 amendment).

- [ ] **[OPEN-OUT-OF-SCOPE] FID status-vocabulary modernization:** operator
      observation "converged = the perfection loop is completed; `fixed` is
      old language" — a repo-wide vocabulary update (template, ECHO.md,
      ledger script, LEARNINGS grammar) is a separate operator-approved
      change; NOT in Task 47 scope.

## Task 46 — Infron + UnoRouter gateway providers (2026-09-14) — CLOSURE

> Operator directive: "i want to add this provider https://infron.ai/docs,
> review the docs and review my system for adding new providers.
> https://infron.ai/models, i need all the free ones
> https://infron.ai/models?free=true, then the top coding models as well
> added" — extended mid-session with "i also want to add this provider as
> well https://unorouter.com/en/models, w/ all the free models and the top
> 10-20 coding models". Interpreted scope: runbook + registry review, live
> catalog + keyed probes on both vendors, FID-2026-0914-001 authored with
> the Perfection Loop, present. Implementation is a separate Law-2 approval.
> Operator rulings this session (ask_user): Infron free set = "4 clean
> :free only"; UnoRouter free set = "Core ~12 curated"; Codex/Responses-only
> family excluded ("Chat only"); keys created by the operator this session
> (INFRON_API_KEY / UNOROUTER_API_KEY in .env.local — values never printed,
> Law 12).

- [x] **T46-A.** Grounding: runbook read 0-EOF; FID-2026-0913-001 template
      read 0-EOF; registry/catalog/picker/test surfaces file:line mapped;
      file-cap measurements taken (three capped files force declared
      splits per FID-2026-0913-002).
- [x] **T46-B.** Live evidence: Infron keyless catalog 458 models (free
      filter is UI-only; 5 free text models by price-0 determination);
      keyless 401 fail-closed both hosts; keyed probes show the key
      AUTHENTICATES but the account is unfunded (paid 403 credits, free
      429 team-balance ≥ $5) — OrcaRouter-pattern NEEDS-REVIEW. UnoRouter:
      QuantumNous New API fingerprint; docs contract (BASE_URL api.
      unorouter.com/v1, :free never bills, 429s at peak documented);
      catalog 231 rows / 128 free / 89 chat-eligible; keyed gauntlet = 5
      free channels HTTP 200 clean, rest busy-class only (zero
      model_not_found).
- [x] **T46-C.** FID-2026-0914-001 authored RED-first; Loop 1 + Loop 2
      recorded (Loop 2 self-caught + fixed the claude-haiku-4.5 fc=N
      defect → gemini-3.1-pro-preview swap); lint:md + prettier green;
      ledger row added.
- [x] **T46-D.** PRESENT the FID for operator approval (blocking — Law 2).
      Presented in chat 2026-09-14; operator ruled: "that's fine, go ahead
      and fully implement then close them once done and update the
      changelogs" (approval + closure + CHANGELOG in one directive).
- [x] **T46-E.** IMPLEMENT (Law-2 approved): RED-first pins across 4 test
      suites → GREEN (registry +2, gateway-catalogs +2 maps, model-catalogs,
      model-config shim, new picker module `static-catalogs-gateways.ts`,
      gateway merge, sdk harness warm-up fix for the one-shot `.env.local`
      bootstrap re-injection) → gates: typecheck ×4 exit 0, suites 61/0 +
      30/0 + 16/0 (baseline-parity proven via stash A/B), eslint 0,
      prettier clean, docs drift guard green, hand-maintained doc surfaces
      synced.
- [x] **T46-F.** CLOSE: Step-5 live evidence recorded (catalog 26/26 via
      production chain; UnoRouter 5×HTTP-200; Infron funding gate
      NEEDS-REVIEW per OrcaRouter precedent); receipt stamped via
      `fid:verify --write` (8/8 gates); ledger + archive README closure
      notes; SCOPE + session summary; CHANGELOG entry. Commit plan handed
      to the operator (G1/G2) — SHAs pending git execution.

## Task 45 — hcnsec + TokenBom gateway providers (2026-09-13) — FID AUTHORING

> Operator directive: "add those 2 providers and those 14 models, follow the
> same convention as other providers, make sure you update the selection
> panel, etc. you'll need to pull all the context windows, etc and do all the
> normal things as we add, make a fid for these 2 providers and the models
> then run the full perfection loop on it then present for finial approval"
> — plus clarifications: "fyi, if i spelled the key wrong you can fix it
> properly" and "https://hcnsec.cn/, is the website, then the other is
> https://tokenbom.com/". Interpreted scope: full provider-integration FID
> for the two audited gateways carrying the 14-model operator-approved
> allowlist from the identity audits (Tasks 43-E/44-C), registry entries,
> static catalogs, selection-panel derivation, context-window inference,
> docs regeneration, tests, Perfection Loop, present. Implementation is a
> separate Law-2 approval. Key canonicalization per operator permission:
> `TOKENBURN_API_KEY` → `TOKENBOM_API_KEY`, `HCNSECRET_API_KEY` →
> `HCNSEC_API_KEY` (registry grammar `{PROVIDERID}_API_KEY`; values never
> printed — Law 12).

- [x] **T45-A.** Grounding complete: runbook ("Adding New Providers.md")
      read 0-EOF; OrcaRouter precedent (FID-2026-0911-002) read 0-EOF;
      registry + registry-partitioned + types + validate + derive + audit
      manifest + model-catalogs + model-config maps/aggregate/shim +
      context-windows + gateway.ts aggregation + static-catalogs pattern +
      closed-world test lists (provider-registry.test.ts 14-provider/12-setup,
      delta-d order family) + sdk free-mode harness + provider-setup test +
      FID template + ledger + archive numbering (no 0913 FIDs yet) — all
      file:line mapped.
- [x] **T45-B.** Design decisions: STATIC allowlist catalogs (the audit IS
      the catalog — live `/v1/models` would re-expose substituted/dead
      listings the operator rejected); new `model-config/gateway-catalogs.ts`
      module (`providers.ts` sits at the 300-line hard cap; registry-partition
      precedent); TokenHarbor/CommandCode static pattern = NO wrapper file
      and NO audit-manifest entry (those are live-catalog machinery);
      `inferContextLength` reuse (step/doubao → conservative 200k default); no
      aggregate `models` spread (commandcode precedent); env keys canonicalized
      in `.env.local` (values untouched, never echoed).
- [x] **T45-C.** FID-2026-0913-001 authored RED-first with Perfection Loop
      (Loops 1-3); ledger row added; lint:md + prettier green. Loop 3
      (operator-prompted): context windows pinned per model from the
      OpenRouter catalog (13/14; heuristic wrong on 9 of 14 — kimi/
      minimax/deepseek really ≥1M, grok-4.6 500k not 1M); doubao
      conservatively defaulted + flagged; heuristic untouched as fallback
      (MQ10).
- [x] **T45-D.** PRESENT for operator approval (blocking — Law 2).
      Presented in chat 2026-09-13; operator approved IMPLEMENT with the
      context-window amendment ruling (Loop 3, applied before
      implementation).
- [x] **T45-E.** Implementation (2026-09-13): RED-first 10 failing legs
      across 4 files; GREEN = registry entries (registry-partitioned.ts),
      NEW common/src/constants/model-config/gateway-catalogs.ts, shim +
      MODEL_CATALOGS refs, picker NAMES/CONTEXT_WINDOWS maps + 2 fetch
      functions + gateway merge + barrel; gates: typecheck ×4 exit 0,
      suites 59/0 + 35/0 + 48/0, eslint 0, prettier clean, lint:md PASS,
      generate:provider-docs + check exit 0 (env vars at .env.example:99
      /:114, release README :57/:63), file caps respected (largest
      298/300); Step 5 live keyed round-trip PASS on both gateways via
      the production chain (1,378-model combined catalog, hcnsec 7/7 +
      tokenbom 7/7, pinned windows verified, HTTP 200 + clean
      prompt_tokens on both chat calls). Keys canonicalized in .env.local
      per operator permission (values never printed — Law 12).FID
      status `fixed`; closure + archive waits on the operator commit (G2).
      Probe retained in gitignored scratchpad for re-verification.
      **[Ground-truth update 2026-09-13: commits `5e8cd5c8` (implementation)
      + `259e8d59` (records) landed per operator approval; FID-2026-0913-001
      CLOSED + archived same day (ceremony commit `106232db`).]**

## Task 43 — hcnsec.cn provider assessment (2026-09-12) — ASSESS ONLY

> Operator directive: "I am interested in adding/testing a new provider
> https://api.hcnsec.cn/ ... then look at my docs about adding providers, this
> one seems a bit odd." Operator saved a key at `.env.local` under
> `HCNSECRET_API_KEY`. Interpreted scope: re-read the single-agent ECHO
> protocol (done at boot), read the provider runbook (docs/archive/design/
> "Adding New Providers.md"), ground-truth the registry machinery, run live
> keyless + keyed probes against https://api.hcnsec.cn (models list, chat
> completion, streaming), assess the odd/trust factors, and present
> integration paths (built-in registry entry vs the existing custom-provider
> wizard). **Zero code changes** — any integration is a separate Law-2
> approval. Key handling: read from .env.local into shell vars only, never
> echoed into output/logs (Law 12).
>
> **Operator clarification (2026-09-12):** hcnsec is a PAID provider — the
> account is loaded (30k credits) and live calls are approved. The goal is
> full integration: wire the complete model list and test the models. Per
> Law 2 the implementation plan (FID per the OrcaRouter precedent) is still
> presented before any code is written.

- [x] **T43-A.** Runbook ground truth: registry entry shape (ProviderConfig),
      catalog sources (static/live/inline/none), derivation surfaces,
      .env.local loading chain (common/env-bootstrap.ts + cli/pre-init),
      OrcaRouter FID-2026-0911-002 precedent located (13th provider, live
      catalog wrapper pattern).
- [x] **T43-B.** Live probes (keyed, from .env.local HCNSECRET_API_KEY):
      `GET /v1/models` (keyless 401 fail-closed / keyed 200, 18 models),
      full per-model chat matrix (15/18 OK; Qwen3.8-27B, sensenova-u1.5-lite,
      step-explore all HTTP 404 = listed-but-dead), SSE streaming (role,
      finish_reason, tool_deltas, usage chunk all correct), tool calls
      (glm-5.3-flash streamed + non-streamed; step-3.7-flash), embeddings
      (Qwen3-Embedding-8B, 2048 dims), `/v1/messages` Anthropic shim (lossy:
      burns max_tokens on invisible reasoning — do not use), `/api/pricing`
      (admin-gated, cannot verify rates programmatically).
- [x] **T43-C.** Odd-factor assessment: gateway fingerprinted as new-api
      (QuantumNous) via `new_api_error` + /api/pricing + GA comment; operator
      account is PAID despite free/public-welfare marketing; `auto` is a
      hidden meta-router that INJECTS ~1KB of gateway-controlled prompt
      content (1047 prompt tokens observed) and served poolside/laguna-s-2.1;
      model identity opacity (DeepSeek-V4-Pro request served by
      nvidia/nemotron-3-ultra-550b); latency variance 0.8s–35s (+ one 354s
      response observed in their own playground); Xinjiang-registered
      operator (新ICP备2026002340号-1), no Western accountability surface.
- [x] **T43-D.** Assessment + integration paths presented (below, blocking —
      Law 2): built-in 14th provider (OrcaRouter precedent) vs. zero-code
      custom-provider via the shipped /provider add wizard. Operator to pick.
- [x] **T43-E.** Operator follow-up (ask_user custom answer): "they are not
      using the actual models it claims? Do a full model by model check to get
      to the bottom of this." Interpreted scope: extend Task 43 with a
      model-by-model identity audit — four evidence classes per model
      (self-ID EN/ZH, system-prompt leak probe, tokenizer fingerprint via
      fixed-string prompt_tokens, upstream served-name + routing variance).
      Evidence captured in two scratchpad runs (parallel pool + gap-filler);
      kimi-k3 fingerprint cell unknown (timeout); spark-x2.5 EN cell empty
      (fin=length, reasoning-only model). Full verdict presented below in
      chat. Findings: gateway injects operator-controlled system prompts on
      5+ channels (939c ChatGLM persona, 950c "Ponytail" lazy-dev persona,
      2117c agentic harness with a phantom `advisor` tool, 310c SenseNova
      identity+reasoning-effort prompt, ~1K tokens on longcat/DeepSeek-V4-Pro);
      DeepSeek-V4-Pro is substituted by nvidia/nemotron-3-ultra-550b (EN
      self-ID admits Nemotron; ZH self-ID names the gateway operator); spark-
      x2.5-4b self-IDs as a company that is not iFlytek (4B params ≠ Spark
      X2.5); longcat-2.0 EN self-IDs as Claude vs ZH LongCat (OpenRouter
      :free upstream); 3 dead listings confirmed. Zero code changes; no
      integration decision taken pending operator review.
- [x] **T43-F.** Operator ruling (2026-09-12): "I don't really trust that at
      all, if it shows a single lie, I'd expect for the entire platform to be
      a lie. Skip it, I have other options." **Task 43 CLOSED — hcnsec.cn is
      NOT integrated.** No registry entry, no FID, no code. Audit evidence
      remains in gitignored `dev/scratchpad/active/hcnsec-*.ts` for the
      operator's records; `HCNSECRET_API_KEY` left in `.env.local` at the
      operator's discretion (unused by any Savant surface).

## Task 44 — tokenbom.com review (2026-09-13) — REVIEW ONLY

> Operator directive: "check out this website https://tokenbom.com/".
> Interpreted scope: characterize the service (public pages, keyless API
> probes), assess fit/risk against the hcnsec bar (Task 43), present. Zero
> code changes; integration would be a separate Law-2 approval. No account
> created; no key held.

- [x] **T44-A.** Characterization complete (see chat): quota-resale
      marketplace, 110 listed / 104 available, keyless /v1/models + rich
      /api/models market telemetry, three protocol surfaces verified
      (OpenAI/Anthropic/Gemini error dialects correct), sk-sub- virtual keys,
      credit pricing, explicit no-SLA disclaimer. Risk class: ToS/provenance
      (anonymous upstream quota) higher than hcnsec; transparency higher.
- [x] **T44-B.** Operator follow-up (in the community-free-provider framing):
      "what are the risks of using this?" Interpreted scope: present the risk
      assessment (personal use vs. community-release default), still review-
      only. Assessment presented in chat 2026-09-13: risks are structural
      (anonymous rotating upstreams, ToS-violating resale layer, no SLA/entit
      y/terms, prompt-injection + substitution unverifiable under multi-supplier
      routing), NOT currently behavioral (no observed scam signals; protocols
      clean). Recommendation recorded: not as a community default/partnership;
      gauntlet remains available for personal-use evaluation; first-party
      free-tier partnerships suggested as the actual community path.
- [x] **T44-C.** Operator ruling: "Run the identity-audit gauntlet on
      TokenBom with a key I create, for personal-use data only." Key exists
      in .env.local as TOKENBURN_API_KEY (sk-sub- virtual key). Interpreted
      scope: keyed gauntlet, personal-use intelligence only, NOT a provider
      integration. Adapted for multi-supplier routing: phase 1 = served-name
      + tokenizer fingerprint sweep across the whole chat catalog (1 call
      each, the cheapest universal injection tell); phase 2 = leak probes
      where the fingerprint shows injected content; phase 3 = full self-ID
      (EN/ZH) + leak on the frontier subset; phase 4 = routing variance on
      popular models (supplier rotation check).
>
> **Scope narrowing (operator, 2026-09-13):** "Check the top 15 most powerful
> coding models on the list." Gauntlet re-scoped to a 15-model coding-power
> ranking with 5 evidence cells each (tokenizer fingerprint, served-name,
> self-ID EN, leak probe, verifiable coding smoke) + routing variance x3 on
> three popular models. Known caveats recorded: gpt-4.1-nano probe returned
> model_supply_empty (marketplace supply fluctuates); the operator console's
> optional "Model fallback" feature could confound served-name mismatch
> interpretation — check it when reading results. Auth verified:
> TOKENBURN_API_KEY accepted (sk-sub- virtual key, 55 chars).
>
> **Gauntlet results (2026-09-13):** of 15: 4 no-supply/broken (claude-4.8-opus
> 503, gemini-3.8-flash 503, qwen3-coder 404→dead OpenRouter :free channel,
> claude-opus-5 empty completions on every cell); 4 substituted/version-swapped
> (gemini-3.1-pro self-IDs as Gemini 3.6 **Flash**; deepseek-v4-pro self-IDs as
> **Claude/Anthropic** with 8.4kc reasoning; qwen3.8-max self-IDs as Qwen**3.5**;
> glm-5.3 self-IDs as GLM-**4.6**); 2 with visible subscription-arbitrage
> fingerprints (gpt-5.6-luna + gpt-5.5 self-ID as **Microsoft M365 Copilot**,
> fingerprint 85 vs codex 39 = ~46 tokens of hidden M365 system prompt);
> 1 ambiguous (gpt-5.3-codex — consistent self-ID, no-echo); 4 genuine
> (minimax-m3, doubao-seed-2.1-pro, kimi-k3, grok-4.6). Coding smoke PASS on
> all serving channels except claude-opus-5 (empty). Variance x3: served names
> stable. Verdict presented; same conclusion as hcnsec — substitutions exist
> even on flagship listings; marketplace incentives did not prevent them.

## Task 39 — Pi Agent review: novel ideas worth integrating? (2026-09-12) — REVIEW ONLY

> Operator directive: watch the David Andre podcast with Pi's creator (transcript
> provided), review the checked-out `resources/pi-main` source, and identify
> anything worth using/integrating into Savant — with specific attention to Pi's
> "bash-first" thesis. Interpreted scope: research-only review presented in chat;
> **zero code changes**. Any integration that survives operator selection becomes
> a separate Law-2-approved task/FID.

- [x] **T39-A.** Transcript reviewed; claims mapped to testable mechanisms.
- [x] **T39-B.** Pi source read: agent loop, bash tool + executor, extension
      system, session tree/compaction, skills, system prompt, truncation.
- [x] **T39-C.** Savant tool-surface ground truth collected (58 handlers,
      agent-runtime) for the comparison leg.
- [x] **T39-D.** Review presented (below in chat): bash-thesis verdict + ranked
      novel-idea list with adopt / adapt / reject calls.
- [x] **T39-E.** Operator picked the deep-audit follow-up → Task 40 below.

## Task 40 — Deep audit: tool-call repair vs Pi's fail-closed truncated-args rule (2026-09-12) — AUDIT ONLY

> Operator directive (follow-up pick): "Deep-audit tool-call-repair.ts against
> Pi's fail-closed truncated-args rule and report the verdict." Pi's rule
> (`pi-main/packages/agent/src/agent-loop.ts` `failToolCallsFromTruncatedMessage`):
> a `stopReason === "length"` assistant message must have ALL its tool calls
> failed, never executed — salvaged JSON can parse yet be silently incomplete.
> Interpreted scope: read-only audit of the Savant repair/execution path with
> file:line evidence + test-run verification; **zero code changes**. Any fix
> that survives the verdict is a separate Law-2 approval.

- [x] **T40-A.** tool-call-repair.ts + tool-call-parse.ts read 0-EOF: repair
      surface = double-JSON.parse (≤3 rounds), allowlisted bare-string-field
      regex (read-only tools only, requires closing brace), path→paths alias
      normalization (parsed objects only). No salvage parser at any layer.
- [x] **T40-B.** Truncation manifests as `errorClass: 'native-incomplete'` from
      our own flush gate (flush-handler.ts:57-74) gated by
      isCompleteKnownToolCallArguments (tool-arguments.ts:66-93); XML-tag path
      holds unclosed calls in buffer and never parses at stream end
      (stream-xml-parser.ts:154-166, tool-stream-parser.ts:73-82);
      stream-parser.ts:182-184 sets the step flag; loop-iteration.ts:198-218
      drives strike counting. Repair output cannot reach execution for
      truncated inputs (regex needs a closing `}`; alias repair needs a parse).
- [x] **T40-C.** Runtime evidence: tool-call-repair + stream-xml-parser +
      chat-language-model-fail-closed suites = 32 pass / 1 fail (fail is the
      vendored resources/freebuff-main fixture missing its own node_modules,
      not Savant code). Fail-closed pins D/E/E2/E3/H/H2/H3/I/J/G all green.
- [x] **T40-D.** Verdict presented (chat): core invariant HOLDS; one residual
      seam found on the Anthropic/Google-compatible vendor paths
      (model-factories.ts:1-2,82,105 route through @ai-sdk/anthropic 2.0.50 /
      @ai-sdk/google, which emit tool-call unconditionally at content_block_stop
      — vendor dist:2659-2674 — and bypass the native-incomplete
      steering/strike/experience-capture machinery, though ai@5.0.122 core
      still marks invalid input and filters it from execution).

## Task 41 — FID for the vendor-path native-incomplete classification seam (2026-09-12) — FID AUTHORING

> Operator directive (Task 40 verdict follow-up pick): "Author a FID for the
> Anthropic/Google vendor-path seam: classify invalid vendor tool-inputs as
> native-incomplete so steering/strikes/ledger apply." Interpreted scope:
> author the FID (RED-first) in `dev/fids/`, run the Perfection Loop on the
> document, update the FID ledger, and present for approval. **No
> implementation** — the FID's implementation is a separate Law-2 approval.

- [x] **T41-A.** Next number allocated: FID-2026-0912-005 (001-004 already in
      archive); template read 0-EOF.
- [x] **T41-B.** Data flow completed: ai@5.0.122 marks invalid vendor
      tool-calls `invalid: true` and filters them from execution
      (ai/dist:1894-1907, 2378-2401); `fixJson` salvage provably NOT in the
      tool-input path (dist:3401-3411); the SDK `tool-call` branch
      (stream.ts:255-262) forwards the invalid part verbatim — that is the
      fix seam. `experimental_repairToolCall` pass-through verified
      non-interfering; n-parameter path scoped out (Missed Question 3).
- [x] **T41-C.** FID authored RED-first with Loop 1 (RED/GREEN/AUDIT/
      ADVERSARIAL) + 6 Missed Questions answered: `dev/fids/FID-2026-0912-005-
      vendor-path-invalid-tool-input-native-incomplete-classification.md`.
- [x] **T41-D.** Ledger row added to dev/fids/README.md; lint:md exit 0;
      prettier clean on FID + README + SCOPE.
- [x] **T41-E.** PRESENT the FID for operator approval (blocking — Law 2).
      Presented in chat 2026-09-12; operator approved IMPLEMENT → Task 42.

## Task 42 — Implement FID-2026-0912-005 (2026-09-12) — IMPLEMENTATION

> Operator directive: "Implement FID-2026-0912-005: RED pin test first, then
> the SDK-boundary classification fix, gates stamped." Approved scope: the
> FID's Proposed Solution as authored (Steps 1-4): RED pin test first, the
> SDK `tool-call`-branch classification reusing `normalizeNativeToolCallStreamError`,
> runtime-integration proof, typecheck ×4 + suites + receipt. Git execution
> remains operator-side (G1).

- [x] **T42-A.** RED pin test authored and observed FAILING first: 2 fail /
      1 pass (both classification legs red, valid-part leg green) — captured
      in the FID.
- [x] **T42-B.** GREEN: `sdk/src/impl/llm/stream.ts:255-292` classifies
      `invalid === true` tool-call parts via
      `normalizeNativeToolCallStreamError` (single factory, Law 13) with a
      fail-closed null guard (Law 14, typecheck-caught); ZERO runtime
      changes. 9/9 across the two sdk suites post-fix.
- [x] **T42-C.** Gates: typecheck ×4 exit 0 (cli run separately); runtime
      integration suites 16/16 (part-f, strikes, capture, steering); Law 4
      greps pasted in the FID (producer stream.ts:299 → consumer
      error-chunk.ts:64,96; factory single at errors.ts:88).
- [x] **T42-D.** Receipt stamped 5/5 PASS and re-stamped on the final text
      (fingerprint-binding rule); `fid:verify --check` repo-wide PASS; FID
      status → `fixed` with Implementation + Code-Verification evidence and
      Loop 2 (self-caught defects: null-return type, gates-grammar
      violation); ledger updated; lint:md + prettier clean. **Remaining for
      closure (G2): operator commits the changes.** **[Ground-truth update
      2026-09-13: commit `a6853358` landed per operator approval;
      FID-2026-0912-005 CLOSED + archived same day (ceremony commit
      `106232db`).]**

## Task 38 — SkillOpt + WikiSkill scoping into FIDs (2026-09-12) — PLANNING ONLY

> Operator directive: "Scope the SkillOpt integration blueprint into FIDs"
> along with "check this out as welll" pointing at WikiSkill
> (arXiv:2608.27454 + reference implementation). Approved scope: research
> both sources, ground-truth against the codebase, author the FID set,
> run Perfection Loop authoring, present. **No implementation this task** —
> each FID's implementation is a separate Law-2 approval.

- [x] **T38-A.** Supersession check: the 2026-09-10 SkillOpt session's
      corrected 6-FID reconciliation plan located (session summary); leg 1
      (payload redaction) already shipped as closed FID-2026-0909-006;
      0910-001 (notifications) shipped + closed; legs 3-6 unshipped. The
      untracked blueprint's stale FID IDs and refuted claims identified
      (component/file citations refuted by the prior adversarial pass —
      not re-cited).
- [x] **T38-B.** WikiSkill absorbed (arXiv HTML + reference repo):
      three-layer architecture (Raw/Wiki/Skills), Algorithm 1 loop
      (inference → maintainer → proposer → gate/rollback), ablation finding
      (the wiki layer is the critical component), gating contract
      (strict improvement + rollback; wiki never rolled back), and the
      reference repo's honest negatives (every live gate so far = rejection
      or no_action).
- [x] **T38-C.** Ground-truth seam verification (this session, file:line):
      trust paths append NO ledger (trust.ts:77-121); no baselineSha
      anywhere; destructive 30-day purge live (lessons-to-skills.ts:38,241,274);
      no wiki layer (ls dev/); prove machinery advisory-only
      (skills.ts:82,111); no includeMessageHistory split; VERSIONS.jsonl
      ledger IO exists in helpers.ts (reused, not rebuilt).
- [x] **T38-D.** Four FIDs authored RED-first, Perfection Loop Loop-1
      recorded: 0912-001 (ledger + drift gate) · 0912-002 (archive-not-purge)
      · 0912-003 (pattern wiki) · 0912-004 (proposer + gate-before-present,
      sequenced after 003). Deliberate rejections recorded per FID
      (optimizer model, rollouts, auto-adopt, blanket history flag).
- [x] **T38-E.** Ledger (dev/fids/README.md) + session summary updated;
      lint:md + prettier green.
- [x] **T38-F.** ~~PRESENT the four FIDs for operator approval (blocking —
      Law 2).~~ **Superseded (ground-truth correction, 2026-09-13):** the
      skill-evolution suite was approved and implemented in a later session —
      commits `bb8123a` (author) → `d95502f`/`f83ea32`/`c36db40`/`3921356`
      (one per FID) → `b34c882` (close + archive 0912-001..004, stamp
      0911-002 receipt) → `4e6b867` (session summary). Record corrected from
      the git log; presentation step moot.

---

## Task 37 — FID-2026-0911-002: OrcaRouter gateway provider (2026-09-11)

> Operator directive: "i am interested in adding support for
> https://www.orcarouter.ai/ as a provider". Approved with the prefix-
> namespace decision (`idTransform: 'strip'`).

- **Grounded (live probes, keyless):** `GET
  https://api.orcarouter.ai/v1/models` → HTTP 200 OpenAI-shaped, 195
  models; keyless chat → 401 OpenAI-shaped; docs contract (Bearer,
  `sk-orca-` prefix, base `https://api.orcarouter.ai/v1`) quoted in the
  FID.
- **FID:** `dev/fids/FID-2026-0911-002-orcarouter-gateway-provider.md` —
  Loop 1 RED + Loop 2 GREEN/AUDIT/ADVERSARIAL recorded with the
  self-caught defects (wrapper requirement; uniform-prefixing round-trip
  requirement).
- **Implemented:** registry entry (13th provider), `orcarouter.ts`
  catalog wrapper (shared-fetcher reuse), gateway merge + reset seam,
  audit-manifest entry, count-parity tests widened 12→13 / 10→11,
  harness env save/restore, `.env.example` + release README regen.
- **RED-first:** 4 failing legs + parser pins captured failing before
  GREEN. Gates: typecheck ×4 exit 0 · common 52/0 · sdk 6/0 · cli setup
  15/0 · catalog family 20/0 · parser pins 4/0 · eslint
  `--max-warnings 0` · prettier · lint:md · docs-check exit 0 ·
  validate:repository at exact pre-existing-debt parity (8 hard-cap
  violations before/after; 22 baseline bumps reconciled; 3 scratchpad
  files archived).
- **Flagged:** the 8 remaining >300-line hard-cap violations are
  pre-existing debt from FID-2026-0910-004/0911-001 growth — needs a
  separate refactor FID (file splits), not silent absorption.
- **Step 4 run (2026-09-12, PARTIAL PASS):** catalog via the real
  production chain — 195 `orcarouter/…` models, router double-prefixing
  2/2; keyed chat → 429 `free_rate_limited` (key AUTHENTICATED,
  account-level gate: "link a GitHub account or add credits"); keyless
  chat → 401 fail-closed. HTTP-200 completion is NEEDS-REVIEW pending
  the operator enabling free-tier access, then re-running
  `dev/scratchpad/active/orcarouter-acceptance-probe.ts`. Integration
  side complete — no code residue.
- **Operator ruling (2026-09-12):** OrcaRouter's dashboard exposes NO
  GitHub-link control (their X confirms the 30-day-GitHub-account
  policy; their error is ahead of their UI), and the operator declines
  the credits bypass on principle — free tier IS the trial. FID rests
  at NEEDS-REVIEW pending their UI/support; unlock request is ready to
  send via Discord (`discord.gg/yAh6Tex6kx`) or X (`@OrcaRouter`).

## Task 36 — FID-2026-0911-001: /provider picker add-new entry → wizard (2026-09-11)

> Operator directive: "when you type /provider, there should be an option in
> the drop down to add new, that opens the full wizard easily — make the FID,
> run the perfection loop and present it".

- **FID authored RED-first:** `dev/fids/FID-2026-0911-001-provider-picker-add-new-entry.md`
  — discoverability gap (picker rows are ✓/✗ only; wizard reachable only by
  typing `/provider add`) + latent silent fall-through on unknown selections
  (`use-chat-pickers.ts:174-176` unconditional `beginProviderSetup` after the
  picker already closed).
- **Loop 1 RED:** pins captured failing (export absent) —
  `cli/src/commands/__tests__/provider-picker-add-new.test.ts` (6 pins).
- **Loop 2 GREEN:** sentinel `PROVIDER_PICKER_ADD_ENTRY` in the leaf wizard
  module (reuses the `PROVIDER_GRAMMAR_WORDS` reservation — a custom id can
  never shadow it); action row appended in the `/provider` no-args branch
  (`model-provider-commands.ts`); store seed skips the sentinel;
  `provider-picker.tsx` renders the muted badge-less row; exported seam
  `handleProviderPickerSelection` (`provider-subcommands.ts`) delegated to by
  `use-chat-pickers.ts` — closes the overlay, then branches: sentinel →
  wizard at id step; unknown → explicit no-echo guidance; known → existing
  setup/activation path.
- **Loop 3 AUDIT+ADVERSARIAL:** typecheck ×4 exit 0; eslint
  `--max-warnings 0` (import/order auto-fixed, re-verified); prettier clean;
  `lint:md` PASS. Runtime: new suite 6/0 (22 expect()), regression battery
  80/0 across 9 provider-surface files. Law 4 grep: seam called from
  `use-chat-pickers.ts`, row appended in the command def, wizard entered via
  `startAddWizard` → `beginProviderWizard`; free build still gates `/provider`
  (`modes.ts:125`) — MQ1 honored.
- **Converged `fixed`;** closure (archive + CHANGELOG) is the operator's call.

## Task 35 — FID-2026-0910-004 closure (2026-09-11)

> Operator directive: "Close FID-2026-0910-004: final certification,
> archive, and CHANGELOG entry".

- **Executed:** Resolution filled (Loop 12 final certification — zero
  actionable improvements, no open NEEDS-REVIEW), status → `closed`,
  feature-scale CHANGELOG `Unreleased` entry, `git mv` to
  `dev/fids/archive/`, archive + active ledger sections updated.
- **Status:** COMPLETE.

> Operator directives: "Start the Step 9 remainder: custom catalog fetcher
> with the degradation ladder and model-picker merge" + "Close out Step 10:
> health edge sweep and the Law 4 call-graph proof for all wiring". Ordering:
> Step 9 remainder first (new wiring), then Step 10's Law 4 sweep covers all
> edges including the new ones.

- **Interpreted scope (Step 9 remainder):** `custom-catalog.ts` — per-custom-id
  live fetchers built lazily from the effective registry (reusing
  `createLiveCatalogFetcher`, Law 13), OpenAI `/v1/models` parse with
  `${id}/` prefixing, inline catalog synthesis, `none`/unknown/built-in ids →
  `[]` fail-closed; `fetchGatewayModels` merge via `Promise.allSettled`
  (failure → empty = D10 ladder rung; free-text `/model <exact-id>` always
  routes); `model-picker-grouping.ts` reads the EFFECTIVE registry so customs
  resolve their D9 order-5 (built-in-only read would tie them at 4);
  `/model` picks customs up through the merged gateway catalog with zero
  command-def changes.
- **Interpreted scope (Step 10 closeout):** health custom-provider pins
  (already on disk from the interrupted session — verify, not redo); full
  Law 4 grep proof over every production wiring edge (registration → merge →
  consumers) incl. the repo-validation built-in-only grep; FID checkbox
  closure + status.
- **Status:** COMPLETE — Step 9 remainder GREEN (8/0 new pins; RED captured
  module-absent first), typecheck ×4 exit 0, eslint/prettier clean; Step 10
  health pins verified 8/0; Law 4 sweep grep-complete (all edges incl. new
  fetcher + repo-validation built-in-only proof); FID Loop 10/11 records
  landing with the commits.

## Task 34 — FID-2026-0910-004 Step 9 remainder (catalog fetcher + ladder + merge) + Step 10 closeout (2026-09-11)

> Superseded by Task 35 closure; record retained for the audit trail.

## Task 33 — FID-2026-0910-004 Loop 9: TUI-smoke secret-leak fix (replay guard) (2026-09-11)

> Discovered during the Task 32 winpty TUI smoke (operator directive: manual
> TUI smoke when a pty is available): a duplicated/replayed wizard submit from
> the pty layer landed after the terminal step restored `default` mode and fell
> through to the regular-message path — the pasted key reached the up-arrow
> recall history and one answer was dispatched to the agent as chat. Law 12
> violation; fix is in-scope under the standing secret-hygiene requirement.

- **Interpreted scope:** one-shot TTL replay tombstone in `provider-wizard.ts`
  (`markWizardSubmissionConsumed` / `isWizardSubmissionReplayed` /
  `clearWizardReplayGuard`, injected clock, command-shaped payloads excluded);
  mark-on-consume in `route-provider-wizard.ts`; drop guard in
  `route-user-prompt.ts` before any persistence/send; RED-first pins incl. a
  router-level replay-drop pin; FID Loop 9 record.
- **Status:** COMPLETE — wizard suite 21/0 (86 expect), regression 79/0 across
  9 files, typecheck ×4 exit 0, eslint `--max-warnings 0`, prettier clean.
  Out of scope (recorded): the pty-layer duplication itself (harness artifact);
  Step 10 closeout + Step 9 remainder remain pending operator approval.

## Task 31 — FID-2026-0910-004 Step 8 (grammar + picker + docs) + live smoke (2026-09-11)

> Operator directives: "Run a tmux smoke test of the full /provider add flow
> end to end in the live CLI" + "Start Step 8: the /provider
> add|edit|list|remove command grammar wiring the wizard to users". Ordering
> recorded: the smoke depends on the grammar (the wizard branch is
> dormant-but-wired until Step 8) — grammar first, smoke as the live proof.
> Approved scope: `add|edit|list|remove` subcommand dispatch in the /provider
> handler (edit/remove custom-only; built-ins unremovable), picker inclusion
> of customs with configured badges via the effective view (Law 13),
> remove-flow active-provider warn + selection/routing reset (MQ1), user docs
> (Law 9), tmux smoke of the full add flow in an isolated config dir. Also in
> scope, discovered during grounding: the Step 7 route handler's
> mode-continuity defect (resetInput forces 'default' after every submit,
> breaking live step 2+ and unmasking the key step) — RED-pinned and fixed
> here. Steps 9-remainder (catalog fetcher/picker merge) + Step 10 remain
> pending. No drops, no deferrals.

- [x] **T31-A.** Step 8 RED: grammar/picker/remove/mode-continuity pin suite
      (`provider-commands.test.ts`), failing output captured; correct the
      contradictory Loop 7 pin (invalid-submit continuity). **Done** — 0
      pass / 12 fail captured; RED exposed the Step 7 mode-continuity defect.
- [x] **T31-B.** Step 8 GREEN: subcommand dispatch + custom-only guards,
      `provider-commands.ts` logic module, picker via effective view,
      remove flow (warn + reset selection/model/routing), wizard id step
      rejects grammar-reserved words, mode-continuity fix. **Done** — module
      is `provider-subcommands.ts` (naming deviation from the FID's C4
      phrasing, recorded); two GREEN-caught defects fixed (remove-flow
      post-mutation read; picker registration order).
- [x] **T31-C.** Docs: README provider section gains the custom-provider
      workflow (Law 9). **Done** — README.md:202.
- [x] **T31-D.** Gates: typecheck ×4, suites (new + regression), eslint,
      prettier, lint:md. **Done** — all exit 0 / pass.
- [x] **T31-E.** tmux smoke: full `/provider add` flow end-to-end in the live
      CLI with `SAVANT_CODE_CONFIG_DIR` isolated to a temp dir. **Done with
      recorded boundary** — tmux does not exist on this Windows host; the
      equivalent live smoke drove the REAL production modules (command defs,
      subcommand module, wizard machine, route handler, settings IO, key
      store, registry) through add → list → edit → remove in an isolated
      config dir: 11/11 assertions. The literal alternate-screen keystroke
      layer was not driven (NEEDS-REVIEW, recorded in the FID).
- [x] **T31-F.** FID Step 8 evidence + loop record, SCOPE/ledger, path-scoped
      commit. **Done except commit** — FID Loop 8 + Step 8 evidence, ledger,
      and SCOPE updated; commit plan below (awaiting G1 path-scoped
      authorization as with prior steps). **[Swept 2026-09-13: the Step 8
      commits shipped (Steps 1-10 history; `provider-subcommands.ts` last
      touched by `89847116`) and FID-2026-0910-004 closed + archived
      2026-09-11 with Loop 12 certification — box was never ticked. The
      commit plan below is historical record.]**

  Commit plan (G3/G4, matching the repo's native no-trailer style): (1)
  `feat(providers): custom provider Step 8 grammar, picker, docs
  (FID-2026-0910-004)` — cli/src/commands/provider-subcommands.ts,
  cli/src/commands/defs/model-provider-commands.ts,
  cli/src/commands/router/route-provider-wizard.ts,
  cli/src/utils/provider-wizard.ts,
  cli/src/commands/__tests__/provider-commands.test.ts,
  cli/src/commands/__tests__/provider-add-wizard.test.ts, README.md; (2)
  `docs(governance): FID Step 8 evidence + live smoke record` — the FID,
  ledger, SCOPE. The smoke driver stays in the gitignored scratchpad.

## Task 30 — FID-2026-0910-004 Step 9 (union widening) + Step 7 (wizard) (2026-09-11)

> Operator directive: "Start Step 7: the /provider add|edit wizard step
> machine" + "Start Step 9 of FID-2026-0910-004: widen the
> ModelProvider/ProviderSetupName unions to retire the bridge casts."
> Approved scope: Step 9 = the D8 type widening + cast retirement ONLY (the
> FID Step 9's catalog fetcher / picker merge parts remain pending); Step 7 =
> the full wizard (providerAdd input mode, step machine add + pre-filled
> edit modes per D7/MQ12, route handlers, settings + key writes, pin suite
> per the FID's declared gate). No drops, no deferrals.

- [x] **T30-A.** Step 9 RED/GREEN: widen `ModelProvider` = `ProviderId |
      (string & {})` (`openrouter-models/types.ts`), retire all six
      validation.ts-precedent bridge casts (validation.ts ×2,
      provider-setup.ts ×2, provider-key-store.ts ×2) + the two test-file
      assertion casts; `ProviderSetupName` already carries `(string & {})`
      from Step 6. **Done 2026-09-11** (commit `547946c`).
- [x] **T30-B.** Step 7 RED: `provider-add-wizard.test.ts` pin suite — the
      FID's declared gate — covering: id validation + reserved-id rejection,
      env-var shape + claimed-var rejection, base-URL validation, inline
      model prefix rule, step sequencing, edit prefill, id immutability,
      key-kept-on-empty, fail-closed save on invalid edit, invalid
      re-prompts, escape. **Done 2026-09-11** (16/0 after RED iteration).
- [x] **T30-C.** Step 7 GREEN: pure step machine (`provider-wizard.ts`),
      `providerAdd` + `providerAddKey` input modes, route handlers, finalize
      via `parseCustomProviders` (one validation truth, Law 13), writes via
      `saveCustomProviders` + `saveProviderApiKey`, re-activation on baseUrl
      change. **Done 2026-09-11** — deviation recorded: settings writes go
      through `saveSettings({ customProviders })` (no `saveCustomProviders`
      helper exists); router e2e walk pins persist → register → key →
      activation.
- [x] **T30-D.** Gates: typecheck ×4, suites (new + regression), eslint,
      prettier, lint:md; FID evidence + ledger; path-scoped commits.
      **Done 2026-09-11** — all gates exit 0; commits `547946c`
      (implementation) + `15074fe` (governance).

## Task 28 — FID-2026-0910-004 Steps 1-3: common layer (2026-09-10)

> Operator directive: "Start implementing FID-2026-0910-004 Steps 1-3
> (common layer)." Approved scope: Steps 1 (custom type + validation),
> 2 (merged registry), 3 (model-validation seam) only — CLI/SDK steps 4-10
> remain pending until separately approved. Step 3 finding recorded below
> when investigated.

## Task 29 — FID-2026-0910-004 Steps 4-6: SDK seam + CLI settings + key store (2026-09-10)

> Operator directive: "Authorize the path-scoped commit for Steps 1-3, then
> continue with Steps 4-6 (CLI wizard layer)." Grounding correction: in the
> converged FID the wizard is **Step 7** (separate approval); Steps 4-6 are
> SDK seam / CLI settings / CLI key store + setup. Approved scope: implement
> Steps 4-6 only.

- [x] **T29-CHECK.** ~~Grounding finding: the common module's research-BYOK
      reserved list (4 vars) drifted from `research-key-store.ts` ground truth
      (6 vars: `CONTEXT7_API_KEY`, `PARALLEL_API_KEY` missing).~~ **Withdrawn
      by operator ruling 2026-09-10:** research keys stay untouched — "they
      all work 100%" and other systems have replaced most of them natively
      and for free; no new CLI settings surface for them either. The drift
      edit was applied and then reverted same-session; committed state
      (`7f95b38f`) is unchanged. The 4-var list stays: it is a *reservation*
      list (what custom providers may not claim), not a completeness mirror
      of the research store.
- [x] **T29-A.** Step 4 (SDK): `SavantCodeClientOptions.customProviders` +
      registration in `client.ts` constructor and standalone `run()` (D4
      lifecycle); `model-provider.ts:17,87,116,165` → effective registry.
      RED-first pins. **Done (implemented 2026-09-10 by the crashed session;
      re-grounded + gates green 2026-09-11)** — see the session summary's
      evidence ledger.
- [x] **T29-B.** Step 5 (CLI settings): `customProviders` in `Settings` +
      `validateSettings` preservation via `parseCustomProviders` (save
      round-trip must never erase user data) + register-before-validate in
      `loadSettings`. RED-first pins. **Done (same provenance as T29-A).**
- [x] **T29-C.** Step 6 (CLI key store + setup): effective setup view (C2),
      custom env-var application, key functions through the effective view,
      research-env-var collision guard. RED-first pins. **Done (same
      provenance as T29-A).**
- [x] **T29-D.** Gates: typecheck ×4, suites, eslint/prettier, Law 4 greps;
      FID/SCOPE/ledger updates; commit plan. **Done 2026-09-11** — typecheck
      ×4 exit 0 (cli/sdk/common/agent-runtime); suites 60/0 (cli, 8 files) +
      51/0 (sdk, 12 files) + 51/0 (common providers); eslint 12 files 0
      problems; prettier clean; full evidence in the session summary +
      `dev/handoff.md`. Commit plan presented — awaiting operator
      authorization (G1).

## Task 28 — FID-2026-0910-004 Steps 1-3: common layer (2026-09-10)

> Operator directive: "Start implementing FID-2026-0910-004 Steps 1-3
> (common layer)." Approved scope: Steps 1 (custom type + validation),
> 2 (merged registry), 3 (model-validation seam) only — CLI/SDK steps 4-10
> remain pending until separately approved. Step 3 finding recorded below
> when investigated.

- [x] **T28-A.** RED: `custom-providers.test.ts` pins (validation rules, merge
      rules, replace/reset lifecycle, prefix list, dead-code removal pin).
      **Done 2026-09-10** — RED captured honestly: module-absent failure, then
      two pin corrections of my own contract ambiguity (parse/register return
      shapes) re-captured as RED before GREEN; behavior pins failing.
- [x] **T28-B.** Step 1: `CustomProviderConfig` + `validateCustomProviders` +
      `inline` catalog variant + `validateProviderRegistry` extension.
      **Done 2026-09-10** — types.ts:111-142, custom-providers.ts parser,
      validate.ts `'inline'` in CATALOG_SOURCES.
- [x] **T28-C.** Step 2: merged registry — register/getEffective/reset with
      D4 lifecycle, conversion to `ProviderConfig`, effective prefix list.
      **Done 2026-09-10** — file-name deviation (recorded): consolidated in
      `custom-providers.ts` rather than a separate `merged.ts` (one module,
      Law 13). Built-ins-win enforced by fail-closed shadow guard (RED
      process caught the silent-overwrite gap). Pin suite asserts effective
      prefixes derive from the merged view.
- [x] **T28-D.** Step 3: resolve the `dynamic-agent-template.ts` seam per the
      investigation fork; pin the outcome. **Done 2026-09-10** — fork
      resolved by evidence: no template-time model validation ever existed,
      `filteredModels` was dead code (computed, guarded, never consumed).
      Implemented as dead-code removal + pin; FID Loop 5 records it.
- [x] **T28-E.** Gates: GREEN run, typecheck ×4, eslint/prettier, existing
      provider suites green, Law 4 greps; FID evidence updated; commit plan.
      **Done 2026-09-10** — 51/0 provider suites; 686/4/0 full common;
      typecheck ×4 exit 0; eslint 0 problems; prettier clean. Law 4: common
      module's production caller is the Step 4 SDK seam (honest — not yet
      reachable from production; grep evidence recorded in FID). Commit plan
      presented, awaiting operator authorization (G1).

## Task 27 — FID-2026-0910-004: user-defined custom providers via /provider (2026-09-10)

> Operator directives: "make the fid, run perfection loop on it then present
> it", with the scope correction "no v1/v2 — we build the full feature the
> first time around." Feature: users add their own LLM providers at will
> through CLI slash commands, as first-class registry entries (prefix
> routing, catalogs, key storage) — not env-var configuration. Approved
> scope: author the FID with the full-feature design, run the Perfection
> Loop to convergence, present. Implementation is a separate approval.

- [x] **T27-A.** RED evidence catalog: registry/derivation/settings/input-mode
      consumers with file:line citations; cross-workspace coverage check;
      prefix-collision surface (ORG_PREFIXES) and model-validation seam.
      **Done 2026-09-10** — 10-cluster consumer map (C1-C10), desktop/
      savant-free zero-consumer check, evals inheritance check, ORG_PREFIXES
      + env-var collision surfaces, InputMode union pinned
      (`input-modes.ts:8-20`).
- [x] **T27-B.** Author `dev/fids/FID-2026-0910-004-custom-providers-slash-command.md`
      — full-feature design (merged registry, SDK registration seam, wizard,
      catalogs, key storage), RED + GREEN documented. **Done 2026-09-10** —
      D1-D10 decisions, Steps 1-10, 8 declared gates, 11 Missed Questions
      answered.
- [x] **T27-C.** Perfection Loop: audit pass with fresh greps on citations +
      missed-surface hunt; corrections applied; Missed Questions answered.
      **Done 2026-09-10** — Loop 2 found 5 findings (dangling step label,
      repo-validation interaction, registration lifecycle, missing citation,
      missing docs step), all corrected in-place; Loops 2-3 recorded with
      honest deltas (~6%, ~3%). Loop 4 (operator amendment): `/provider edit
      <id>` flow folded in per the approved edit-scope decision — prefilled
      wizard, id immutable, fail-closed save, re-activation rule; MQ12 +
      wizard edit-path pins added; delta ~2%; gates re-run clean.
- [x] **T27-D.** Status → `converged`; present FID + commit plan (no git
      execution without operator approval). **Done 2026-09-10** — FID clean
      under lint:md + prettier + markdownlint-cli2 (0 issues); presentation
      below. Commit pending operator authorization per G1.

## Task 26 — FID-2026-0909-008 Step 5: native-incomplete ledger capture (2026-09-10)

> Operator directive: "Pick up FID-2026-0909-008 Step 5 or run the perfection
> loop on it." Step 5 = route native-incomplete stream errors into the
> experience-capture path (Missed Question #1) — the truncation class is
> invisible to the recurrence engine (0 ledger records, ~11 incidents).
> Step 4's uncommitted work landed first as its own commit (G3). No drops,
> no deferrals.

- [x] **T26-A.** Commit Step 4's uncommitted work path-scoped. **Done
      2026-09-10** — commit `5859047f` (15 files).
- [x] **T26-B.** RED pin: a native-incomplete step appends one
      experience record per occurrence (tool_failure, tool name, normalized
      error line). **Done 2026-09-10** —
      `native-incomplete-capture.test.ts`; RED = 0 records pre-fix, GREEN =
      3 (ladder exhausts: 3 steps × 1 error chunk; pin corrected to the
      true contract after root-causing, not fitted).
- [x] **T26-C.** GREEN: capture via the existing hook-engine +
      experience-capture sink (Law 13 — one sink; fail-open by the hook
      contract). **Scope deviation, recorded:** implemented at the
      stream-parser error-chunk site (`stream-parser.ts:186-211`), not the
      loop strike site as originally scoped — the stream layer is the
      earliest point with `chunk.message` + `toolName` + `finishReason`,
      fires once per occurrence (the strike site would double-count on
      escalation), and `fileContext` is already in params. Same sink, same
      record shape.
- [x] **T26-D.** Gates: typecheck (0), new pin suite, strikes + capture
      suites (15/0), full agent-runtime suite (1379/0 — the 43-failure
      root-run was the vendored `resources/freebuff-main/` copy, not this
      repo), eslint 0, prettier clean. **Done 2026-09-10**.
- [x] **T26-E.** FID Step 5 status + Verification Results + loop record;
      commit; present. **Done 2026-09-10** — FID stays `fixed` (closure
      needs the live NEEDS-REVIEW proof); commit below.

## Task 25 — Implement FID-2026-0910-001 skill-notification surfaces (2026-09-10)

> Operator directive: "Implement FID-2026-0910-001's three skill-notification
> surfaces, entering the Perfection Loop at GREEN." The FID is loop-converged
> (RED/GREEN/Loop-2 recorded in-document, gates declared, Loop-2 corrections
> applied); this directive is the Law-2 approval to implement the converged
> Proposed Solution. No drops, no deferrals.

- [x] **T25-A.** RED legs first: extend the four suites (common counter pin,
      skill-manage render suite, skills-command pointer pin, session-end-review
      alert pin) and capture failing output pre-fix. **Done 2026-09-10** —
      all four RED legs captured (missing export / missing module / missing
      pointer line / missing alert line).
- [x] **T25-B.** GREEN: `countQuarantinedDrafts` in common skill-management
      (engine-owned count; facade re-export). **Done 2026-09-10** —
      `helpers.ts` + `skillQuarantineRootDir` in `paths.ts`.
- [x] **T25-C.** GREEN: `SkillManageComponent` + registry registration
      (P1; TerminalCommandDisplay reuse, synthesized label). **Done
      2026-09-10** — `skill-manage.tsx` + `registry.ts:69`.
- [x] **T25-D.** GREEN: `/skills list` quarantine pointer line (P2;
      state-gated, silent at zero). **Done 2026-09-10** — `skills.ts:55-65`.
- [x] **T25-E.** GREEN: SessionEnd quarantine alert line (P3; deterministic,
      zero-LLM, silent at zero). **Done 2026-09-10** —
      `session-end-review.ts` `quarantineAlertNote` + routing append.
- [x] **T25-F.** Docs: surfaces note in `docs/self-improving-harness.md`
      (update only what exists). **Done 2026-09-10** — §3.4 added.
- [x] **T25-G.** Gates: typecheck common + cli, the four suites (+1 new
      counter suite), eslint/prettier on touched files, lint:md; FID
      evidence + status update; ledger touch-up; commit plan presented
      (G1 discrepancy — operator executes or approves git). **Done
      2026-09-10** — all gates exit 0 / 22-0 tests; FID status `fixed`;
      commit plan presented below.
- [x] **T25-H.** FID-2026-0910-003 closure ceremony (operator directive:
      "Complete the FID-2026-0910-003 closure ceremony: archive move +
      CHANGELOG entry"). **Done 2026-09-10** — Ground-Truth re-verified
      (commits `377e0494`/`17b08fd5` on main; pins 38/0; typecheck/
      eslint/prettier clean); file moved to `dev/fids/archive/`; archive
      README index entry added; ledger row removed; CHANGELOG entry
      already existed (no duplicate).

## Task 24 — Perfection Loop on FIDs -0909-001/-002/-003 + master plan (2026-09-09)

> Operator directive: "run perfection loop on all 3 fids then organize them
> into a master plan so i can do all 3 of them in logical order." Interpreted
> scope: (1) run the Perfection Loop (RED→GREEN→AUDIT, codebase-grounded) on
> each of the three 2026-09-09 release-findings FIDs, correcting any drift
> against the live code found during grounding; (2) author a coordination
> master/build-order that sequences all three implementations in dependency
> order. **Planning only — no implementation code this task.** Implementation
> of each FID remains a separate Law-2 presentation. No drops, no deferrals.

- [x] **T24-A.** Read `ECHO-single-agent.md` + `dev/echo-v0.1.2-single-agent.md`
      0-EOF (session boot) and ground the project. **Done 2026-09-09.**
- [x] **T24-B.** Ground-truth all three FIDs against the live code:
      `scripts/verify-clean.ts` + `scripts/public-release/provenance.ts` read
      0-EOF (gate chain = `worktree add` → install → `bun run typecheck`,
      cleanup only in a `finally` that discards its result; no pre-create
      guard); three FID-002 fix commits verified present (`2b22103`,
      `87bcc44`, `05e2e1a`); banned-pattern inventory run (one residual
      documented-contract spawn site found at
      `scripts/public-release-pinned-bun.test.ts:54`; zero SDK-reachable
      `import.meta.dir` production sites in `common/src`). **Done 2026-09-09.**
- [x] **T24-C.** Run the Perfection Loop on each FID (status → `analyzed`)
      with loop-passed RED/GREEN/AUDIT records + ground-truth corrections
      recorded in each document. **Done 2026-09-09** — FID-001's root-cause
      hypothesis corrected by the code read (three-gap mechanism, three-piece
      fix); FID-003's chain located in the shared `assertCleanCheckoutCompiles`
      (parameterized gate-list design; RED pin sequenced after FID-001);
      FID-002's Step-1 inventory run with one reasoned exemption found and
      class 3 ruled non-greppable.
- [x] **T24-D.** Author the coordination master plan (build-order doc) that
      sequences the three implementations with rationale, per-FID scope,
      verification commands, and shared boundaries. **Done 2026-09-09** —
      `dev/build-orders/BO-2026-09-09-gate-chain-hardening.md` (order:
      001 → 003 → 002, with the dependency rationale).
- [x] **T24-E.** Update `dev/fids/README.md` (statuses + master cross-link)
      and run the documentation gates (`lint:md`, `validate:repository`).
      **Done 2026-09-09** — ledger updated to three `analyzed` rows with the
      loop-pass summary; gates: `lint:md` PASS, `validate:repository` PASS,
      prettier clean on all touched files.
- [x] **T24-F. [DONE 2026-09-09 — operator approved]** Presented the three
      looped FIDs + master plan. **Operator ruling: "Approve the full
      001→003→002 program and implement all three sequentially."**
      Implementation scope per FID = the looped Proposed Solution + declared
      Verification Gates + close/archive/CHANGELOG per the T17-C standing
      directive. FID-002's surface choice (minimal gate vs + behavioral
      probe) resolves at its GREEN per the FID's reservation.

### Task 24 implementation tracking (T24-G)

- [x] **T24-G1. FID-2026-0909-001 [DONE 2026-09-09, commit `086565b`]** —
      RED pins → self-healing lifecycle (`scripts/public-release/
clean-checkout.ts` + provenance rewiring) → gates (12/0 + provenance
      11/0 + verify-clean 9/0; live git-ordering probe) → closed +
      archived + CHANGELOG.
- [x] **T24-G2. FID-2026-0909-003 [DONE 2026-09-09, commit `086565b`]** —
      gate-list pins → parameterized chain + `verify:clean` opt-in →
      live drill BOTH legs (planted TS2339 on commit `1fbb1e06` → FAIL
      fail-closed with no checkout debris; clean `086565b6` → PASS
      146.0s) → closed + archived + CHANGELOG.
- [x] **T24-G3. FID-2026-0909-002 [DONE 2026-09-09]** — audit gate RED
      pins → `scripts/audit-gate-env-parity.ts` + `validate:repository`
      wiring as `audit.gate-env-parity` (minimal gate; classes 1–2
      mechanical, class 3 behaviorally pinned; one path-exact exemption:
      the pinned-bun contract probe). The guard's first live run caught
      TWO real class-1 defects (`scripts/bump-version.ts:138/156`,
      bracket-shape `Bun.spawnSync(['bun', ...])` the inventory grep
      missed) — fixed to `process.execPath`, ratchet bumped. Prove-
      the-guard leg both legs (planted `import.meta.dir` in a scratch
      worktree → FAIL with file:line precision; restored → PASS).
      Closed + archived + CHANGELOG.
- [x] **T24-G4. [DONE 2026-09-09]** Program battery: scripts surface
      326/0 across 45 files; typecheck ×4 (sdk/common/agent-runtime/cli)
      exit 0; eslint on all touched files `--max-warnings 0`; lint:md
      PASS; prettier clean; `validate:repository` PASS with the new
      audit gate live.

## Task 15 — Deck rebuild: cyberpunk neon-noir agent office (2026-08-31)

> Operator decision at the crossroads: the holographic command deck
> (desktop/src/floor) "completely misses the mark" vs. the Hermes3D idea
> (resources/Hermes3D-main, MIT, vendored). Direction chosen via ask_user
> 2026-08-31: **Full retro-office rebuild** with a **cyberpunk/neon-noir
> visual identity** (operator constraint). The office is the product: agents
> are characters with presence, not holograms on pedestals. Chat side of the
> desktop app is explicitly liked and OUT of scope. FID-2026-0831-001
> authored, Perfection-Loop converged, operator-approved ("proceed").

- [x] **T15-A.** Author the FID (RED→GREEN→AUDIT→Perfection Loop) and present
      for operator approval BEFORE any code. **Done 2026-08-31** —
      `FID-2026-0831-001-deck-rebuild-neon-noir-office.md`, 3 loops converged,
      gates structurally valid, operator approved.
- [x] **T15-B.** Phase 1 — R3F scaffold: office floor plan, agent characters
      with walk cycles driven by FloorState. **Done 2026-08-31** —
      `office/office-plan.ts` (shared geometry from `stationPosition`/
      `padPosition`), `office/office-motion.ts` (pure walk math,
      reduced-motion teleport), `office/office-scene.tsx` (R3F Canvas,
      characters, desks, per-frame ref-based pose loop).
- [x] **T15-C.** Phase 2 — activity mapping: walk-to-desk on tool work,
      speech bubbles from real chat output, station neon activation on real
      events. **Done 2026-08-31 (reducer level)** — `office/speech-bubbles.ts`
      (flatten/clamp/TTL/FIFO + honesty filter dropping unattributable ids);
      walkers depart pads for tool desks on `pendingTools` via `targetFor`;
      desk emissive keyed to busy state. **[OPEN-OUT-OF-SCOPE → Task 15-G]:**
      in-scene bubble rendering needs a text-event subscription seam in the
      office scene (FloorState carries no text deltas — see T15-G below).
- [x] **T15-D.** Phase 3 — neon-noir atmosphere: `office/neon-atmosphere.tsx`
      (Bloom mipmapBlur + Vignette, quality tier drops postfx first); DPR
      clamp [1,2]; WebGL probe + `webglcontextlost` listener in
      `deck-view.tsx` swaps to analytical fallback. **Done 2026-08-31.**
- [x] **T15-E.** Gates. **Done 2026-08-31** — desktop typecheck exit 0;
      floor suite 126 pass/0 fail (804 expect) UNTOUCHED; office suite
      27 pass/0 fail (office-motion 14, speech-bubbles 13); eslint
      `--max-warnings 0` clean; prettier clean; `fid:verify --write`
      receipt stamped (typecheck desktop PASS, floor-adapter test PASS).
- [ ] **T15-F.** Operator live smoke (visual confirmation is the acceptance
      bar for a visual product). **BLOCKED on operator** — run the desktop
      app, message a model, confirm: agents walk to tool desks during tool
      work, walk home after, desks glow when busy, neon-noir look.
- [x] **T15-G.** Speech bubbles in the scene: **Done 2026-08-31 (FID-2026-0831-002 P4)** —
      driver text snapshot implemented (option (a) preferred design: bounded,
      attributable text snapshot alongside FloorState, one event path, no second
      gateway subscription). `deck-live-driver.ts` folds `text` events into
      `getTextSnapshot()` with honesty filter (unknown agentIds dropped) and TTL
      prune; `deck-view.tsx` `useLiveBubbles()` feeds `OfficeScene bubbles=` prop;
      `office/speech-bubble-3d.tsx` renders billboard in character group;
      `office-scene.tsx` `OfficeContents` maps agentId→bubble. 3 new driver tests
      (fold, honesty-drop, TTL-prune) all pass.
- [ ] **T15-H. [DEFERRED — operator decision pending]** P4 stage retirement:
      delete the 14 old stage modules + their tests in one atomic commit
      once the live smoke approves the office (no dead code, Law 5/15).
      Awaiting T15-F.

## [OPEN-OUT-OF-SCOPE → promoted to work item, 2026-09-06] — desktop bundle size (+R3F deps)

Adding @react-three/fiber + drei + postprocessing grows the renderer bundle
(~+150KB gz estimated in FID Loop 3). **Operator ruling 2026-09-06: authorize
optimization** — lazy-load the 3D stack so the shell's first paint does not
carry it. FID-first per protocol; see Task 16 desktop item below.

> **Operator ruling 2026-09-06:** Authorize optimization. Lazy-load the 3D
> stack in the desktop renderer so the initial shell does not carry the R3F
> bundle; target the FID for it before code.

> **[PROMOTED → work item, 2026-09-06]** Operator ruled: lazy-load the 3D
> stack rather than accept the eager bundle. See the desktop task entry below
> for the contracted plan.

## [OPEN-OUT-OF-SCOPE → authorized, 2026-09-06] — T15-F visual smoke reveals incomplete office presentation

Operator smoke 2026-08-31 reports mostly black output, Savant framed near the
bottom, no office details, no visible robots/models, and no Hermes3D-like
movement. Ground-truth review confirms the current P1–P3 implementation only
renders capsule/sphere characters and six tool desks; it does not yet render
walls, room zones, personal desk furniture, articulated character detail,
or speech bubbles in-scene. **Operator ruling 2026-09-06: authorize build** —
the environment + character presentation layer is approved as a new work
item (FID-first), after which visual smoke is re-run. T15-F/T15-H unblock on
a passing smoke, not on authorization.

## [OPEN-OUT-OF-SCOPE] — T15-F visual smoke reveals incomplete office presentation

Operator smoke 2026-08-31 reports mostly black output, Savant framed near the
bottom, no office details, no visible robots/models, and no Hermes3D-like
movement. Ground-truth review confirms the current P1–P3 implementation only
renders capsule/sphere characters and six tool desks; it does not yet render
walls, room zones, personal desk furniture, articulated character detail,
or speech bubbles in-scene. The next correction requires a blocking scope
presentation before additional code: build the environment and character
presentation layer, then re-run visual smoke. T15-F/T15-H remain blocked.

## Approved work items (pending operator confirmation)

- [x] **A. Review the current Savant-Code UI** (code-based review of cli/src:
      chat layout, savant-ui library, theme system, animation usage). Live
      visual pass is a follow-up item, not part of this review.
- [x] **B. Critically review `docs/design/OpenTUI Terminal UI Capabilities.md`**
      — verify load-bearing claims against the actual OpenTUI release history,
      docs, and npm packages; classify claims as verified / unverified /
      incorrect.
- [x] **C. Produce the UI-overhaul plan** (a design document in
      `docs/design/`, phased, with the corrected OpenTUI facts as its basis).
      No UI code changes in this task.
- [x] **D. Correct the capability report in place** — appendix §14 added
      (verified / incorrect / unverified classifications), MD013 + MD001 lint
      fixes applied; repo-wide `lint:md` now green.
- [x] **E. Route implementation phases to FIDs** — six FIDs created
      (FID-2026-0816-002 master + 003–007 phases) and run through the
      Perfection Loop to document convergence. **Status: `analyzed`, OPEN
      in `dev/fids/`** — closure is deferred until each phase is implemented
      and verified (closure requires implementation evidence; correction
      per operator feedback 2026-08-16).

## Constraints

- strict_mode: true — all 15 laws active.
- No UI code written until the plan is approved (Law 2).
- The OpenTUI 0.2.2 → 0.5.x upgrade is the load-bearing foundation; the plan
  must sequence it first and flag its real breaking changes (verified, not the
  report's unshipped scope-tree claims).

## Task 2 — Native tool-call recovery hardening (2026-08-16)

> New task intake. Interpreted scope below — operator confirmation (via FID
> presentation) converts it into approved scope.

- [x] **T2-A. Create `FID-2026-0816-012`** for native tool-call recovery
      hardening (flash-model truncated-tool-call failures killing subagent
      runs), run the Perfection Loop on the document, and present it for
      approval. Evidence: operator-reported Forge run failure
      (`Native tool-call recovery failed twice consecutively`) on the
      FID-2026-0816-011 implementation task. **Done** — FID presented,
      operator approved (2026-08-16).
- [x] **T2-B. Implement the converged FID** — ONLY after operator approval of
      the presented FID (Law 2). **Done** — steering + 3-strike cap +
      actionable exhausted failure + drift warn; typecheck ×4, agent-runtime
      973/0, SDK 477/0, eslint 0, lint:md 0, prettier clean; FID closed and
      archived with CHANGELOG + index entries.

## Task 3 — Auto Drive (2026-08-18) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-18. Master
> FID-2026-0818-001 + children 002–008 all closed + archived with
> implementation evidence. Live `/auto-drive` smoke (TUI + headless + crash
> resume) and full gate sweep confirmed.

- [x] **AD-A. Review the Auto Drive Architecture Blueprint in full** against
      both reference codebases (`resources/code-main` = Every Code; the
      Savant-Code repo itself). All ~20 load-bearing claims verified; errors
      corrected (paths, non-existent `/auto`, decorative citations).
- [x] **AD-B. Read `ECHO.md` 0-EOF** and absorb the operator correction:
      single-agent ECHO governs Freebuff-harness sessions only; the product
      runs the 10-agent harness. Auto Drive = mechanized STRICT ceremony.
- [x] **AD-C. Converge the design with the operator** — driver-on-goal-engine,
      one-time Approval Contract, self-healing ladder, triple-gate completion.
- [x] **AD-D. Draft the FID backlog** — master `FID-2026-0818-001` + children
      `002`–`008`, all Perfection-Loop-converged, status `analyzed`, Step
      Status inventories present; `dev/fids/README.md` indexed; gates green
      (`validate:repository` PASS, markdownlint PASS).
- [x] **AD-E. Operator approval of the program** — resolution policy
      APPROVED 2026-08-18; scope revised per operator ("build it out
      completely, no v1/v2") — TUI + headless CLI mode (008) + inline plan
      editing (002) in scope; Auto Review ghost-worker + single-agent
      variant operator-confirmed out of scope. **Nova planning sign-off
      PASS 2026-08-18** (verdict in `dev/nova/outbox/2026-08-18-auto-drive-
      and-discord-rich-presence-planning-verdict.md`). Program approval
      confirmed; implementation complete.
- [x] **AD-F. Implement children in dependency order** — 002 → 003 → 004 →
      005 → 006 → 007 → 008, each closed with implementation evidence per
      FID-2026-0817-005; program certification = live `/auto-drive` smoke run
      (TUI + headless + crash resume) + full gate sweep (master step 8).
      **Complete 2026-08-18** — all FIDs closed + archived.

## Task 4 — Discord Rich Presence (2026-08-18) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-18.
> FID-2026-0818-009 closed + archived with implementation evidence. Live
> Discord presence confirmed under the Savant Discord application.

- [x] **DP-A. Read the Discord Presence blueprint 0-EOF** and ground-truth it
      against the repo — corrected the decorative citations (`bun.com`,
      `docs.discord.food`, UNPKG), the wrong preference home
      (`credentials.json` → `settings.json`), and the unverified "Bun Windows
      named-pipe anomaly" (must reproduce before any workaround).
- [x] **DP-B. Converge the design with the operator** — library-first
      (`@xhayper/discord-rpc`) with raw IPC as a documented, evidence-gated
      fallback; master + 3 children structure; Rich Presence only (the
      Embedded App SDK "Activities" surface needs a hosted HTTPS app + live
      egress, conflicting with local-first/zero-cloud — operator-confirmed
      out of scope 2026-08-18).
- [x] **DP-C. Draft the FID** — `FID-2026-0818-009` (single FID per
      single-agent ECHO; the initial master + 3 children structure was
      self-corrected after `validate:repository` reported multiple active
      masters), Perfection-Loop-converged, status `analyzed`, Step Status
      inventory present.
- [x] **DP-D. Operator approval of the program** — **Nova planning
      sign-off PASS 2026-08-18** (verdict in `dev/nova/outbox/2026-08-18-
      auto-drive-and-discord-rich-presence-planning-verdict.md`). External
      prerequisite satisfied: Discord Developer Portal application (Client
      ID `1539431002089328710`) + agent/phase icons uploaded. Program
      approval confirmed; implementation complete.
- [x] **DP-E. Implement the FID's five steps** — IPC transport → state +
      privacy → mapper → commands, closed with implementation evidence per
      FID-2026-0817-005. **Complete 2026-08-18** — FID-2026-0818-009 closed +
      archived; live Discord presence verified by operator.

## Task 5 — Desktop App (2026-08-19) — INTERPRETED SCOPE (pending operator confirmation)

> Research phase complete: explored Hermes Desktop, OpenHands Agent Canvas, and
> AionUI; findings + plan presented 2026-08-19. Operator confirmation converts
> interpreted scope into approved scope. Nothing implemented yet — planning only.

- [ ] **DA-A. Explore the three desktop references** (Hermes Desktop, OpenHands
      Agent Canvas, AionUI) — architecture, packaging, integration patterns,
      lessons. **Done 2026-08-19** — findings presented to operator.
- [ ] **DA-B. Produce the desktop app plan** — shell choice, backend bridge
      architecture (Bun-bound runtime constraint), UI approach, packaging,
      phases. Presented 2026-08-19 for confirmation.
- [x] **DA-C. Draft the self-contained Gemini deep-research prompt** —
      decision-oriented, embeds verified local facts;
      `dev/scratchpad/desktop-app-deep-research-prompt.md`. **Done
      2026-08-19** — ready for the operator to run in Gemini Deep Research
      (attach ECHO.md / ARCHITECTURE.md / README.md / protocol.config.yaml).
- [ ] **DA-D. [Post-approval] Author the architecture FID + design doc, then
      begin Phase 1** (headless session-gateway server mode in the CLI).

## Task 6 — Research tools non-functional in direct-provider mode (2026-08-19) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-19.
> FID-2026-0819-002 closed + archived with implementation evidence. Research is
> decoupled from `DIRECT_PROVIDER` behind a swappable adapter (`research-sources.ts`):
> `web_search` ships a keyless Qwant + DuckDuckGo port (default, zero keys) plus BYOK
> Serper/Parallel/Tavily/Exa/Firecrawl facades; `read_docs` ships keyless search-and-fetch
> plus a self-populating local SQLite FTS5 docset cache (`~/.savant-code/docsets/`,
> 7-day TTL, keyless version detection) plus BYOK Context7; `deep_research` inherits
> via its injected `SearchFn`. BYOK keys entered via `/research-keys`, saved to
> `credentials.json`, applied at boot, masked. Docs updated (`.env.example`,
> `docs/features.md`, `docs/installation.md`, `docs/faq.md`, `docs/index.md`,
> `README.md`, `README.zh-CN.md`).

- [x] **R6-A. Investigate the `read_docs` "backend services are unavailable" failure
      and root-cause it.** **Done 2026-08-19** — backend-only routing + the
      `DIRECT_PROVIDER` conflation; the direct Serper/Context7 facades exist but are
      unwired; `read_url` is the only native/keyless research tool.
- [x] **R6-B. Author `FID-2026-0819-002`** (RED + GREEN + missed questions), indexed in
      `dev/fids/README.md`. **Done 2026-08-19** — status `analyzed`.
- [x] **R6-C. Draft the self-contained Gemini Deep Research prompt** for keyless /
      self-hosted search + docs (no per-user keys). **Done 2026-08-19** —
      `dev/scratchpad/keyless-search-docs-deep-research-prompt.md`, ready for the
      operator to run in Gemini Deep Research.
- [x] **R6-D. Converge the architecture with the operator, then implement** —
      decouple `DIRECT_PROVIDER` from research + ship keyless/self-hosted search/docs.
      **Done 2026-08-19** — swappable adapter, keyless `web_search` + `read_docs`,
      BYOK (Serper/Parallel/Tavily/Exa/Firecrawl + Context7), `/research-keys` UI.
      FID-2026-0819-002 closed + archived with implementation evidence. Gates: typecheck
      ×4, agent-runtime 1103/0, CLI 3242/0, eslint clean, prettier clean.

## Task 7 — Quality-ratchet manual remediation (2026-08-20)

> Operator approved the converged `FID-2026-0819-005` for manual implementation.
> Batch 0 policy enforcement is complete; the remaining 300-line remediation is
> manual, sequential, and fail-closed. No codemod, mass rewrite, or remediation
> script is permitted.
>
> **2026-08-21 — program paused by operator decision:** the largest chunk of
> the decomposition is done without issue; the remaining inventory (standing
> item QR-Q, production inventory QR-IJ, and the Batch 4 test files) is
> explicitly deferred — call it good for now, leave the rest alone, and
> re-address only if the stance changes. No further large refactor sessions
> are planned for awhile. FID-2026-0819-005 remains open (`analyzed`) — not
> closed, not exempted; the quality report intentionally stays red (168) and
> `validate:repository` red (200, incl. ~32 pre-existing desktop-FID metadata
> findings) until the program resumes.

- [x] **QR-A.** Reconcile the FID with the live `quality-report.ts`, current
      baseline state, the operator-confirmed 300-line target, and prior
      `FID-2026-0805-003` deconstruction program. The operator also confirmed
      that all `approvedGrowth` entries were unauthorized.
- [x] **QR-B.** Rewrite the FID for single-agent ECHO: no agent attribution,
      no harness-only Verifier/Forge/Adversarial roles, explicit blocked steps,
      and separate ratchet versus absolute-ceiling verification.
- [x] **QR-C.** Run RED → GREEN → AUDIT on the FID and present the corrected
      planning document. The 300-line/no-exemption policy now covers every
      project-owned TypeScript/TSX file, including tests and core features.
      All remediation edits must be manual and individually audited.
- [x] **QR-D.** Operator approved implementation. Batch 0 was completed manually:
      `approvedGrowth` is absent from the baseline and rejected by the validator,
      policy sources align to 300 lines, owned TypeScript/TSX roots are scanned, and
      focused regression tests pass 4/4. `bun run quality:report` correctly fails
      closed with 309 outstanding absolute/ratchet issues. No codemod or remediation
      script was used.
- [x] **QR-E.** Complete the first manual decomposition seam: read and map
      `agents/scout/scout.ts`, move its self-contained `handleStepsMax` handler to
      `agents/scout/handle-steps-max.ts`, and verify the affected package. The source
      file decreased from 308 to 203 lines; the new module is 108 lines. Agents
      typecheck, 87 tests / 248 assertions, ESLint, and Prettier pass. The quality
      inventory decreased from 309 to 308 with no rebaseline or exemption.
- [x] **QR-F.** Complete the second manual decomposition seam: read and map
      `agents/savant/handle-steps.ts`, move its serialization factory and baked
      variants to `agents/savant/handle-steps-factory.ts`, and verify the affected
      package. The source file decreased from 323 to 58 lines; the new module is 275
      lines. Agents typecheck, 87 tests / 248 assertions, ESLint, and Prettier pass.
      The quality inventory decreased from 308 to 307 with no rebaseline or exemption.
- [x] **QR-G.** Complete the third manual decomposition seam: read and map
      `agents/context-pruner/structured-summary.ts`, move `buildPendingAsks` to
      `agents/context-pruner/pending-asks.ts`, and preserve the re-export used by
      serialized embedding. The source file decreased from 331 to 279 lines; the new
      module is 51 lines. Agents typecheck, 87 tests / 248 assertions, ESLint, and
      Prettier pass. The quality inventory decreased from 307 to 306 with no rebaseline
      or exemption.
- [x] **QR-H.** Complete the `.agents` type-definition target manually: extract the
      model union, runtime support types, tool-category unions, and provider options
      from `.agents/types/agent-definition.ts`, preserving its public re-exports.
      The parent decreased from 487 to 257 lines. Four new modules total 214 lines.
      Strict Bundler typecheck, ESLint, and Prettier pass. The quality inventory
      decreased from 306 to 305 with no rebaseline or exemption.
- [x] **QR-I.** Complete `.agents/types/tools.ts` manually: extract the discovery and
      file-operation parameter contracts to `.agents/types/tool-params-discovery.ts`,
      preserve `ToolParamsMap`, `GetToolParams`, and public re-exports. The parent
      decreased from 453 to 200 lines; the new module is 135 lines. Strict Bundler
      typecheck, ESLint, and Prettier pass. The quality inventory decreased from 305
      to 304 with no rebaseline or exemption.
- [x] **QR-J.** Complete the context-pruner Phase 1 test decomposition manually:
      split the 460-line preserved-state/summary suite into shared fixtures plus
      preserved-state and summary test modules, then remove the obsolete duplicate.
      Replacement files are 36, 173, and 239 lines; the focused suite passes 26/26,
      the full agents suite passes 87/87, and the quality inventory decreased from
      304 to 303 with no rebaseline or exemption.
- [x] **QR-K.** Complete the context-pruner Phase 3 test decomposition manually:
      extract shared serialized-runner fixtures and split fold/force, factory wiring,
      lifecycle, and single-trigger suites into 90-, 152-, 155-, 98-, and 135-line
      modules. The focused suite passes 17/17, the full agents suite passes 87/87,
      and the quality inventory decreased from 303 to 302 with no rebaseline or
      exemption.
- [x] **QR-L.** Complete the context-pruner main orchestrator manually: extract the
      P3a fold phase and ordinary summary assembly into serializable modules, preserve
      factory `.toString()`/`eval` embedding, and bring `main.ts` to 299 physical lines
      (300 quality-count lines). Full agents typecheck and 87/87 tests pass; ESLint,
      Prettier, and serialized coverage pass; the quality inventory decreased from
      302 to 301 with no rebaseline or exemption.
- [x] **QR-M.** Complete the `agents/types/tools.ts` public type contract manually:
      split tool names, parameter map, core controls, discovery/filesystem, database,
      and research domains into six modules while preserving the original re-export
      surface. The facade is 54 lines, all extracted modules are under 100 lines,
      agents typecheck and 87/87 tests pass, and the quality inventory decreased from
      301 to 300 with no rebaseline or exemption.
- [x] **QR-N.** Complete the `cli/scripts/build-binary.ts` decomposition manually:
      split env policy, runtime commands, target mapping, asset discovery, OpenTUI
      fetching, and release orchestration while preserving the original facade and
      guarded entrypoint. CLI typecheck and the 17/17 focused tests pass; all modules
      are below 300 lines; the quality inventory decreased from 300 to 299 with no
      rebaseline or exemption.
- [x] **QR-O.** Complete the `cli/src/__tests__/bash-mode.test.ts` decomposition
      manually: preserve its 27 entry/exit, storage/submission/UI, and edge/router
      tests across three focused modules. CLI typecheck and the full CLI suite pass
      (3242 pass / 18 skipped / 0 fail); the quality inventory decreased from 299 to
      298 with no rebaseline or exemption.
- [x] **QR-P.** Complete the credentials-storage integration-test decomposition
      manually: preserve all 20 filesystem/format, permission/capacity, and
      concurrent-operation tests across shared fixtures plus three focused suites.
      The original 453-line file was removed only after focused tests passed 20/20,
      CLI typecheck, ESLint, and Prettier passed; the full CLI suite passed 3242/18/0,
      and the quality inventory decreased from 298 to 297 with no rebaseline or
      exemption.
- [x] **QR-R.** Reconcile the existing local-agent integration-test split:
      read all nine replacement suites and the shared fixture, verify 36 tests /
      99 assertions and CLI typecheck, and record the quality inventory decrease
      from 297 to 296. No exemption or rebaseline was used.
- [x] **QR-S.** Complete the release HTTP proxy-test decomposition manually:
      extract shared fixtures and split the 11 plain HTTP, HTTPS proxy/redirect,
      retry, and resumable-download tests into five files at or below 300 lines.
      Focused tests pass 11/11 with 34 assertions; CLI typecheck, targeted ESLint,
      and Prettier pass; the quality inventory decreases from 296 to 295 with no
      exemption or rebaseline.
- [x] **QR-T.** Complete the release wrapper-safety decomposition manually:
      extract shared wrapper fixtures and split wrapper/package checks from the
      launcher catalog, packaging, consent, and process-cleanup suite. The three
      replacement files are below 300 lines; the focused command passes 32 tests /
      115 assertions, CLI typecheck, targeted ESLint, and Prettier pass; the quality
      inventory decreases from 295 to 294 with no exemption or rebaseline.
- [x] **QR-U.** Complete the generated-agent output decomposition manually:
      review the generator, declaration fallback, and production consumers; change
      the generator to emit a small public index plus one generated data module per
      bundled agent. Prebuild passes, all 40 generated data modules remain below 300
      lines (largest 168), the index is 114 lines, CLI typecheck and 11 roster/model
      regression tests pass, and the quality inventory decreases from 294 to 293
      with no exemption or rebaseline.
- [x] **QR-V.** Complete the `cli/src/app.tsx` decomposition manually: move the
      cohesive authenticated routing surface into a focused component while preserving
      the public `App` entrypoint, auth/project/banner orchestration, session gates,
      chat-history routing, and Chat props. The source decreases from 340 to 241 lines;
      the replacement is 108 lines; the package-scoped CLI suite passes 3242/18/0 with
      9001 assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      293 to 292 with no exemption or rebaseline.
- [x] **QR-W.** Complete the `cli/src/chat/keyboard.ts` decomposition manually:
      move the pure keyboard-state contract/projection into a focused module while
      preserving the existing keyboard-module re-export and handler behavior. The
      source decreases from 330 to 272 lines; the replacement is 61 lines; the focused
      keyboard/bash suite passes 157/0 with 175 assertions, typecheck/ESLint/Prettier
      pass, and the inventory decreases from 292 to 291 with no exemption or rebaseline.
- [x] **QR-X.** Complete the `cli/src/chat/panels.tsx` decomposition manually:
      move the cohesive bottom interaction surface into a focused component while
      preserving the `ChatLayout` export, message/header layout, sidebar, picker
      overlays, and all bottom-branch callbacks. The source decreases from 390 to 208
      lines; the replacement is 253 lines; the chat-focused suite passes 7/0 with
      14 assertions and the full package-scoped CLI suite passes 3242/18/0 with
      9001 assertions; typecheck/ESLint/Prettier pass, and the inventory decreases
      from 291 to 290 with no exemption or rebaseline.
- [x] **QR-Y.** Complete the `cli/src/chat/use-chat-controller.ts` decomposition
      manually: extract the stable `ChatControllerCore` type contract into a focused
      module while preserving the controller re-export and `useChatLayout` consumer.
      The source decreases from 313 to 241 lines; the replacement is 76 lines; the
      full package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 290 to 289
      with no exemption or rebaseline.
- [x] **QR-Z.** Complete the `cli/src/chat/use-chat-interactions.ts` decomposition
      manually: extract its argument contract, local state/history seam, input
      assembly, and suggestion-engine boundary while preserving the public type
      re-export and controller wiring. The source decreases from 375 to 294 lines;
      four replacement modules are 67, 46, 29, and 8 lines; the full package-scoped
      CLI suite passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier
      pass, and the inventory decreases from 289 to 288 with no exemption or
      rebaseline.
- [x] **QR-AA.** Complete the `cli/src/chat/use-chat-keyboard.ts` decomposition
      manually: extract the stable assembly argument contract while preserving its
      type re-export, memo dependency arrays, keyboard dispatcher mount, and disabled
      state behavior. The source decreases from 319 to 240 lines; the replacement is
      81 lines; the full package-scoped CLI suite passes 3242/18/0 with 9001
      assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      288 to 287 with no exemption or rebaseline.
- [x] **QR-AB.** Complete the `cli/src/chat/use-chat-layout.ts` decomposition
      manually: extract the pure controller-to-`ChatLayoutProps` projection while
      preserving hook invocation order, derived values, message-block synchronization,
      and the `chat.tsx` → `ChatLayout` call graph. The source decreases from 340 to
      137 lines; the replacement is 249 lines; the full package-scoped CLI suite
      passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass, and the
      inventory decreases from 287 to 286 with no exemption or rebaseline.
- [x] **QR-AC.** Complete the `cli/src/chat/use-chat-messaging.ts` decomposition
      manually: extract the public argument contract and pending ghost-bash flush
      lifecycle while preserving the messaging hook's prompt routing, queue state,
      attachment restoration, onboarding retirement, and `useChatInteractions` call
      graph. The source decreases from 362 to 292 lines; the replacement modules are
      44 and 59 lines; the full package-scoped CLI suite passes 3242/18/0 with 9001
      assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      286 to 285 with no exemption or rebaseline.
- [x] **QR-AD.** Complete the `cli/src/chat/use-chat-overlays.ts` decomposition
      manually: extract its public contracts and follow-up custom-event listener
      while preserving feedback, publish, review, command-result routing, prompt
      submission, analytics, and listener cleanup. The source decreases from 373 to
      279 lines; the replacement modules are 48 and 70 lines; the full
      package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 285 to 284
      with no exemption or rebaseline.
- [x] **QR-AE.** Complete the `cli/src/chat/use-chat-suggestions.ts` decomposition
      manually: extract the public argument/return contracts and the slash/mention
      menu-index reconciliation effects while preserving the suggestion engine wiring,
      slash tracking, mention select/replace, and slash execute/insert helpers, plus
      the `useChatInteractions` call graph. The source decreases from 341 to 270 lines;
      the replacement modules are 53 and 68 lines; the full package-scoped CLI suite
      passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass, and the
      inventory decreases from 284 to 283 with no exemption or rebaseline.
- [x] **QR-AF.** Rebaseline the eight ratchet-only baseline entries (auto-drive,
      defs/misc, drive-report, drive-status-panel, presence index/mapper/privacy,
      run-agent-step constants) to their measured counts — all already at or below
      300 lines. No source change, no exemption; the inventory decreases from 283
      to 275 with no remaining ratchet violations.
- [x] **QR-AG.** Complete the `cli/src/hooks/use-message-queue.ts` decomposition
      manually: extract the public `StreamStatus`/`QueuedMessage` type contracts
      while preserving the hook's queue/watchdog/stream orchestration and the
      re-export surface. The source decreases from 302 to 299 lines; the new module
      is 9 lines; focused tests, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 275 to 274 with no exemption or rebaseline.
- [x] **QR-AH.** Complete the `cli/src/hooks/suggestion-engine/filters.ts`
      decomposition manually: extract the self-contained `filterFileMatches` into a
      focused module while preserving the slash/agent filters and the re-export. The
      source decreases from 307 to 171 lines; the new module is 144 lines; the
      focused filter suite passes, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 274 to 273 with no exemption or rebaseline.
- [x] **QR-AI.** Complete the `cli/src/utils/clipboard.ts` decomposition manually:
      extract the renderer contract and registry while preserving OSC 52 copying,
      message state, and the re-export surface. The source decreases from 308 to 284
      lines; the new module is 34 lines; the focused clipboard suite passes,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 273 to 272
      with no exemption or rebaseline.
- [x] **QR-AJ.** Complete the `cli/src/components/message-with-agents.tsx`
      decomposition manually: hoist the duplicated `MessageBlock` element into a
      single shared variable (DRY) while preserving the memoized component, prefix
      branches, and children grid. The source decreases from 309 to 281 lines; the
      full package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 272 to 271
      with no exemption or rebaseline.
- [x] **QR-AK.** Complete the `cli/src/hooks/activity-query/cache.ts` decomposition
      manually: extract the retry/generation state into a focused module while
      preserving the cache entry/snapshot/GC orchestration and every public re-export.
      The source decreases from 310 to 295 lines; the new module is 35 lines; the
      focused activity-query/usage suites pass 110/0, the full package-scoped CLI
      suite passes 3242/18/0, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 271 to 270 with no exemption or rebaseline.
- [x] **QR-AL.** Complete the `run-agent-step-tools-part-b.test.ts` decomposition
      manually: extract the mock file-context fixture while preserving both
      set_output and handleSteps integration tests. The source decreases from 301
      to 274 lines; the new fixture is 28 lines; the focused suite passes 2/0,
      agent-runtime typecheck/ESLint/Prettier pass, and the inventory decreases
      from 270 to 269 with no exemption or rebaseline.
- [x] **QR-AM.** Complete the `sdk/src/credentials.ts` decomposition manually:
      extract the ChatGPT OAuth schema and credential contract while preserving
      every public re-export and the config-dir/file-path/refresh orchestration.
      The source decreases from 304 to 291 lines; the new module is 18 lines; the
      focused credentials suite passes 15/1/0, SDK typecheck/ESLint/Prettier pass,
      and the inventory decreases from 269 to 268 with no exemption or rebaseline.
- [x] **QR-AN.** Complete the `common/src/browser-actions/schemas.ts` decomposition
      manually: extract the browser-action defaults while preserving the response,
      config, and action schemas plus the re-export. The source decreases from 306
      to 270 lines; the new module is 37 lines; common typecheck/ESLint/Prettier
      pass, and the inventory decreases from 268 to 267 with no exemption or
      rebaseline.
- [x] **QR-AO.** Complete the `packages/agent-runtime/src/llm-api/docset-search.ts`
      decomposition manually: extract the SQL schema and FTS5 match-expression
      builder while preserving build/query/read/meta orchestration and the
      re-export. The source decreases from 306 to 268 lines; the new module is 40
      lines; the focused docset suites pass 14/0, agent-runtime typecheck/ESLint/
      Prettier pass, and the inventory decreases from 267 to 266 with no exemption
      or rebaseline.
- [x] **QR-AP.** Complete the `common/src/mcp/client.ts` decomposition manually:
      extract the timeout and env-substitution utilities while preserving the
      connect/list/call orchestration and error paths. The source decreases from
      309 to 250 lines; the new module is 58 lines; common typecheck/ESLint/Prettier
      pass, and the inventory decreases from 266 to 265 with no exemption or
      rebaseline.
- [x] **QR-AQ.** Complete the `scripts/audit-evidence.ts` and `scripts/fid-ledger.ts`
      decompositions manually: extract the audit type contracts and the shared
      `FidLedgerIssue` contract plus the anti-deferral step-status scan while
      preserving the public re-exports and `validate-repository` call graph. The
      parents decrease from 307 to 277 and 308 to 270 lines; the new modules are
      44, 4, and 43 lines; the audit/ledger suites pass 12/0, ESLint/Prettier pass,
      and the inventory decreases from 265 to 2

## Task 8 — Add KiosAPI provider (2026-09-05) — COMPLETE (closed + archived 2026-09-05)

> Operator wants `https://kiosapi.com/` added as a provider. Research complete
> (agent-reach web via Jina Reader + web search, 2026-09-05): KiosAPI is a
> fully OpenAI-compatible unified gateway (GPT, Claude, Gemini through one
> endpoint + key). No repo references exist yet. Nothing implemented —
> presentation only until the operator confirms the open questions below.

- [x] **K8-A. Confirm service identity: kiosapi.com (not kiosapi.id).**
      CONFIRMED by operator 2026-09-05 ("go").
      Research found TWO different services: `kiosapi.com` (global gateway,
      keys `sk-kilo-…`/`sk-…`, base `https://kiosapi.com/v1/`, docs
      `kiosapi.mintlify.app`, GitHub `kiosapi/docs`) vs `kiosapi.id`
      (Indonesian gateway by PT Mura Teras Kreatif, keys `kios_live_…`, base
      `https://api.kiosapi.id/v1`). Interpreted target is **kiosapi.com** per
      the operator's URL. BLOCKED on operator confirmation.
- [x] **K8-B. [Post-approval] Add Path-A registry entry** in
      `common/src/providers/registry.ts` (`kiosapi`: gateway, `KIOSAPI_API_KEY`,
      `https://kiosapi.com/v1`, protocol `openai`, idTransform `strip`,
      live catalog `https://kiosapi.com/v1/models`, setupAvailable true,
      domain `kiosapi.com`, order 4). No new shim — generic factory
      (`sdk/src/impl/model-provider/model-factories.ts:58-106`) handles it.
      Derived surfaces (prefixes, domains, validProviders, picker) update
      automatically. **Done 2026-09-05** — entry live at
      `common/src/providers/registry.ts:186-205`; FID-2026-0905-002 Steps
      1-5 `implemented`. **[Swept 2026-09-13: verified — entry now at
      `registry-partitioned.ts:16` after the partition refactor;
      FID-2026-0905-002 closed + archived 2026-09-05.]**
- [x] **K8-C. [Post-approval] Verify**: 2026-09-05 — cli typecheck
      exit 0; sdk typecheck exit 0; common provider suites 21/0 (24/0 at
      closure re-run); catalog family 28/0; gateway 12/0 (16/0 at closure
      re-run, 4 new KiosAPI tests); eslint 7 files exit 0; prettier clean;
      lint:md exit 0; reachability grep proves wiring; `fid:verify` 5 PASS /
      1 FAIL (`typecheck common` — pre-existing, see OOS below). **Live
      verification DONE** — operator confirmed ("kiosapi works")
      2026-09-05: authed `/v1/models` + chat round-trip.
- [x] **K8-D. Operator answers received 2026-09-05**: kiosapi.com confirmed
      (FID scope); env var **`KIOSAPI_API_KEY`** confirmed; key lives in
      **`.env.local`** AND submittable via **`/provider kiosapi`** CLI
      (both work with zero extra code — FID §Evidence). Remaining defaults
      taken: `/provider` picker visible, live catalog, `strip` transform.
      Only open item: the actual command is **`/model`** (not `/models`) —
      confirm that is what the operator means. **[Swept 2026-09-13:
      discharged — `/model` shipped and operator-confirmed ("kiosapi
      works" 2026-09-05, see K8-E).]**
- [x] **K8-E. FID-2026-0905-002 converged, operator said "go", implemented
      2026-09-05.** Live verification received same day ("kiosapi works");
      FID **closed + archived 2026-09-05**.
- [x] **K8-F. HARD REQUIREMENT (operator 2026-09-05): GLM-5.3-free must be
      included.** Parser + 4 tests encode it (shared gateway suite); live
      confirmation received 2026-09-05 ("kiosapi works") — the pass-through
      parser guarantees client-side carriage; escalate-if-absent rule
      stands.

## Task 10 — Zen runtime rejection: recursive JSON schemas (2026-09-05) — CLOSED + ARCHIVED

> Operator live-confirmed the fix ("it works") 2026-09-05:
> FID-2026-0905-004 status `closed`, moved to `dev/fids/archive/`,
> CHANGELOG entry appended, archival logged in the session summary.

> Operator said "go": **implemented 2026-09-05, FID-2026-0905-004 status
> `fixed` (Loop 2 audited); NOT `closed`.** Shared sanitizer
> (`schema-sanitize.ts`) + factory middleware on all 3 SDK branches;
> chat path byte-identical (suite green). Static gates: sdk/llm/cli
> typecheck 0; llm 87/0; zen 10/0; eslint/prettier/lint:md clean;
> `fid:verify` 3/1 (pre-existing). **BLOCKED on operator key**: live
> Spark-with-tools turn to confirm the upstream rejection is gone.
> Scratch repro suite removed after evidence capture (findings in FID).

> Operator testing a Zen model gets `Upstream request failed:
> [invalid_request_error] Recursive JSON schemas are not currently
> supported`. Code homework done (no fix yet): chat-path
> `inlineLocalSchemaRefs`
> (`packages/llm-providers/.../openai-compatible-prepare-tools.ts:34-75`)
> provably cuts `$ref` cycles to `{}` and strips `$defs` — a recursive
> payload CANNOT survive it, so a chat-protocol model should be immune;
> responses/Anthropic paths send SDK-serialized schemas raw (no inlining).
> No `z.lazy` in tool inputs; no `strict:true` injection found;
> `jsonValueSchema` uses are validation-only. BLOCKED on operator facts
> (model id, blast radius, cross-provider comparison) — see questions.

## [OPEN-OUT-OF-SCOPE → RESOLVED via FID-2026-0906-007, 2026-09-06] — desktop sidecar E2E env starvation

> **Discovered 2026-09-06 (T17-A verification leg); RESOLVED same session**
> by FID-2026-0906-007 (closed + archived): `env.ts` gained the `.env.local`
> bootstrap leg (two-pass findUp incl. a cwd fallback for compiled
> artifacts), and desktop joined the root `test` chain (12 workspaces).
> Live acceptance bare: smoke exit 0, sidecar E2E 4/0 in 5.9s, desktop
> suite 420/0 in 6.9s. The operator decision this item requested is
> discharged by the implemented fix — no separate ruling needed.

## [OPEN-OUT-OF-SCOPE] — common typecheck red in untouched test file

`bun run typecheck` in `common/` fails with 30 errors, ALL in
`common/src/__tests__/model-config.test.ts` (TS2593/TS2304 — missing
`bun:test` globals `describe`/`test`/`expect`). Zero errors in any file
touched by the KiosAPI work (verified by filtered re-run). The file was
already modified in the working tree before this session and the error
class cannot be caused by a registry entry. NOT silently fixed (Law 2 —
needs a blocking presentation): operator decides whether to authorize a
fix (likely a tsconfig `types` gap) or leave it. Consequence: `fid:verify`
for FID-2026-0905-002 reports 5 PASS / 1 FAIL and no receipt is stamped.

> **[RESOLVED — closed 2026-09-06]** Operator ruling: close as resolved.
> Live ground truth: `bun run typecheck` in `common/` exits 0 (verified
> 2026-09-06; the 30 errors no longer exist). The blocked receipt is now
> stamped — `bun run fid:verify dev/fids/archive/FID-2026-0905-002-… --write`
> → **6/6 PASS**, fingerprint `sha256:7be7d8ed…`, verified
> 2026-09-06T22:27Z; pending Commit-SHA evidence filled (`cb6288aa`, via
> `git log -S kiosapi`). Item closed with no code change required.

## Task 9 — Add OpenCode Zen provider (2026-09-05) — COMPLETE (closed + archived 2026-09-05)

> Operator wants OpenCode Zen (`https://opencode.ai/zen/v1`) as a provider:
> multi-model incl. free ones; "look into this deeper". Deep research done
> (official `opencode.ai/docs/zen` 0-EOF + live `GET /zen/v1/models` probe:
> HTTP 200, 70 models, public, no auth). This is NOT the existing
> `opencode-go` entry (different base `/zen/go/v1`, subscription-only,
> open-source-only, `OPENCODE_GO_API_KEY`). Nothing implemented — presentation
> only until the operator picks an option below.

- [x] **Z9-A. Findings.** **[Swept 2026-09-13: findings presented
      2026-09-05; superseded by Z9-E.]** Zen = pay-per-use gateway, key `OPENCODE_API_KEY`
      (same key works for Go per Docker docs, but separate env var per repo
      convention). 70 live models, bare ids, `owned_by: opencode`. FOUR wire
      formats: chat/completions (~19: DeepSeek, MiniMax, GLM 5/5.1/5.2/5.3/
      5.3-flash, Kimi, Big Pickle free, MiMo/Ling/Nemotron free,
      deepseek-v4-flash-free), Anthropic messages (15: Claude ×11, Qwen ×4),
      Responses API (~29: all GPT/Grok/Muse Spark incl.
      muse-spark-*-contributor-free), Gemini custom path (7). Factory
      supports the first two via protocolMap (opencode-go precedent); the
      latter two have NO factory support (only precedent: ChatGPT-OAuth
      Responses transform, `model-factories.ts:29-52`).
- [x] **Z9-B. Option A (recommended): Go-mirror Phase 1.** **[Swept
      2026-09-13: not selected — superseded by Z9-E full Option C.]** New `opencode`
      entry (label OpenCode Zen, `OPENCODE_API_KEY`, base
      `https://opencode.ai/zen/v1`, protocol `openai-anthropic`, `strip`,
      static catalog of the ~34 factory-supported models, new
      `OPENCODE_ZEN_PROTOCOLS` map + `ProviderProtocolMap` union extension,
      live or static picker catalog). Responses/Gemini models explicitly out
      (documented, fail-closed if requested). Effort ≈ KiosAPI × 3.
- [x] **Z9-C. Option B: live catalog + map.** **[Swept 2026-09-13: not
      selected — superseded by Z9-E full Option C.]** Same as A but picker reads
      live `/v1/models` (public, always fresh incl. deprecations) while
      dispatch stays map-gated; unsupported models visible but fail closed
      with a clear error. Risk: picker/requested-model disagreement.
- [x] **Z9-D. Option C: full Zen (deferred).** **[Swept 2026-09-13:
      SELECTED via Z9-E — implemented + closed 2026-09-05; verified
      `registry-partitioned.ts:119` + `OPENCODE_ZEN_PROTOCOLS` incl.
      responses + gemini legs.]** Add Responses-API factory
      support for GPT/Grok/Spark + decide Gemini path. Large scope, needs
      its own FID. NOT recommended now.
- [x] **Z9-E. Scope settled 2026-09-05: FULL (option C), no phases.**
      Routing id **`opencode-zen`**, picker visible, GLM rides along.
      Operator said "code": **implemented 2026-09-05; live verification
      discharged by operator confirmation ("zen works") same day;
      FID-2026-0905-003 closed + archived 2026-09-05.** Static gates:
      cli/sdk typecheck 0; common suites 28/0 (24/0 closure re-run);
      gateway 16/0; catalog family + setup combos 59/0; sdk free-mode 13/0
      (all 4 protocols); eslint/prettier/lint:md clean; `fid:verify` 5/1
      (pre-existing). **ATTENTION at commit**:
      `model-config/providers.ts` + `model-config.ts` carry
      `assume-unchanged` bits (edits on disk, invisible to git), and
      several test files present on disk are untracked — see summary.
- [x] **Z9-F. GLM clarification (operator: "glm was completed already?").**
      Resolved 2026-09-05: (i) KiosAPI GLM (K8-F) live-confirmed by the
      operator ("kiosapi works"); (ii) Zen's own glm-5.3 + glm-5.3-flash
      ride the supported chat/completions protocol and were included in the
      shipped scope. Both tracks done.

## Task 12 — Residue-backlog monolith decompositions (2026-09-05)

> Continues the accepted-residue backlog recorded in closed
> `FID-2026-0819-005` (5 source monoliths). Operator approved running the
> Perfection Loop + implementation on `-0905-001` (native.ts) and then
> opening the next monolith FID.

- [x] **R1. FID-2026-0905-001 (native.ts) — Perfection Loop + implementation
      approved and executed 2026-09-05.** RED-first: 12 characterization
      pins green on the 894-line monolith before any extraction. Extracted
      10 stage modules (`gate-context`, `gate-chain`, `pre-dispatch-gates`,
      `ehel-gate`, `hook-gate`, `result-lifecycle`, `client-tool-bridge`,
      `trace`, `steering`, `write-bookkeeping`); facade `native.ts` 894 →
      249 lines. Suite parity 1335/0 (3399 expects) pre/post; barrel
      byte-identical; typecheck/eslint/prettier/lint:md clean; receipt
      stamped 4/4 PASS; baseline 852 → 249. **Step 5 `blocked` (operator):**
      G2 commit hash for closure + archive.
- [x] **R2. Next monolith FID opened + implemented: `FID-2026-0905-004`
      (gateway.ts).** Target chosen over `public-release.ts` (sequencing:
      -0903-001 lands in that file at the next release cut). Measured
      1,327 lines; single production caller (`server-command.ts:17`).
      Perfection Loop ran to convergence (Loop 2: state contract + transport
      stays in facade + fidStatuses encapsulated; Loop 3: <2% delta) and the
      operator approved implementation 2026-09-05. RED: 5 injectTriggerRun
      pins green on the monolith (plus RED finding 5 — a real `request()`
      race in `gateway-test-harness.ts` that made `gateway.test.ts` flaky
      under the repo-root gate runner; fixed by returning the id-matched
      frame). Extracted 8 `gateway/` stage modules; facade 1,327 → 236
      lines; suite parity 35/0 / 163 expects both cwds; receipt 6/6 PASS;
      quality-report unlisted. **Step 6 `blocked` (operator):** G2 commit
      hash for closure + archive.
- [x] **R2.5. Next monolith FID opened: `FID-2026-0905-005`
      (office-scene.tsx).** Measured 2,126 lines; single production caller
      (`deck-view.tsx:24/:164`); RED gap: the scene's pure logic (labelFor,
      makeThinkingPredicate) is module-private, zero direct coverage — RED
      step 1 = minimal verbatim logic extraction + pins before any component
      move. T15-H boundary respected (old stage modules untouched). Gates
      validated live at authoring (desktop typecheck 0, sibling suites
      green). **Implemented 2026-09-05 (operator approved the full loop):**
      RED 13/0 pins; Loop 2 settled bus single-ownership, targetFor
      cohesion, environment promotion; 14 `scene-*` modules + 179-line
      facade (2,126 → 179; four stage modules ceiling-split at audit:
      desk-props, identity, agent-fx); suite parity 413/0 / 5,718 expects;
      receipt 6/6 PASS; quality-report unlisted. **Step 6 `blocked`
      (operator):** G2 commit hash for closure + archive.
- [x] **R3. [RESOLVED 2026-09-05 → FID-2026-0905-007 `fixed`] Remaining
      residue after R1/R2/R2.5:** `desktop/src/floor/office/office-scene.tsx`
      resolved by -0905-005; `scripts/public-release.ts` (3,065 → 178 facade
      over 23 domain modules, largest 294; surface-verified; 57/0/216 parity);
      `scripts/__nt-before-snapshot.ts` (895) deleted as a superseded untracked
      snapshot of pre-decomposition native.ts ("before" state is in git
      history at 2cc377e). **quality:report now 0 violations.** Closure
      awaits the G2 commit hash.
- [x] **R4. [RESOLVED 2026-09-05 → FID-2026-0905-006 `fixed`] Provider-drift
      baseline violations (13):** 10 baseline regenerations, 2 test splits,
      1 data-catalog exemption; env-sanitize lists derived from config
      (leak class eliminated); quality:report 15 → 2. R5 also resolved
      (bun:test imports in common model-config.test.ts; common typecheck 0).
      Closure awaits the G2 commit hash.
- [x] **R5. [RESOLVED 2026-09-05] `common/` typecheck red (30 errors):**
      missing `bun:test` globals in `model-config.test.ts` — fixed via
      explicit `bun:test` imports (repo convention); common typecheck 0,
      suite 6/0. Recorded in FID-2026-0905-006.

## Task 16 — v0.0.29 release-night audit + desktop release blockers (2026-09-06)

> Operator directive: "we shipped 0.0.29 last night — see where we stand,
> why we had so many issues" then "the real story is the desktop is still
> unreleased — dig deeper" then "make the 2 files, run perfection then
> present". Audit findings (all tool-evidenced): phantom-source
> assume-unchanged incident (fixed at 4d85b6b), gateway watchdog flake
> (gate attempt 1, 2 tests), desktop stages silently skipped
> (SAVANT_CODE_RELEASE_DESKTOP unset), desktop workflow failed on both
> platforms (corrupted signing secret; missing Linux apt deps), latest.json
> never produced. Desktop has never shipped (only 2 runs of
> desktop-release.yml ever, both 2026-09-06).

- [x] **T16-A.** Author `FID-2026-0906-001-desktop-release-workflow-repair.md`
      (signing-secret preflight + Linux system deps) with Perfection Loop
      converged, gates declared and run green (28/0), operator presented.
- [x] **T16-B.** Author `FID-2026-0906-002-release-pipeline-desktop-visibility.md`
      (loud skips + receipt record + flag-independent POST_RELEASE_VERIFY
      assert) with Perfection Loop converged, gates declared and run green
      (28/0), operator presented.
- [x] **T16-C.** Implement FID-2026-0906-001 Steps 1-3 (RED pins → YAML
      edits → audit) — **done 2026-09-06 (automation level 3):** 3 workflow
      pins RED-first (8/3), GREEN edits to both workflows, audit 11/0 +
      YAML parse OK; Loop 4 recorded; receipt stamped 4/4 PASS; status
      `fixed`.
- [x] **T16-D.** Implement FID-2026-0906-002 Steps 1-4 (RED pins →
      catalog/transaction/stages-verify → parity audit) — **done
      2026-09-06 (automation level 3):** 8 pins RED-first, GREEN across
      catalog/desktop-stages/transaction/stages-verify, audit 46/0 +
      sibling parity 44/0 + live `--preview` SKIPPED lines + quality PASS;
      test split for the 300-line ratchet (claim file 136 lines); Loop 4
      recorded; receipt stamped 5/5 PASS; status `fixed`.
- [x] **[OPEN-OUT-OF-SCOPE → resolved]** Release-provenance guard:
      authored 2026-09-06 as
      `dev/fids/FID-2026-0906-003-release-provenance-guard.md` (status
      `analyzed`, receipt 2/2 PASS) after the operator added it to scope.
      Audit corrections vs. this entry's draft claims: tag↔commit binding
      already exists (`git-publish.ts:76`, `github-api.ts:74`) and desktop
      SHA binding partially exists — the real gap is the empty-`head_sha`
      bypass (`desktop-stages.ts:72-74`, `desktop-workflow.ts:75`). The
      three actual guards: hidden index-state detection, clean-checkout
      compile gate, empty-SHA fail-closed. NOT yet implemented.
- [x] **T16-I.** Desktop Linux icon defect (discovered during the T16-F
      scratch run 34044435124, run 3): `tauri-build`'s compile-time macro
      embeds `icons/icon.png` for non-Windows targets; only `icon.ico`
      existed (committed `icon.ico`, no png anywhere — `git ls-files` +
      `ls icons/` empty for pngs), so every Linux build died at
      "failed to open icon .../icon.png: No such file or directory"
      (job 101516846405). Fixed 2026-09-06: generated
      `icon.png`/`128x128.png`/`32x32.png` from the .ico's 48x48 32bpp
      BGRA layer (alpha mask honored; 41.6% opaque; round-trip-verified
      encoder in `dev/scratchpad/generate-desktop-icons.ts`) and extended
      `tauri.conf.json` `bundle.icon` to include them. RED evidence = the
      CI failure log above; GREEN = generator verification output.
- [x] **T16-E.** Signing secret RESOLVED BY RECOVERY 2026-09-06: the
      original keypair was found at `desktop/tauri-key.key` (gitignored,
      never committed), verified paired with the committed updater pubkey
      (`tauri.conf.json`), and re-set via `gh secret set` — proven by three
      consecutive green Windows bundle builds (runs 34042941045 /
      34044435124 / 34045779966 / 34048699120). No regeneration needed;
      existing installs keep trusting the key.
- [x] **T16-J.** Linux AppImage saga (runs 4/5/6) + operator decision:
      linuxdeploy dies without FUSE (fix: APPIMAGE_EXTRACT_AND_RUN), then
      still dies at strip (fix: NO_STRIP), then — with --verbose exposing
      the swallowed stderr — the real crash: the GTK plugin's second
      linuxdeploy pass core-dumps on `ldd` against the patchelf-rewritten
      static bun sidecar (oven-sh/bun#28281 class; tauri-apps/tauri#14796;
      fix pending tauri#12491; a surviving bundling would ship a corrupted
      sidecar; excluding the sidecar breaks the updater key-set/.sig
      contract). Operator chose the WINDOWS-ONLY updater manifest: deb-only
      Linux leg (plain asset), generator key set windows-only, appimage
      dropped from tauri.conf.json targets. 45/0 across the six desktop
      suites.
- [x] **T16-K.** Desktop assets ATTACHED to v0.0.29 (2026-09-06, operator
      approved): run 34050762638's artifacts — signed NSIS+MSI, Linux deb,
      `.sig` sidecars — uploaded via the pipeline's own
      `uploadDesktopAssets` after regenerating `latest.json` locally with
      the fail-closed generator (its exit is the assertion the artifacts
      survived the round-trip). Live-proof caught the updater URL defect
      (GitHub stores spaces as dots; `%20` form 404s) — fixed
      (FID-2026-0906-004), manifest re-uploaded, updater chain verified
      end-to-end: pinned endpoint → manifest → artifact URL HTTP 200 →
      sha256 byte-identical to the CI build. **Windows desktop
      auto-update is live for v0.0.29.** The attach also proved the
      `DESKTOP_RELEASE` download-layout defect RED-first
      (`flattenDownloadedArtifacts`).
- [x] **T16-L.** FID-2026-0906-003 (release-provenance guard)
      IMPLEMENTED 2026-09-06: index-state assertion via `git ls-files -v`
      wired mode-aware into `verifyPreflight`; clean-checkout compile gate
      (detached worktree at HEAD + frozen-lockfile install + typecheck
      chain, removed on every path) wired into the GATES stage before
      evidence finalization; desktop `head_sha: ''` now fails closed.
      48/0 across the six pipeline suites; quality ratchet PASS. Status
      `fixed` — closes on the first cut running all three guards.
- [ ] **T16-F.** Live validation: first green `desktop-release.yml` run
      (FID-001 closure — met, run 34050762638; archived) + next release
      cut's loud desktop decision (FID-002 closure).
- [x] **T16-G.** Session summary `2026-09-06-v0.0.29-release-night-audit.md`
      + LEARNINGS entry (`assume-unchanged-phantom-source`) — written
      2026-09-06; audit trail verified git-committed 2026-09-07 (`git
      ls-files` shows the summary tracked; landing commits 7e441d8/3c4f825
      era).
- [x] **T16-H.** G2 commit hash stamps into both FID Implementation
      Evidence sections + path-scoped commits (G1/G3/G8) — discharged by
      the T17-C closure ceremony (7790bb3): G2 SHAs ground-truth-resolved
      and receipts re-stamped at the archived FID paths; remaining
      path-scoped commits continue per operator approval.

## Task 17 — Operator rulings on the three OPEN-OUT-OF-SCOPE items (2026-09-06)

All three open items presented with current ground truth; operator ruled on
each 2026-09-06. This section is the audit trail.

- [x] **Ruling 1 — desktop bundle size (+R3F deps): AUTHORIZED
      OPTIMIZATION.** Lazy-load the 3D stack in the desktop renderer so the
      initial shell does not carry the R3F/drei/postprocessing bundle
      (~+150KB gz). Reverses the earlier YAGNI acceptance. Contracted as
      **T17-A** (FID-first).
- [x] **Ruling 2 — office visual presentation: AUTHORIZED BUILD.** The
      environment + character presentation layer (walls, room zones, personal
      desk furniture, articulated character detail, in-scene speech bubbles)
      is approved as a work item; visual smoke is re-run after it. T15-F and
      T15-H unblock on a **passing smoke**, not on this authorization.
      Contracted as **T17-B** (FID-first).
- [x] **Ruling 3 — common typecheck red in untouched test file: CLOSED AS
      RESOLVED.** Ground truth 2026-09-06: `bun run typecheck` in `common/`
      exits 0 — the 30 `model-config.test.ts` errors no longer exist. The
      consequence is also gone: `fid:verify
      dev/fids/archive/FID-2026-0905-002-kiosapi-provider.md --write` →
      **6/6 PASS**, fingerprint `sha256:7be7d8ed…` stamped (verified
      2026-09-06T22:27Z), and the FID's pending Commit-SHA evidence filled
      with `cb6288aa` (via `git log -S kiosapi --
      common/src/providers/registry.ts`). No code change was required.

### New work items from the rulings

- [x] **T17-A.** Desktop renderer: lazy-load the 3D stack (R3F + drei +
      postprocessing) behind a dynamic import so first paint of the shell is
      bundle-clean. **Done 2026-09-06 (FID-2026-0906-005):** single seam in
      `office-lazy.tsx` + Suspense placeholder; structural pins hold the
      boundary. Build evidence: eager shell 151.75 kB gz with zero
      three/R3F content; 3D chunk 339.80 kB gz loads on first Deck
      navigation only (~190 kB gz saved, ruling estimated ~150 kB). Closes
      on the v0.0.30 operator smoke.
- [x] **T17-B.** Office environment + character presentation layer —
      **premise superseded, executed as audit + smoke handoff
      (FID-2026-0906-006, converged 2026-09-06):** FID-2026-0905-005
      (2026-09-05) already built and composed the full layer (walls,
      windows, bookshelves, textures, 15-prop layer, 6+9 desks, rigged GLB
      robot cast, in-scene bubbles, neon-noir atmosphere) — the 08-31
      smoke finding predated it. Per-element audit table in the FID;
      re-building rejected (Law 7). Acceptance = the operator visual
      smoke at the v0.0.30 pre-cut; T15-F closes and T15-H unblocks on a
      passing smoke.
- [x] **T17-C. v0.0.30 cut — operator-held (automation level 3: local
      commits only, no push to main).** **Superseded 2026-09-06 by operator
      ruling** ("completed = close + archive + changelog immediately; stop
      worrying about the release"): the ground-truth closure ceremony
      closed + archived all seven then-active FIDs (0903-001, 0905-009,
      0906-002/-003/-004, -005, -006) — G2 SHAs ground-truth-resolved
      (`a7ed2adc`, `8ff0657b`, `6222978`, `bea0188`+`d8514d1b`,
      `dd10723c`), 66/0 consolidated battery, receipts re-stamped at the
      archived paths, CHANGELOG amended. The live validations formerly
      used as closure conditions (first in-cut `DESKTOP_BUNDLES` dispatch,
      `BACKUP_BUNDLE` run, receipt `desktopStagesSkipped` field,
      provenance guards' first cut, lazy-chunk visual smoke) remain on
      the operator's cut-day list as runtime validations — not closure
      gates. `dev/fids/` now holds only the README.

## Task 18 — Three new gateway providers: TabiToken, GoRouter, VyceAI (2026-09-06) — CLOSED (withdrawn 2026-09-07)

Operator directive: add the three gateways researched live this session
(`tabitoken.com`, `gorouter.app`, `vyceai.com`). Executed as
FID-2026-0906-008 (full Perfection Loop, RED-first): all three implemented
2026-09-06 with every static gate green (commit `ff1ea8f`). **Operator
withdrawal 2026-09-07 after live keyed testing** (keys from
`~/.savant-code-dev/credentials.json`): VyceAI disabled by directive;
GoRouter dead per operator; TabiToken auth/catalog/billing all healthy
(200s) but its `/v1/chat/completions` path is Cloudflare-WAF-blocked (403
in every client variant probed) and its catalog serves zero models. Per
operator rulings ("disable the vyce provider", "gorouter is dead", "go
ahead and remove tabi too"), **all three were removed** — registry
entries, exception-manifest entries, fetchers (`tabitoken.ts`/
`gorouter.ts`/`vyceai.ts`), gateway wiring, barrel exports, the cluster
test suite, README lines, generated provider docs. Registry restored to
11 providers / 9 setup providers. Gates at removal: typecheck ×4, common
providers 30/0, cli gateway 16/0, quality ratchet PASS,
`generate:provider-docs:check` exit 0, `lint:md` clean,
`validate:repository` PASS. FID-2026-0906-008 **closed + archived** with
the full evidence matrix in its Resolution + Lessons Learned; CHANGELOG
entry amended. Side-effect bookkeeping: `use-chat-pickers.ts` baseline
bumped 244 → 265 (honest measured count; growth belongs to
FID-2026-0907-001's picker-focus fix, `analyzed`), and the FID index's
stale `fixed` rows for `-0903-001`/`-0905-009` (archived in the T17-C
ceremony) were corrected. `dev/fids/` now holds only the README.
**Amendment 2026-09-07 (post-closure):** FID-2026-0907-001 is now
**closed + archived** (see Task 19) — the baseline growth it carried was
its legitimate implementation.

## Task 19 — Picker dismissal kills chat input focus (2026-09-07)

> Operator report: "after adding a provider, i cannot type or click the
> input box, it seems very random though, i cannot reproduce the issue."
> Diagnosis (all files read 0-EOF this session): dismissing any of the
> three picker overlays (model / provider / rewind) with **Escape or a
> backdrop click** leaves `inputFocused=false` permanently — only the
> select paths restore focus (`use-chat-pickers.ts`), the dismissal paths
> collapse to the raw store close (`build-chat-layout-props.ts:186`), and
> the input cannot self-recover because both the typing gate
> (`use-multiline-keyboard.ts:148`) and the click gate (`mouse.ts:19`)
> early-return on the same `focused` prop. Repro: open `/provider`, press
> Escape → input dead; reopen and select → input returns. Operator chose
> "Implement fix + FID" via ask_user 2026-09-07.

- [x] **T19-A.** Author `FID-2026-0907-001-picker-close-focus-loss.md`
      (RED/GREEN/AUDIT, severity high) and present the fix design. **Done
      2026-09-07** — fix design presented and approved via ask_user
      ("Implement fix + FID") before any code (Law 2). **Self-correction
      recorded:** the FID was initially written with a pre-filled receipt;
      reverted to `analyzed` with an empty receipt before implementation —
      receipts are machine-stamped only after gates run.
- [x] **T19-B.** Implement the single-seam fix: symmetric open/restore
      focus effect in `use-chat-pickers.ts:119-147` + pure predicate
      `cli/src/chat/picker-focus-transition.ts` + regression suite
      `cli/src/chat/__tests__/picker-focus.test.ts` (6/0, RED-first). **Done
      2026-09-07** — typecheck cli 0, eslint clean, prettier clean,
      lint:md clean, `fid:verify` receipt 2/2 PASS, FID status `fixed`.
- [x] **T19-C. Operator live smoke (closure arm):** open `/provider` and
      `/model`, dismiss with Escape AND with a backdrop click; confirm the
      input accepts typing and clicks immediately after each dismissal.
      **Done 2026-09-07** — operator confirmed: "I ran the live smoke —
      Escape and backdrop dismissal both restore the input."
- [x] **T19-D. Close + archive FID-2026-0907-001 + CHANGELOG entry after
      T19-C.** **Done 2026-09-07** — status `closed` with the live
      acceptance recorded in Resolution + Implementation Evidence;
      receipt re-stamped 2/2 PASS after the closure edits;
      moved to `dev/fids/archive/`; CHANGELOG entry added under
      Unreleased.

## Task 20 — Harness-honesty gates: FID-2026-0907-002 (2026-09-07)

> Operator directive: "Implement FID-2026-0907-002's four honesty gates"
> (the FID was authored by a parallel learnings-review session, status
> `analyzed`, Perfection Loop converged 3 loops). Implementation executed
> 2026-09-07 per the converged plan, with one recorded architecture
> correction (Loop 4 in the FID).

- [x] **T20-A. Step 1 — Ripgrep honesty.** Resolver's exhausted-candidates
      throw names every attempted candidate path (never an interpolated
      `undefined`) + remediation; new memoized `probeRipgrepAvailability`
      (`sdk/src/native/ripgrep.ts`); boot-time warn-only probe wired in
      `cli/src/init/init-app.ts:30-44`.
- [x] **T20-B. Step 2 — Edit-size guidance.** Shared truncation constant
      canonicalized in `common/src/constants/read-files.ts` (Loop 4
      correction: the plan's sdk-import would be a workspace cycle — sdk →
      agent-runtime is the dependency direction); sdk re-exports;
      `processStrReplace` appends size context + ranged-read remedy to
      BOTH match-failure shapes over threshold; sibling suite 3/0 (main
      suite at 264 lines — 300 ceiling forbids extending).
- [x] **T20-C. Step 3 — Exit-code audit.** `scripts/audit-exit-codes.ts`
      (pure detector: pipe into tail/head/tee then `echo $?` within 3
      lines; comments exempt; git-ls-files collector per the learnings
      rule); wired into `validate:repository` as `audit.exit-code-masking`;
      suite 8/0.
- [x] **T20-D. Step 4 — Clean-room verify.** `scripts/verify-clean.ts`
      composing `assertCleanCheckoutCompiles` (Law 13); root `verify:clean`
      script; suite 9/0 (mock runner); **live acceptance: `verify:clean
      PASS — ff1ea8f61 (v0.0.30) compiles from a clean checkout (133.9s)`.**
- [x] **T20-E. Gates + receipt.** `fid:verify` receipt **5/5 PASS**
      (typecheck sdk/cli, the three test gates); eslint clean;
      prettier clean; five honest baseline bumps recorded.
- [x] **T20-F. [OPEN-OUT-OF-SCOPE → RESOLVED 2026-09-07 (operator ruling):]
      Parallel-session draft collides with Step 3 and breaks the quality
      gate.** `scripts/audit-silent-failure.ts` (untracked, 364 lines —
      over the 300 absolute ceiling, unwired, no FID, no tests) contained
      its own `checkExitCodeMasking` overlapping T20-C plus three further
      check families (empty-catch, promise-singleton, withTimeoutNoAbort).
      It appeared AFTER the 2026-09-07 A-Z review ran `quality: PASS`.
      **Operator ruling:** the parallel session is no longer running; the
      surviving agent is in the driver's seat. Resolution: QUARANTINED to
      `dev/scratchpad/active/audit-silent-failure-draft.ts` (off the
      gated tree — dev/ is not a quality sourceRoot; the three unwired
      check families preserved as future-FID material; the wired + tested
      T20-C stands as the exit-code guard). Gates post-ruling:
      `quality: PASS (1467 files)`, `validate:repository: PASS`.
- [x] **T20-G. Close + archive FID-2026-0907-002 + CHANGELOG entry.**
      **Done 2026-09-07** — status `closed`, receipt re-stamped 5/5 PASS
      after closure edits, moved to `dev/fids/archive/`, CHANGELOG entry
      added under Unreleased, FID index updated. Commit SHA pending the
      G2 stamp at the archived path.

## Task 21 — NDJSON Phase B emitter: FID-067 v2 delegation transport, child side (2026-09-07)

> Operator directive: implement `dev/build-orders/BO-2026-09-07-ndjson-
> phase-b-emitter.md` (now fully self-contained — the frozen wire contract
> is embedded verbatim as §Frozen Wire Contract; the canonical copies live
> in the Savant parent repo). Five FIDs per the BO's phased build order:
> Phase 1 emit (003 activation+frames, 004 handleEvent tap, 005 artifact+
> error+stdout purity), Phase 2 control (006 stdin reader), Phase 3 prove
> (007 handoff matrix + cross-repo smoke). The operator directive to
> implement converts the BO's planning into approved scope (Law 2).
> Ground-truth discoveries at intake: the child's `PrintModeEvent` stream
> has NO native iteration/tokens/success/duration fields — the frozen
> payload shapes are synthesized child-side (counters, wall-clock, and
> "completed = tool_result arrived; failures arrive as error events"),
> documented per-FID; `runHeadlessPrint` RETURNS the answer (the stdout
> write lives in `cli-command-dispatch.ts`), so artifact emission happens
> in the run and stdout suppression happens in the dispatch.

- [x] **T21-A. FID-2026-0907-003 — JSON-mode activation + frame module**
      (BO Phase 1 FID 1): declared `--json` option (Commander = argv-exact),
      `cli/src/headless-ndjson.ts` frame module (strict envelope
      `{v:1,type,ts,data}`, real epoch-ms, `JSON.stringify`-per-line
      newline escaping, control-frame parser). Gates: unit suite. **Done
      2026-09-07** — module 291 ln + suite 18/0 green (re-run in the
      2026-09-07 repo audit), typecheck cli 0, receipt 2/2 PASS;
      audit-confirmed `fixed`/pending (pure module by design — wiring
      rides FIDs -004/-005/-006, closure sequenced after FID-007's
      cross-repo smoke).
- [x] **T21-B. FID-2026-0907-004 — handleEvent tap → progress frames**
      (BO Phase 1 FID 2): the five ratified kinds mapped from
      `tool_call`/`tool_result`/`activity`/`reasoning_delta` events;
      JSON-mode-only emission; non-JSON path untouched. **Done
      2026-09-07** — pure tap module `headless-ndjson-tap.ts` (96 ln)
      + `runHeadlessPrint` jsonMode wiring + dispatch `--json`
      threading; suites 40/0 across tap/ndjson/run; typecheck cli 0;
      receipt 4/4 PASS; error-event frames deferred to FID-005
      (recorded in both FIDs, discharged there).
- [x] **T21-C. FID-2026-0907-005 — artifact + error frames; stdout purity**
      (BO Phase 1 FID 3): exactly one artifact frame at the answer point,
      dispatch suppresses the raw stdout write in JSON mode, error frames
      before nonzero exits. **Done 2026-09-08** — emitter hoisted above
      every exit boundary (usage/init failures frame too); artifact at
      the answer point carries the exact `--print` answer; error frames
      at all four nonzero boundaries + mid-run error events (FID-004's
      deferral discharged); pure `headless-outcome.ts` seam suppresses
      the raw stdout write in JSON mode while stderr stays
      byte-identical both modes; 50/0 across the four suites; honest
      baseline bump headless-run.ts 284 → 296; receipt 5/5 PASS.
- [x] **T21-D. FID-2026-0907-006 — stdin control-frame reader** (BO Phase 2
      FID 4): cancel → abort at boundary; steer accepted + parked; unknown
      skipped; EOF harmless. **Done 2026-09-08** — authored (full Perfection
      Loop) and implemented RED-first: `headless-control.test.ts` 5 pins
      (2 pass/3 fail pre-wiring → 55/0 across the five headless suites),
      typecheck cli 0, quality PASS after the ceiling-forced
      `headless-answer.ts` seam move (headless-run.ts 294 ln, comment-only
      condensation), receipt 5/5 PASS, **closed + archived** same day per
      the T17-C standing directive. The live parent→child round-trip
      remains FID-007's Phase 3 boundary (T21-E) — never claimed here.
- [x] **T21-E. FID-2026-0907-007 — handoff test matrix, live** (BO Phase 3
      FID 5): the 6-case matrix as real-process tests + the cross-repo
      smoke (operator-assisted). **Done 2026-09-08** — authored (full
      Perfection Loop) and executed live to **6/6** against the actual CLI
      child (deterministic fake gateway + `INFERENCE_BASE_URL` direct-mode
      bare-slug seam). The matrix caught FOUR transport defects the
      in-process DI suites structurally could not see, all fixed forward
      per the BO's Phase 3 contract: (1) the env boot banner polluted
      stdout in both modes (`console.log` → `console.error`); (2) the
      default NDJSON frame writer omitted the `\n` delimiter (frames
      glued on one line); (3) a mid-stream cancel rode the 90s run timeout
      because a held LLM request yields no stream boundaries →
      arrival-time `onCancel` abort (run-side semantics extracted to the
      new `headless-control-plane.ts` for the 300-line ceiling); (4) the
      SDK's generic cancel message masked the parent reason →
      `PARENT_CANCEL_REASON` framed when this child consumed the cancel.
      One test pin corrected to ground truth (v1 emits `answer\n\n`);
      matrix split harness + part-a + part-b. Gates: typecheck cli 0,
      headless suites 56/0, eslint/prettier clean, quality PASS (honest
bump headless-run.ts → 297), receipt 3/3 PASS. **Closed + archived
      2026-09-08** (operator closure directive; receipt re-stamped at the
      archived path with all three gates re-run live); the cross-repo
      smoke (real Savant parent) carries OPEN as the operator-assisted
      boundary — never claimed by this record.

> **2026-09-08 closure amendment (Task 21):** T21-A/-B/-C (FIDs
> -003/-004/-005) were **closed + archived 2026-09-08** by the operator
> closure directive. Each was scope-complete with a green receipt (2/2,
> 4/4, 5/5 PASS); the recorded "archive after FID-007's cross-repo smoke"
> sequencing pointed at a FID that was never authored — the honest options
> were archive-on-own-evidence or hold against a phantom dependency, and
> the operator's standing directive ("completed = close + archive +
> changelog immediately", T17-C) chose the former. Any wire defect found
> at the future live matrix fixes forward against the archived records.
> Receipts re-stamped at the archived paths with all gates re-run live
> (28/28 PASS across the six-FID stamping battery).

## Task 22 — APInex gateway provider: FID-2026-0907-008 (2026-09-07)

> Operator request: "i am interested in adding this provider
> https://apinex.bond/models" (2026-09-07). Contract from the provider's
> machine-readable `llms.txt`: base `https://api.apinex.bond/v1`, Bearer
> auth (`sk-apx…` keys), vendor-slash model ids (`gpt/5.6-luna`),
> authenticated live catalog. The one-entry runbook governed the build
> (`docs/archive/design/Adding New Providers.md`). Same-day repo audit
> (this session) ground-truthed the module, tests, and gates.

- [x] **T22-A. Steps 1-3 (registry + wrapper + docs): `implemented`** —
      `apinex` registry entry (12th provider, post-withdrawal count),
      Nous-shaped wrapper `cli/src/utils/openrouter-models/apinex.ts`
      (`resolveKey: () => process.env.APINEX_API_KEY`), `gateway.ts`
      aggregation, provider-exception-manifest live-catalog entry,
      regenerated provider docs. All 8 static gates green (typecheck ×4,
      4 suites); audit re-ran the apinex + ndjson suites 2026-09-07:
      22/0. Receipt 8/8 PASS (re-stamped after the audit's factual fix:
      provider count 14 → 12).
- [x] **T22-B. Step 4 — keyed live acceptance (closure gate, operator):**
      set `APINEX_API_KEY` (`sk-apx…` from the APInex dashboard), then
      keyed `/v1/models` returns an OpenAI-shaped list; `/model` lists
      `apinex/…` entries; one chat round-trip on a `health: "live"`
      model; missing-key fail-closed message correct. **The FID does not
      close without this** (FID-2026-0906-008's withdrawal vindicated the
      keyed gate). After acceptance: close + archive FID-008, CHANGELOG
      entry. **Done 2026-09-08** — the operator's key (repo `.env.local`)
      drove the real production chain: `fetchGatewayModels` returned
      1,116 combined models incl. **22 `apinex/…` entries**; chat
      round-trip on `free/glm-5.3-flash` (public health table: **live**,
      all 22 rows live) → **HTTP 200, content `"OK"`**; no-key catalog
      probe → **401 fail-closed**. Operator UI observation (zero apinex
      models in `/model`) root-caused to a stale dev session whose
      process env predates the key landing in `.env.local` — a keyed
fetch had already written the same 22 models into the dev disk
      warm-start cache; restart shows them. FID-008 **closed +
      archived 2026-09-08**, receipt re-stamped 8/8 PASS, CHANGELOG
      entry added.

## Task 23 — A-Z repo audit: docs sync + bloat sweep before the v0.0.30 cut (2026-09-08)

> Operator directive (desktop skipped again): "first we need an a-z audit done
> of the entire dir, ensure all docs are fully updated, readme is fully
> updated, no bloat files and everything is fully organized/updated. No dead
> files, no outdated info." Executed as a RED discovery pass (Detective
> evidence sweep + tree inventory + drift gates) → hybrid direct-write
> remediation.

- [x] **T23-A. Drift gates.** version:check PASS, generate:provider-docs:check
      PASS, generate:protocol-bundle:check PASS, learnings:check PASS (16
      entries), hygiene:check PASS. skills:check FAIL (17 errors / 29
      warnings) — repo-scoped: two half-materialized skill dirs
      (`.agents/skills/fid-gates-unfenced-parser-contract/` +
      `minisign-pubkey-vs-secret-key/`: tracked `versions/v1/SKILL.md` +
      `VERSIONS.jsonl` but no top-level SKILL.md) + `.quarantine/` policy
      findings; home-dir findings out of repo scope. **Flagged to the
      operator — skill trust is operator-only, nothing auto-promotes.**
- [x] **T23-B. Stale version claims fixed.** README.md + README.zh-CN.md
      Release badges and hero quotes → v0.0.30 (0.0.29 compressed to
      "previously shipped"), docs/SAVANT-VERSIONING.md, docs/privacy.md.
- [x] **T23-C. Undocumented features added.** `--print ... --json` NDJSON
      delegation transport documented in README.md, README.zh-CN.md,
      docs/features.md, docs/installation.md (FID-2026-0907-003..006);
      APInex added to every provider list it was missing from (README.md,
      README.zh-CN.md, docs/features.md — where KiosAPI + OpenCode Zen were
      also missing — docs/installation.md table, docs/index.md);
      `verify:clean` added to the docs/public-release.md cut-day checks.
- [x] **T23-D. Outdated info fixed.** docs/privacy.md BYOK env-var inventory
      gained `KIOSAPI_API_KEY` + `APINEX_API_KEY`;
      docs/release-notes-v0.0.28.md "Status: pending release" → shipped
      2026-09-03.
- [x] **T23-E. Bloat/dead-file sweep verdict.** Suspected root items are
      load-bearing, NOT dead: `coding-standards/` (ECHO.md ×8 + protocol
      bundle + Verifier), root `ECHO-single-agent.md` (intentional boot-gate
      marker; canonical copy `dev/echo-v0.1.2-single-agent.md`), `assets/`
      (desktop loaders + README banner). `debug/` + `firebase-debug.log` are
      gitignored local runtime files. `art/` is tracked brand assets,
      unreferenced by code — kept (operator may prune). **Zero tracked dead
      files found; zero deletions made.**
- [x] **T23-F. Gates.** lint:md exit 0; version:check PASS;
      validate:repository PASS; quality PASS (1467 baselined files).
