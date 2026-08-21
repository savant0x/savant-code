# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

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
      FID-2026-0817-005. **Complete 2026-08-18** — FID-2026-0818-009 closed
      + archived; live Discord presence verified by operator.

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
      14 assertions and the full package-scoped CLI suite passes 3242/18/0 with 9001
      assertions; typecheck/ESLint/Prettier pass, and the inventory decreases from
      291 to 290 with no exemption or rebaseline.
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
      CLI suite passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass,
      and the inventory decreases from 289 to 288 with no exemption or rebaseline.
- [x] **QR-AA.** Complete the `cli/src/chat/use-chat-keyboard.ts` decomposition
      manually: extract the stable assembly argument contract while preserving its
      type re-export, memo dependency arrays, keyboard dispatcher mount, and disabled
      state behavior. The source decreases from 319 to 240 lines; the replacement is
      81 lines; the full package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 288 to 287 with
      no exemption or rebaseline.
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
      279 lines; the replacement modules are 48 and 70 lines; the full package-scoped
      CLI suite passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass,
      and the inventory decreases from 285 to 284 with no exemption or rebaseline.
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
      and the inventory decreases from 265 to 263 with no exemption or rebaseline.
- [x] **QR-AR.** Complete the agent-runtime shared-test-fixture deduplication
      manually: reuse the canonical `testLogger` in `run-programmatic-step-part-e`
      and `n-parameter-part-a`, and extract the `respondWith` fetch-mock helper from
      `byok-search.test.ts`. The suites decrease from 305 to 299, 307 to 299, and
      305 to 294 lines; the new module is 15 lines; agent-runtime typecheck and the
      full suite (1112/0) pass, ESLint/Prettier pass, and the inventory decreases
      from 263 to 260 with no exemption or rebaseline.
- [x] **QR-AS.** Complete the `packages/code-map/src/parse.ts` decomposition
      manually: extract the generic bounded-concurrency `mapWithConcurrency`
      utility while preserving the scoring pipeline. The source decreases from 311
      to 287 lines; the new module is 23 lines; code-map typecheck and the full
      suite (51/0) pass, ESLint/Prettier pass, and the inventory decreases from 260
      to 259 with no exemption or rebaseline.
- [x] **QR-AT.** Complete the `common/src/testing/mocks/stream.ts` decomposition
      manually: extract the `createMockPromptAiSdkStream` factory and its
      `MockPromptOptions`/`MockPromptFn` contracts while preserving the public
      re-exports. The source decreases from 315 to 242 lines; the new module is 79
      lines; common typecheck and the full suite (620/0) pass, ESLint/Prettier
      pass, and the inventory decreases from 259 to 258 with no exemption or
      rebaseline.
- [x] **QR-AU.** Complete the `cli/src/utils/message-block-helpers/agent-blocks.ts`
      decomposition manually: extract the self-contained `appendInterruptionNotice`
      helper while preserving the original export, package barrel, and production
      consumers. The source decreases from 314 to 291 report lines; the new module
      is 25 lines; CLI typecheck and targeted production/test ESLint/Prettier pass,
      the focused suites pass 195/0, and the inventory decreases from 258 to 257
      with no exemption or rebaseline.
- [x] **QR-AV.** Complete the `cli/src/utils/markdown-renderers.tsx` decomposition
      manually: extract the recursive blockquote, list, and heading renderers behind
      an injected child-render callback while preserving the original wrappers,
      exports, and `markdown-renderer.tsx` entrypoint. The source decreases from 310
      to 222 lines; the new module is 118 lines; CLI typecheck, targeted
      ESLint/Prettier, and the focused markdown suites (29/0) pass, and the inventory
      decreases from 257 to 256 with no exemption or rebaseline.
- [x] **QR-AW.** Complete the `cli/src/utils/__tests__/analytics-client.test.ts`
      decomposition manually: extract the mock PostHog client, dependency factory,
      mutable mock contracts, and anonymous-ID fixture while preserving dependency
      injection and all assertions. The source decreases from 312 to 283 report
      lines; the new module is 50 lines; CLI typecheck, targeted ESLint/Prettier,
      and the focused suite (15/0) pass, and the inventory decreases from 256 to 255
      with no exemption or rebaseline.
- [x] **QR-AX.** Complete the `cli/src/commands/defs/modes.ts` decomposition
      manually: extract the cohesive model/provider/research-key command cluster
      into `model-provider-commands.ts` while preserving the `MODE_COMMANDS` export,
      original command order, SavantFree gating, aliases, handlers, picker state,
      credential setup, and input-mode side effects. The source decreases from 314
      to 126 lines; the new module is 187 lines; CLI typecheck, targeted
      ESLint/Prettier, focused router/provider suites (61/0), and the full CLI suite
      (3242/18/0) pass, and the inventory decreases from 255 to 254 with no exemption
      or rebaseline.
- [x] **QR-AY.** Complete the `cli/src/commands/release/release-runner.ts`
      decomposition manually: extract receipt parsing, evidence discovery, git-state
      lookup, and status assembly into `release-status.ts` while preserving the
      runner’s public status/evidence exports, release command routing, and process
      spawning behavior. The source decreases from 315 to 170 lines; the new module
      is 156 lines; CLI typecheck, targeted ESLint/Prettier, the focused release core
      suite (7/0), and the full CLI suite (3242/18/0) pass, and the inventory
      decreases from 254 to 253 with no exemption or rebaseline.
- [x] **QR-AZ.** Complete the `packages/agent-runtime/src/__tests__/run-programmatic-step-part-c.test.ts`
      decomposition manually: extract the shared runtime implementation, template,
      agent-state, params, and no-op logger fixture while preserving analytics/tool
      spies and all generator-control, state-management, and error-handling assertions.
      The source decreases from 317 to 233 lines; the new fixture module is 101 lines;
      agent-runtime typecheck, targeted ESLint/Prettier, the focused suite (8/0), and
      the full agent-runtime suite (1112/0) pass, and the inventory decreases from 253
      to 252 with no exemption or rebaseline.
- [x] **QR-BA.** Complete the `packages/agent-runtime/src/main-prompt.ts`
      decomposition manually: extract the `mainPrompt` orchestration while preserving
      the original facade exports, transport wrapper, prompt assembly, session hooks,
      agent selection, goal/drive behavior, logging, and output assembly. The source
      decreases from 317 to 109 lines; the new module is 210 lines; agent-runtime
      typecheck, targeted ESLint/Prettier, the focused main-prompt suite (6/0), and
      the full agent-runtime suite (1112/0) pass, and the inventory decreases from
      252 to 251 with no exemption or rebaseline.
- [x] **QR-BB.** Complete the `packages/agent-runtime/src/__tests__/run-programmatic-step-part-d.test.ts`
      decomposition manually: reuse the shared Loop 47 runtime/template/state/params/logger
      fixture while preserving output-schema validation, real-executor restoration,
      logging/context coverage, spies, and assertions. The source decreases from
      353 to 267 lines; agent-runtime typecheck, targeted ESLint/Prettier, the focused
      suite (6/0), and the full agent-runtime suite (1112/0) pass, and the inventory
      decreases from 251 to 250 with no exemption or rebaseline.
- [x] **QR-BC.** Complete the `packages/agent-runtime/src/__tests__/n-parameter-part-b.test.ts`
      decomposition manually: extract the repeated runtime/template/state/logger and
      overridable params setup while preserving all GENERATE_N sequences, tool spies,
      and assertions. The source decreases from 402 to 258 lines; the new fixture is
      98 lines; agent-runtime typecheck, targeted ESLint/Prettier, the focused suite
      (3/0), and the full agent-runtime suite (1112/0) pass, and the inventory
      decreases from 250 to 249 with no exemption or rebaseline.
- [x] **QR-BD.** Complete the `packages/agent-runtime/src/__tests__/n-parameter-part-c.test.ts`
      decomposition manually: reuse the shared n-parameter runtime/template/state/
      params fixture while preserving n=1, empty/undefined response, error, STEP,
      and end-turn edge-case behavior. The source decreases from 408 to 199 lines;
      agent-runtime typecheck, targeted ESLint/Prettier, the focused suite (6/0), and
      the full agent-runtime suite (1112/0) pass, and the inventory decreases from
      249 to 248 with no exemption or rebaseline.
- [x] **QR-BE.** Complete the `packages/agent-runtime/src/__tests__/run-programmatic-step-part-b.test.ts`
      decomposition manually: separate the comprehensive STEP_ALL integration case
      into a focused companion suite while reusing the shared fixture and preserving
      the tool-result forwarding test, all 32 assertions, and STEP_ALL state checks.
      The resulting sources are 98 and 270 lines; agent-runtime typecheck, targeted
      ESLint/Prettier, the focused suites (2/0), and the full agent-runtime suite
      (1112/0) pass, and the inventory decreases from 248 to 247 with no exemption
      or rebaseline.
- [x] **QR-BF.** Complete the generated `cli/src/constants/sigma.ts` decomposition
      manually at its generator boundary: update `cli/scripts/generate-sigma.ts` to
      emit a 13-line facade plus eight deterministic 33–41-line chunks, preserve the
      exported `SIGMA_JS` payload byte-for-byte, and avoid hand-editing generated
      runtime text. CLI typecheck, targeted ESLint/Prettier, payload comparison, and
      `git diff --check` pass; the inventory decreases from 247 to 246 with no
      exemption or rebaseline.
- [x] **QR-BG.** Complete the `cli/src/utils/logger/sink.ts` decomposition manually:
      move file-path initialization, synchronous pino destination ownership, and
      log-file clearing into `cli/src/utils/logger/file-sink.ts`, preserving the
      `CHAT_LOG_FILENAME` and `clearLogFile` compatibility exports plus analytics,
      redaction, serialization, and shipping behavior. The parent decreases from 321
      to 269 lines; the new module is 69 lines; focused integrations pass 10/45,
      the full CLI suite passes 3242/18/0 with 9001 assertions, and the inventory
      decreases from 246 to 245 with no exemption or rebaseline.
- [x] **QR-BH.** Complete the `common/src/constants/analytics-events.ts`
      decomposition manually: move the cohesive SavantFree referral event values into
      `savant-free-referral-events.ts` and preserve the original public enum members as
      aliases, runtime values, and lookup behavior. The parent decreases from 319 to
      298 lines; the new module is 14 lines; focused analytics suites pass 19/41, the
      full common suite passes 620/4 skipped/0 with 1722 assertions, and the inventory
      decreases from 245 to 244 with no exemption or rebaseline.
- [x] **QR-BI.** Complete the `packages/agent-runtime/src/echo/pre-write-gates.ts`
      decomposition manually: move the private P5b YAGNI payload parser, assessment
      recorder, and speculative-write verdict into `yagni-pre-write-gate.ts`, passing
      the resolved target path while preserving all other gate ordering and behavior.
      The parent decreases from 319 to 229 lines; the new module is 104 lines; focused
      suites pass 21/36, the full agent-runtime suite passes 1112/0 with 2936
      assertions, and the inventory decreases from 244 to 243 with no exemption or
      rebaseline.
- [x] **QR-BJ.** Complete the `cli/src/components/publish-container.tsx`
      decomposition manually: move store selection, agent loading/filtering, keyboard
      navigation, publish-ID calculation, focus/effect lifecycle, and action callbacks
      into `use-publish-container-controller.ts`, preserving the public render facade
      and child-step boundaries. The facade decreases from 320 to 144 lines; the new
      controller is 239 lines; focused publish-confirmation tests pass 4/4, the full
      CLI suite passes 3242/18/0 with 9001 assertions, and the inventory decreases
      from 243 to 242 with no exemption or rebaseline.
- [x] **QR-BK.** Complete the `cli/src/utils/theme-system/ide-detect.ts`
      decomposition manually: move Zed terminal detection, settings parsing, theme
      candidate inference, system-mode fallback, and path traversal into `zed-detect.ts`,
      preserving the public `isZedTerminal` export and IDE orchestration. The parent
      decreases from 320 to 204 lines; the new module is 124 lines; focused theme tests
      pass 6/33, the full CLI suite passes 3242/18/0 with 9001 assertions, and the
      inventory decreases from 242 to 241 with no exemption or rebaseline.
- [x] **QR-BL.** Complete the `packages/agent-runtime/src/tools/handlers/tool/
      spawn-agent-utils.ts` decomposition manually: move the spawn resolution cluster
      (`getMatchingSpawn`, `resolveSpawnableAgent`, `validateAndGetAgentTemplate`,
      `validateAgentInput`) to `spawn-agent-resolution.ts` and the execution cluster
      (`SubagentPropagationSnapshot` + `executeSubagent`) to `execute-subagent.ts`,
      keeping the original path as a re-export facade so the namespace `spyOn` surface
      in `cost-aggregation.test.ts` survives. The parent decreases from 603 to 250
      lines; the new modules are 187 and 183 lines; agent-runtime typecheck passes,
      the full agent-runtime suite passes 1112/0 with 2936 assertions, and the
      inventory decreases from 241 to 240 with no exemption or rebaseline.
- [x] **QR-BM.** Complete the `cli/src/components/tools/render-ui.tsx`
      decomposition manually: extract the widget data interfaces + type guards to
      `render-ui-widget-types.ts`, the interactive button widget to
      `render-ui-button.tsx`, and the five display widgets to
      `render-ui-display-widgets.tsx`, keeping the original path as an 84-line
      factory facade with the `RenderUIComponent` export intact. The new modules are
      96, 98, and 227 lines; CLI typecheck passes, the full CLI suite passes
      3242/18/0 with 9001 assertions, and the inventory decreases from 240 to 239
      with no exemption or rebaseline.
- [x] **QR-BN.** Complete the `cli/src/components/ask-user/use-form-state.ts`
      decomposition manually: move the `MultipleChoiceFormState` interface to
      `multiple-choice-form-state-types.ts` and the pure `formatAnswer`/
      `formatFormAnswers` helpers to `format-answers.ts`, re-exporting the interface
      from the original path and simplifying `handleSubmit`. The parent decreases
      from 380 to 298 lines; the new modules are 49 and 47 lines; CLI typecheck
      passes, the full CLI suite passes 3242/18/0 with 9001 assertions, and the
      inventory decreases from 239 to 238 with no exemption or rebaseline.
- [x] **QR-BO.** Complete the `cli/src/utils/pending-attachments.ts` decomposition
      manually: move the file/folder attachment reader (`addPendingFileFromPath`,
      `formatFileSize`, `isBinaryBuffer`, and size constants) to
      `file-attachment-reader.ts`, re-exporting `addPendingFileFromPath` from the
      original path so `chat.tsx` and the store consumers are unchanged. The parent
      decreases from 363 to 248 lines; the new module is 122 lines; CLI typecheck
      passes, the focused pending-attachments suite passes 16/0 with 44 assertions,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 238 to 237 with no exemption or rebaseline.
- [x] **QR-BP.** Complete the `cli/src/utils/chatgpt-oauth.ts` decomposition
      manually: move the seven pure helpers (`parseOAuthTokenResponse`, PKCE
      generators, `escapeHtml`/`callbackPageHtml`, `parseAuthCodeInput`) to
      `chatgpt-oauth-helpers.ts`, importing them from the original path so the
      OAuth flow state machine and all public exports stay put. The parent
      decreases from 350 to 258 lines; the new module is 106 lines; CLI typecheck
      passes, the focused chatgpt-oauth suite passes 2/0 with 8 assertions, the
      full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 237 to 236 with no exemption or rebaseline.
- [x] **QR-BQ.** Complete the `cli/src/state/chat-store/types.ts` decomposition
      manually: move `ChatStoreActions` and the derived action types to
      `chat-store-actions.ts` and the shared small types to
      `chat-store-common-types.ts`, re-exporting all moved types from the
      original types path. The parent decreases from 375 to 189 lines; the new
      modules are 201 and 31 lines; the shared-types module breaks the circular
      type dependency that the first audit exposed (131 errors); CLI typecheck
      passes with 0 errors, the focused state suite passes 73/0 with 200
      assertions, the full CLI suite passes 3260/18/0 with 9001 assertions, and
      the inventory decreases from 236 to 235 with no exemption or rebaseline.
- [x] **QR-BR.** Complete the `cli/src/utils/image-handler.ts` decomposition
      manually: move the Jimp compression cluster (`CompressionResult`, quality/
      dimension settings, `compressImageToFitSize`) to `image-compressor.ts`,
      importing it from the original path so all public path/format/process/
      extract exports stay put. The parent decreases from 336 to 249 lines; the
      new module is 93 lines; CLI typecheck passes with 0 errors, the focused
      image-dimensions + pending-attachments suites pass 29/0 with 85 assertions,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 235 to 234 with no exemption or rebaseline.
- [x] **QR-BS.** Complete the `cli/src/components/blocks/markdown-renderables.tsx`
      decomposition manually: move the image renderable cluster
      (`MarkdownImage` + data-image parsing, local-file loading, inline-image
      helpers) to `markdown-image.tsx`, re-exporting `MarkdownImage` from the
      original path so markdown-renderers and the test are unchanged. The parent
      decreases from 347 to 181 lines; the new module is 175 lines; CLI typecheck
      passes with 0 errors, the focused markdown-renderer suite passes 22/0 with
      228 assertions, the full CLI suite passes 3260/18/0 with 9001 assertions,
      and the inventory decreases from 234 to 233 with no exemption or rebaseline.
- [x] **QR-BT.** Complete the `cli/src/components/feedback-input-mode.tsx`
      decomposition manually: move the category catalog + row-width math to
      `feedback-category-options.ts` and the `FeedbackTextSection` component to
      `feedback-text-section.tsx`, keeping the `FeedbackInputMode` shell and its
      export intact. The parent decreases from 353 to 211 lines; the new modules
      are 75 and 78 lines; CLI typecheck passes with 0 errors, the focused
      feedback-helpers suite passes 32/0 with 62 assertions, the full CLI suite
      passes 3260/18/0 with 9001 assertions, and the inventory decreases from 233
      to 232 with no exemption or rebaseline.
- [x] **QR-BU.** Complete the `common/src/providers/audit.ts` decomposition
      manually: move the pure exception manifest data
      (`PROVIDER_EXCEPTION_MANIFEST` + its two types) to
      `provider-exception-manifest.ts`, re-exporting it from the original audit
      path so validate-repository and the provider-audit test are unchanged. The
      parent decreases from 325 to 257 lines; the new module is 84 lines; common
      typecheck      passes with 0 errors, the focused provider-audit suite passes 6/0
      with 15 assertions, the full common suite passes 624/4/0 with 1722
      assertions, `validate-repository.ts` runs clean, and the inventory
      decreases from 232 to 231 with no exemption or rebaseline.
- [x] **QR-BV.** Complete the `common/src/project-file-tree.ts` decomposition
      manually: move the gitignore parsing cluster (`logFileTreeError`,
      `hasErrnoCode`, `rebaseGitignorePattern`, `parseGitignore`) to
      `project-gitignore.ts`, importing `logFileTreeError` and `parseGitignore`
      back into the tree module. The parent decreases from 362 to 235 lines;
      the new module is 134 lines; common typecheck passes with 0 errors, the
      focused project-file-tree suite passes 2/0 with 7 assertions, the full
      common suite passes 624/0 with 1722 assertions, sdk typecheck passes with
      0 errors and its suite passes 477/1/0 with 1127 assertions, and the
      inventory decreases from 231 to 230 with no exemption or rebaseline.
- [x] **QR-BW.** Complete the `common/src/util/file.ts` decomposition manually:
      move the ProjectFileContext Zod contract cluster (`FileTreeNodeSchema`,
      `FileVersionSchema`, `customToolDefinitionsSchema`,
      `ProjectFileContextSchema`, `ProjectFileContext`, `getStubProjectFileContext`)
      to `file-context.ts`, re-exporting it from the original util/file path so
      project-file-tree, sdk change-file, agent-runtime prompts, and the eight
      stub-context test consumers are unchanged. The parent decreases from 378
      to 218 lines; the new module is 175 lines; common typecheck passes with 0
      errors, the full common suite passes 624/0 with 1722 assertions,
      agent-runtime typecheck passes, and the inventory decreases from 230 to
      229 with no exemption or rebaseline.
- [x] **QR-BX.** Complete the `common/src/tools/safety-registry.ts` decomposition
      manually: split the `toolSafetyRegistry` data catalog into
      `safety-registry-core.ts` (168 lines) and
      `safety-registry-orchestration.ts` (172 lines) as partial records, merging
      them in the 40-line parent with the load-time completeness check intact.
      Common typecheck passes with 0 errors, a runtime probe confirms 54
      entries and identical `getToolSafety` fallback, the full common suite
      passes 624/0 with 1722 assertions, agent-runtime typecheck passes and its
      sandbox engine suite passes 33/0 with 44 assertions, and the inventory
      decreases from 229 to 228 with no exemption or rebaseline.
- [x] **QR-BY.** Complete the `cli/src/utils/auto-drive-headless.ts`
      decomposition manually: move the FID completion-certificate cluster
      (`scanActiveFids`, `openFidIds`, `completionExitCode`,
      `writeCompletionReport` + patterns/type) to
      `auto-drive-fid-certificate.ts`, importing and re-exporting it from the
      original path so index.tsx and the focused test are unchanged. The parent
      decreases from 335 to 270 lines; the new module is 74 lines; CLI typecheck
      passes with 0 errors, the focused auto-drive-headless suite passes 10/0
      with 18 assertions, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 228 to 227 with no exemption
      or rebaseline.
- [x] **QR-BZ.** Complete the `cli/src/utils/savant-code-api/client.ts`
      decomposition manually: move the authenticated `request` core (URL/header
      building, timeout + cancellation, retry policy) to `request-core.ts` as a
      `createApiRequestCore(config)` factory, wiring it into the endpoint
      factory so `savant-code-api.ts` is unchanged. The parent decreases from
      347 to 176 lines; the new module is 208 lines; CLI typecheck passes with 0
      errors, the focused savant-code-api suite passes 29/0 with 55 assertions,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the
      inventory decreases from 227 to 226 with no exemption or rebaseline.
- [x] **QR-CA.** Complete the `cli/src/components/agent-mode-toggle.tsx`
      decomposition manually: move `useHoverToggle` + its delay constants to
      `use-hover-toggle.ts` and `resolveAgentModeClick`/`AgentModeClickAction`
      to `agent-mode-click.ts`, importing and re-exporting them from the
      original path so feedback-icon-button and the focused test are unchanged.
      The parent decreases from 349 to 259 lines; the new modules are 85 and 23
      lines; CLI typecheck passes with 0 errors, the focused agent-mode-toggle
      suite passes 11/0 with 40 assertions,      the full CLI suite passes 3260/18/0 with 9001 assertions, and the
      inventory decreases from 226 to 225 with no exemption or rebaseline.
- [x] **QR-CB.** Complete the `cli/src/components/ad-banner.tsx` decomposition
      manually: move the pure layout/display helpers (`truncateToLines`,
      `truncateToWidth`, `extractDomain`, `getAdDisplayLabel`,
      `getInlineAdLayout`, `columnWidths` + inline constants) to
      `ad-banner-layout.ts`, importing them and re-exporting the public helpers
      from the original path so the ad-banner test is unchanged. The parent
      decreases from 352 to 284 lines; the new module is 84 lines; CLI typecheck
      passes with 0 errors, the focused ad-banner suite passes 6/0 with 16
      assertions, the full CLI suite passes 3260/18/0 with 9001 assertions, and
      the inventory decreases from 225 to 224 with no exemption or rebaseline.
- [x] **QR-CC.** Complete the
      `packages/agent-runtime/src/tools/handlers/tool/deep-research.ts`
      decomposition manually: move the pure research mechanics (`domainScore`,
      `extractOrganicHits`, `deriveQueries`, `runDeepResearch`, and the
      constants) to `deep-research-core.ts`, importing them and re-exporting
      the test-consumed surface from the original path so the deep-research
      test is unchanged. The parent decreases from 347 to 69 lines; the new
      module is 295 lines (condensed from 302 to stay under the 300-line
      absolute ceiling); agent-runtime typecheck passes with 0 errors, the
      focused deep-research suite passes 13/0 with 32 assertions, the full
      agent-runtime suite passes 1112/0, and the inventory decreases from 224
      to 223 with no exemption or rebaseline.
- [x] **QR-CD.** Complete the `cli/src/components/tools/suggest-followups.tsx`
      decomposition manually: move the past-followups cluster
      (`PastFollowupItem` + `PastFollowupsToggle`) and the shared
      `EMPTY_CLICKED_SET` to `past-followups.tsx`, importing them from the
      original path so `registry.ts` is unchanged. The parent decreases from
      373 to 294 lines; the new module is 89 lines; CLI typecheck passes with
      0 errors, the full CLI suite passes 3260/18/0 with 9001 assertions, and
      the inventory decreases from 223 to 222 with no exemption or rebaseline.
- [x] **QR-CE.** Complete the `common/src/constants/free-agents.ts`
      decomposition manually: move the data catalog (`FREE_COST_MODE`,
      `SAVANT_FREE_ROOT_AGENT_IDS`/`_SET`,
      `SAVANT_FREE_ROOT_AGENT_ID_BY_MODEL`, `FREE_MODE_AGENT_MODELS`,
      `FREE_TIER_AGENTS`, and the subagent-model set) to
      `free-agent-catalog.ts`, importing the needed entries and re-exporting
      the full catalog from the original path so
      savant-free-agent-selection, context-tokens, and the focused test are
      unchanged. The parent decreases from 353 to 177 lines; the new module is
      199 lines; common typecheck passes with 0 errors (agent-runtime and cli
      also pass), the focused free-agents suite passes 8/0 with 151 assertions,
      the full common suite passes 624/4/0 with 1722 assertions, and the
      inventory decreases from 222 to 221 with no exemption or rebaseline.
- [x] **QR-CF.** Complete the `cli/src/data/slash-commands.ts` decomposition
      manually: move the 287-line `ALL_SLASH_COMMANDS` menu array to
      `slash-command-core.ts` (help→release) and `slash-command-feature.ts`
      (theme:toggle→rewind), splicing them back in the parent around the
      `...MODE_COMMANDS` spread at their original position. The parent
      decreases from 402 to 123 lines; the new modules are 200 and 107 lines;
      CLI typecheck passes with 0 errors, the focused gating-parity +
      router-input + slash-command-filter suites pass 66/0 with 447
      assertions, the full CLI suite passes 3260/18/0 with 9001 assertions,
      and the inventory decreases from 221 to 220 with no exemption or
      rebaseline.
- [x] **QR-CG.** Complete the `common/src/util/protocol-config.ts`
      decomposition manually: move the config contract types + defaults to
      `protocol-config-types.ts` and the YAML parsing utilities to
      `protocol-config-parser.ts`, importing both and re-exporting the types
      from the original path so boot-contract, hooks/engine, transition-phase,
      caveman-rules, send-message-run-config, savant, and the focused test are
      unchanged. The parent decreases from 536 to 298 lines; the new modules
      are 138 and 163 lines; common typecheck passes with 0 errors
      (agent-runtime, cli, and sdk also pass), the focused protocol-config
      suite passes 9/0 with 19 assertions, the full common suite passes
      624/4/0 with 1722 assertions, and the inventory decreases from 220 to
      219 with no exemption or rebaseline. The serialization-sensitive
      `tools.ts` template was passed over deliberately (it is copied verbatim
      into generated `.agents/` dirs).
- [x] **QR-CH.** Complete the `cli/src/utils/provider-setup.ts` decomposition
      manually: move the shared credentials readers to
      `provider-credentials.ts`, the research-key cluster to
      `research-key-store.ts`, and the provider config + key persistence
      cluster to `provider-key-store.ts`, importing all three and
      re-exporting the full public surface from the original path so
      bootstrap, pickers, commands, router, index, and the focused tests are
      unchanged. The parent decreases from 421 to 116 lines; the new modules
      are 37, 107, and 210 lines; CLI typecheck passes with 0 errors, the
      focused provider-setup suites pass 31/0 with 95 assertions, the full CLI
      suite passes 3260/18/0 with 9001 assertions, and the inventory decreases
      from 219 to 218 with no exemption or rebaseline.
- [x] **QR-CI.** Complete the `cli/src/components/model-picker.tsx`
      decomposition manually: move the provider-grouping helpers (`getProvider`,
      `getProviderOrder`, `buildGroupedItems` + list-item types) to
      `model-picker-grouping.ts` and the header/model row renderers to
      `model-picker-rows.tsx`, importing both from the original path so
      `panels.tsx` is unchanged. The parent decreases from 372 to 266 lines;
      the new modules are 60 and 94 lines; CLI typecheck passes with 0 errors,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the
      inventory decreases from 218 to 217 with no exemption or rebaseline.
- [x] **QR-CJ.** Complete the `cli/src/components/agent-checklist.tsx`
      decomposition manually: move the dependency-tree cluster
      (`countDependencies`, `buildDepTree`, `DepTree`, `DepTreeNode`) to
      `agent-checklist-dep-tree.tsx`, importing it from the original path so
      `selection-step.tsx` is unchanged. The parent decreases from 385 to 281
      lines; the new module is 114 lines; CLI typecheck passes with 0 errors,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the
      inventory decreases from 217 to 216 with no exemption or rebaseline.
- [x] **QR-CK.** Complete the `cli/src/components/blocks/implementor-row.tsx`
      decomposition manually: move the compact file-stats cluster
      (`CompactFileStats` + `CompactFileRow` + `STATS_BAR_WIDTH`) to
      `implementor-file-stats.tsx`, importing it from the original path so
      agent-branch-wrapper and blocks-renderer are unchanged. The parent
      decreases from 453 to 267 lines; the new module is 191 lines; CLI
      typecheck passes with 0 errors, the full CLI suite passes 3260/18/0
      with 9001 assertions, and the inventory decreases from 216 to 215 with
      no exemption or rebaseline.
- [x] **QR-CL.** Complete the `cli/src/components/blocks/agent-branch-wrapper.tsx`
      decomposition manually: move the recursive `AgentBody` block processor
      (incl. its props + ref types) to `agent-branch-body.tsx`, importing it
      from the original path. The parent decreases from 524 to 277 lines; the
      new module is 254 lines (re-importing `AgentBranchWrapper` for the
      recursive agent grid — the cycle resolves at call time); CLI typecheck
      passes with 0 errors, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 215 to 214 with no
      exemption or rebaseline.
- [x] **QR-CM.** Complete the `cli/src/components/project-picker-screen.tsx`
      decomposition manually: move the pure responsive layout computation to
      `project-picker-layout.ts`, the search keyboard intercept to
      `use-project-picker-keyboard.ts`, and the recents renderer to
      `project-picker-recents.tsx`, importing all three from the original
      path. The parent decreases from 469 to 299 lines; the new modules are
      139, 116, and 48 lines; CLI typecheck passes with 0 errors, the full
      CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 214 to 213 with no exemption or rebaseline.
- [x] **QR-CN.** Complete the `cli/src/components/terminal-command-display.tsx`
      decomposition manually: move the pure status helpers + glow constants to
      `terminal-status-utils.ts`, the traffic-light dots to `traffic-lights.tsx`,
      and the visual-line truncation math to a pure `computeTerminalDisplayOutput`
      in the utils module, keeping the focused-test re-exports on the original
      path. The parent decreases from 447 to 299 lines; the new modules are 169
      and 70 lines; CLI typecheck passes with 0 errors, the focused suite passes
      15/0 with 21 assertions, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 213 to 212 with no exemption
      or rebaseline.
- [x] **QR-CO.** Complete the `cli/src/hooks/use-chat-keyboard.ts` decomposition
      manually: move the pure `ChatKeyboardHandlers` contract + `dispatchAction`
      switch (incl. `assertNever` and the clipboard/file-paste branch) to
      `chat-keyboard-dispatcher.ts`, importing it from the original path and
      re-exporting `ChatKeyboardHandlers` so chat/keyboard and
      chat/use-chat-keyboard are unchanged. The parent decreases from 332 to 89
      lines; the new module is 253 lines; CLI typecheck passes with 0 errors,
      the full CLI suite passes 3260/18/0 with 9001 assertions, and the
      inventory decreases from 212 to 211 with no exemption or rebaseline.
- [x] **QR-CP.** Complete the `cli/src/components/chat-history-screen.tsx`
      decomposition manually: move the pure column-formatting cluster +
      `allChatsInterrupted` to `chat-history-format.ts`, the keyboard
      intercept to `use-chat-history-keyboard.ts`, and the title/bottom-bar
      chrome to `chat-history-chrome.tsx`, importing all three from the
      original path and re-exporting `allChatsInterrupted` so the focused test
      is unchanged. The parent decreases from 434 to 232 lines; the new modules
      are 86, 84, and 129 lines; CLI typecheck passes with 0 errors, the
      focused suite passes 5/0, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 211 to 210 with no exemption
      or rebaseline.
- [x] **QR-CQ.** Complete the `cli/src/components/message-block.tsx`
      decomposition manually: move the self-contained `MessageAttachments` memo
      (image/text/file attachment cards) to `message-attachments.tsx`, importing
      it from the original path. The parent decreases from 338 to 283 lines; the
      new module is 69 lines; CLI typecheck passes with 0 errors, the focused
      message-block suites pass 5/0, the full CLI suite passes 3260/18/0 with
      9001 assertions, and the inventory decreases from 210 to 209 with no
      exemption or rebaseline.
- [x] **QR-CR.** Complete the `common/src/constants/model-config/providers.ts`
      decomposition manually: move the protocol metadata maps
      (`COMMANDCODE_PROTOCOLS` + `OPENCODE_GO_PROTOCOLS`) to
      `provider-protocols.ts`, re-exporting them from the original path so the
      barrel, providers/validate, and the sdk model-factories consumer are
      unchanged. The parent decreases from 335 to 291 lines; the new module is
      54 lines; typecheck × 4 passes with 0 errors, the focused model-config
      suite passes 5/0 with 17 assertions, the full common suite passes
      624/4/0 with 1722 assertions, and the inventory decreases from 209 to 208
      with no exemption or rebaseline.
- [x] **QR-CS.** Complete the `cli/src/commands/contribute.ts` decomposition
      manually: move the pure helpers (`sanitizeUsername`,
      `checkContributorExists`, `formatContributorRow`, `buildContributorsContent`,
      `CONTRIBUTORS_HEADER`, `todayIsoDate`, `getGitConfigUsername`,
      `execErrorSummary`, `gitBranchExists`) + `runContributeGitFlow` and the
      `ExecFn`/`defaultExec` boundary to `contribute-core.ts`, importing it
      from the original path and re-exporting the test-consumed surface. The
      parent decreases from 328 to 166 lines; the new module is 189 lines; CLI
      typecheck passes with 0 errors, the focused contribute suite passes 20/0
      with 47 assertions, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 208 to 207 with no exemption
      or rebaseline.
- [x] **QR-CT.** Complete the `cli/src/commands/copy-conversation.ts`
      decomposition manually: move the pure Markdown rendering cluster
      (`toolDisplayName`, `formatBytes`, `keepTailBytes`, `fence`,
      `renderToolInput`, `renderToolOutput`, `roleHeading`, `renderBlock`,
      `renderMessage`, `Segment`/`Droppable`) to `copy-conversation-render.ts`,
      importing it from the original path. The parent keeps `serializeConversation`
      + `handleCopyConversationCommand` and decreases from 387 to 162 lines;
      the new module is 241 lines; CLI typecheck passes with 0 errors, the
      focused copy-conversation suite passes 12/0 with 38 assertions, the full
      CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 207 to 206 with no exemption or rebaseline.
- [x] **QR-CU.** Complete the `cli/src/components/publish-confirmation.tsx`
      decomposition manually: move the pure dependency-graph logic
      (`computeDependencies`, `computeDependents`, `getAllPublishAgentIds` +
      the shared `PublishAgentDefinitions` type) to `publish-graph.ts` and the
      section chrome (`AgentSection`, `DirectionLabel`) to `publish-sections.tsx`,
      importing both from the original path and re-exporting `getAllPublishAgentIds`
      so use-publish-container-controller, confirmation-step, and the focused
      test are unchanged. The parent decreases from 515 to 222 lines; the new
      modules are 167 and 146 lines; CLI typecheck passes with 0 errors, the
      focused unit suite passes 4/0, the full CLI suite passes 3260/18/0 with
      9001 assertions, and the inventory decreases from 206 to 205 with no
      exemption or rebaseline.
- [x] **QR-CV.** Complete the `cli/src/components/savant-free-referral-banner.tsx`
      decomposition manually: move the `CopyInviteLinkButton` + pure
      link/label helpers + focus ids + `SavantFreeReferralFocusTarget` to
      `referral-copy-button.tsx` and the shared quiet-line render to
      `referral-quiet-line.tsx`, importing both from the original path and
      re-exporting `SavantFreeReferralFocusTarget` so use-model-selector-state,
      use-keyboard-nav, and savant-free-model-selector are unchanged. The
      parent decreases from 424 to 296 lines; the new modules are 108 and 51
      lines; CLI typecheck passes with 0 errors, the full CLI suite passes
      3260/18/0 with 9001 assertions, and the inventory decreases from 205 to
      204 with no exemption or rebaseline.
- [x] **QR-CW.** Complete the `cli/src/components/right-sidebar.tsx`
      decomposition manually: move the pure formatting helpers + shared
      `ToolCall`/`AgentInfo`/`FilesChanged` types to `right-sidebar-format.ts`
      and the six presentational sections (Active Agents, Tools, Files, Active
      FIDs, History, Session) to `right-sidebar-sections.tsx`, importing both
      from the original path. The parent keeps `RightSidebarProps` + the memo
      and decreases from 508 to 299 lines; the new modules are 118 and 237
      lines; CLI typecheck passes with 0 errors, the full CLI suite passes
      3260/18/0 with 9001 assertions, and the inventory decreases from 204 to
      203 with no exemption or rebaseline.
- [x] **QR-CX.** Complete the `cli/src/commands/graph-export/layout.ts`
      decomposition manually: move the elkjs GWT worker bootstrap to
      `elk-worker.ts`, the ELK invocation cluster (constants, `runElk`,
      `createElk`, `measureBbox`, `roundCoord`) to `elk-runner.ts`, and the
      Stage-1 pass to `layout-stage1.ts`, importing all three from the
      original path and re-exporting `getElkWorkerClass`. The parent keeps
      `computeGraphLayout` + `GraphLayoutResult` and decreases from 484 to 184
      lines; the new modules are 80, 94, and 150 lines; CLI typecheck passes
      with 0 errors, the focused graph-export suite passes 41/0 with 428
      assertions, the full CLI suite passes 3260/18/0 with 9001 assertions,
      and the inventory decreases from 203 to 202 with no exemption or
      rebaseline.
- [x] **QR-CY.** Complete the `cli/src/components/savant-free-model-selector/use-model-selector-state.ts`
      decomposition manually: move the `ModelSelectorState` contract + pure
      section/nav derivations to `model-selector-core.ts`, the scroll-sync +
      focus-validity effects to `use-selector-effects.ts`, and the
      join/pick/toggle actions to `use-selector-actions.ts`, importing all
      three from the original path and re-exporting `ModelSelectorState`. The
      parent decreases from 398 to 299 lines; the new modules are 114, 39, and
      71 lines; CLI typecheck passes with 0 errors, the full CLI suite passes
      3260/18/0 with 9001 assertions, and the inventory decreases from 202 to
      201 with no exemption or rebaseline.
- [x] **QR-CZ.** Complete the `cli/src/utils/design-system-service.ts`
      decomposition manually: move the custom-design-system resolution +
      manifest-store cluster to `design-system-custom.ts` and
      `design-system-manifest.ts` (with the cycle broken via
      `design-system-roots.ts`), the built-in/selection resolvers + selection
      helpers to `design-system-selection.ts`, and the write/commit helpers to
      `design-system-write.ts`, importing all four from the original path and
      re-exporting `DesignSystemMetadata`/`ManifestRecord`/`listDesignSystems`
      so consumers are unchanged. The parent decreases from 812 to 118 lines;
      the new modules are 146, 260, 51, 194, and 139 lines; CLI typecheck
      passes with 0 errors, the full CLI suite passes 3260/18/0 with 9001
      assertions, and the inventory decreases from 201 to 200 with no
      exemption or rebaseline.
- [x] **QR-DA.** Complete the `cli/src/utils/keyboard-actions.ts` decomposition
      manually: move the `ChatKeyboardState` + `ChatKeyboardAction` contract
      (117 lines) to `keyboard-action-types.ts`, importing it from the original
      path and re-exporting the types so chat/keyboard-state, use-chat-keyboard,
      chat-keyboard-dispatcher, and the focused test are unchanged. The parent
      keeps the priority resolver + default-state factory and decreases from
      413 to 299 lines; CLI typecheck passes with 0 errors, the focused
      keyboard-actions suite passes 68/0 with 72 assertions, the full CLI
      suite passes 3260/18/0 with 9001 assertions, and the inventory decreases
      from 200 to 199 with no exemption or rebaseline.
- [x] **QR-DB.** Complete the `cli/src/components/blocks/markdown-content.tsx`
      decomposition manually: move the semantic-block collector cluster
      (`MarkdownPart`, `collectSemanticBlocks`, `getSemanticKey`,
      `renderSemanticBlock`, `renderInlineTextHost`) to
      `markdown-content-core.tsx` (278 lines), importing it from the original
      path. The parent keeps `MarkdownContentProps` + `renderMarkdownContent`
      and decreases from 361 to 96 lines; CLI typecheck passes with 0 errors,
      the focused markdown-content suite passes 4/0 with 16 assertions, the
      full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 199 to 198 with no exemption or rebaseline.
- [x] **QR-DC.** Complete the `cli/src/commands/router/route-user-prompt.ts`
      decomposition manually: move the user-input analytics tracking to
      `route-analytics.ts` (72 lines), the shared provider/research key-setup
      handler to `route-key-setup.ts` (67 lines), and the plan/interview/
      review + image + connect:chatgpt mode handlers to `route-input-modes.ts`
      (115 lines), importing all three from the original path. The parent
      keeps the dispatch flow and decreases from 426 to 280 lines; CLI
      typecheck passes with 0 errors, the focused router suites pass 5/0, the
      full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 198 to 197 with no exemption or rebaseline.
- [x] **QR-DD.** Complete the `cli/src/state/chat-store/sidebar-actions.ts`
      decomposition manually: move the pure compaction helpers (`recordRun`,
      `sameCompactionStatus`, 39 lines) to `compaction-helpers.ts`, importing
      it from the original path. The parent keeps the `createSidebarActions`
      factory and decreases from 338 to 296 lines; CLI typecheck passes with 0
      errors, the focused state suite passes 73/0 with 200 assertions, the
      full CLI suite passes 3260/18/0 with 9001 assertions, and the inventory
      decreases from 197 to 196 with no exemption or rebaseline.
- [x] **QR-DE.** Complete the `sdk/src/tools/run-terminal-command.ts`
      decomposition manually: move the `BoundedOutputBuffer` class + color-
      truncation constants to `bounded-output-buffer.ts` (76 lines), the
      process-group lifecycle (`killProcessGroup`, `isProcessGroupAlive`,
      `liveChildren` registry, `getActiveTerminalCommandProcesses`) to
      `child-process-registry.ts` (101 lines), and the Windows bash discovery
      to `windows-bash.ts` (104 lines), importing all three from the original
      path and re-exporting `BoundedOutputBuffer`,
      `getActiveTerminalCommandProcesses`, and `ActiveTerminalCommandProcess`
      so the SDK barrel, process-diagnostics, and the focused test are
      unchanged. The parent keeps `runTerminalCommand` and decreases from 485
      to 231 lines; SDK typecheck passes with 0 errors, the focused suite
      passes 7/0 with 25 assertions, the full SDK suite passes 477/1/0 with
      1127 assertions, all four workspace typechecks pass, and the inventory
      decreases from 196 to 195 with no exemption or rebaseline.
- [x] **QR-DF.** Complete the `sdk/src/tools/code-search/executor.ts`
      decomposition manually: move the ripgrep match-processing logic
      (duplicated across the streaming parser and the close-flush) to
      `match-collector.ts` (115 lines: `RipgrepMatchCollector` with the
      per-file/global/estimated-output limits and the stream vs flush
      inclusion rules), importing it from the original path. The parent keeps
      the process wiring and decreases from 367 to 274 lines; SDK typecheck
      passes with 0 errors, the focused code-search suites pass 31/0 with 95
      assertions, the full SDK suite passes 477/1/0 with 1127 assertions, all
      four workspace typechecks pass, and the inventory decreases from 195 to
      194 with no exemption or rebaseline.
- [x] **QR-DG.** Complete the `sdk/src/tools/apply-patch/parser.ts`
      decomposition manually: move the fuzz context-matching cluster
      (`equalsSlice`, `findContextCore`, `findContext`, 73 lines) to
      `context-matcher.ts` and the diff string helpers
      (`normalizeLineEndings`, `ensureTrailingNewline`, `stripTrailingNewline`,
      `sanitizeUnifiedDiff`, `patchHasIntendedChanges`, 45 lines) to
      `diff-utils.ts`, importing them from the original path and re-exporting
      the consumed helpers (`sanitizeUnifiedDiff`, `normalizeLineEndings`,
      `patchHasIntendedChanges`) so apply-patch.ts and diff.ts are unchanged.
      The parent keeps the parser state machine and decreases from 378 to 278
      lines; SDK typecheck passes with 0 errors, the focused apply-patch
      suites pass 14/0 with 46 assertions, the full SDK suite passes
      477/1/0 with 1127 assertions, all four workspace typechecks pass, and
      the inventory decreases from 194 to 193 with no exemption or rebaseline.
- [x] **QR-DH.** Complete the `packages/code-map/src/languages.ts`
      decomposition manually: move the `LanguageConfig` contract + `WASM_FILES`
      manifest + `languageTable` config data (and the nine scm query imports
      they reference) to `language-table.ts` (105 lines), importing it from
      the original path and re-exporting `LanguageConfig`/`WASM_FILES`/
      `languageTable` so the barrel and the languages test are unchanged. The
      parent keeps the runtime loader machinery and decreases from 345 to 235
      lines; code-map typecheck passes with 0 errors, the code-map suite
      passes 51/0 with 264 assertions, all four workspace typechecks pass,
      and the inventory decreases from 193 to 192 with no exemption or
      rebaseline.
- [x] **QR-DI.** Complete the `sdk/src/agents/load-agents.ts` decomposition
      manually: move the MCP env resolution (`resolveMcpEnv`,
      `resolveAgentMcpEnv`, 61 lines) to `mcp-env.ts` and the async agent-file
      discovery (`getAllAgentFiles`, `getDefaultAgentDirs`, 52 lines) to
      `agent-file-discovery.ts`, importing them from the original path. The
      parent keeps the loader + validation and decreases from 344 to 233
      lines; SDK typecheck passes with 0 errors, the full SDK suite passes
      477/1/0 with 1127 assertions, all four workspace typechecks pass, and
      the inventory decreases from 192 to 191 with no exemption or rebaseline.
- [x] **QR-DJ.** Complete the `packages/agent-runtime/src/util/cache-debug.ts`
      decomposition manually: move the pure value-serialization cluster
      (`normalizeForJson`, `summarizeDataUrl`, `summarizeLargeValue`,
      `stableHash`, `SerializableValue`, 100 lines) to
      `cache-debug-serialize.ts`, importing it from the original path. The
      parent keeps the snapshot lifecycle + enrichment API and decreases from
      352 to 261 lines; agent-runtime typecheck passes with 0 errors, the
      full agent-runtime suite passes 1112/0 with 2936 assertions, all four
      workspace typechecks pass, and the inventory decreases from 191 to 190
      with no exemption or rebaseline.
- [x] **QR-DK.** Complete the `packages/agent-runtime/src/util/echo-compliance.ts`
      decomposition manually: move the constants + pure evaluators
      (`detectsVerificationCommand`, `isSecuritySensitivePath`, `classifyFileKind`,
      `hasNewApiDeclaration`, `userRequestedReview`, `meetsVerifierCriteria`),
      the `WriteRecord` type, `normalizePath`, and the pure step-boundary
      evaluation (`evaluateWritesAtStepBoundary`, 248 lines) to
      `echo-compliance-core.ts`, importing it from the original path and
      re-exporting the six evaluators + `WriteRecord` so enforcement.ts,
      tool-executor/native.ts, and the focused tests are unchanged. The
      parent keeps the tracker class + recording methods + steering and
      decreases from 509 to 291 lines; agent-runtime typecheck passes with 0
      errors, the focused echo-compliance suites pass 43/0 with 101
      assertions, the full agent-runtime suite passes 1112/0 with 2936
      assertions, all four workspace typechecks pass, and the inventory
      decreases from 190 to 189 with no exemption or rebaseline.
- [x] **QR-DL.** Complete the `packages/agent-runtime/src/tools/tool-call-parse.ts`
      decomposition manually: move the input-repair + validation-hint cluster
      (`ToolCallError`, `parseStringifiedToolInput`, `stringInputError`,
      `summarizeMissingReplacementFields`, `getToolValidationHint`, 151 lines)
      to `tool-call-repair.ts`, importing it from the original path and
      re-exporting `ToolCallError`. The parent keeps the three parse/transform
      entry points and decreases from 382 to 241 lines; agent-runtime
      typecheck passes with 0 errors, the focused tool-validation suite passes
      13/0 with 33 assertions, the full agent-runtime suite passes 1112/0 with
      2936 assertions, all four workspace typechecks pass, and the inventory
      decreases from 189 to 188 with no exemption or rebaseline.
- [x] **QR-DM.** Complete the
      `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts`
      decomposition manually: move the command-safety validation cluster
      (denylist regexes, `splitSafeAnd`, `splitSafePipes`,
      `hasUnquotedForbiddenMetachar`, `validateReadonlySegment`,
      `isReadonlyCommand`, 257 lines) to `readonly-command-validation.ts`,
      importing it from the original path. The parent keeps the handler and
      decreases from 364 to 109 lines; agent-runtime typecheck passes with 0
      errors, the focused run-readonly-command suite passes 21/0 with 157
      assertions, the full agent-runtime suite passes 1112/0 with 2936
      assertions, all four workspace typechecks pass, and the inventory
      decreases from 188 to 187 with no exemption or rebaseline.
- [x] **QR-DN.** Complete the
      `packages/agent-runtime/src/tools/handlers/tool/database/sqlite-adapter.ts`
      decomposition manually: move the SQL safety layer (constants + error
      codes + `StructuredDbError`, `classifySql`, `isWriteOperation`,
      `stripSqlCommentsAndQuotedText`, `applyQueryLimits`, `redactSql`, 244
      lines) to `sql-safety.ts`, importing it from the original path and
      re-exporting the whole layer so execute-query, analyze-query,
      describe-table, list-tables, and the focused test are unchanged. The
      parent keeps the connection/execution helpers and decreases from 423 to
      183 lines; agent-runtime typecheck passes with 0 errors, the focused
      sqlite-adapter suite passes 44/0 with 157 assertions, the full
      agent-runtime suite passes 1112/0 with 2936 assertions, all four
      workspace typechecks pass, and the inventory decreases from 187 to 186
      with no exemption or rebaseline.
- [x] **QR-DO.** Complete the
      `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`
      decomposition manually: move the zod response schemas (96 lines) to
      `openai-compatible-chat-schema.ts` and the pure request-body builder
      (`buildOpenAICompatibleChatArgs`, 145 lines) to
      `openai-compatible-chat-args.ts`, importing both from the original path.
      The parent keeps the class + doGenerate/doStream and decreases from 472
      to 267 lines; llm-providers typecheck passes with 0 errors, the
      llm-providers suite passes 79/0 with 145 assertions, all four workspace
      typechecks pass, and the inventory decreases from 186 to 185 with no
      exemption or rebaseline.
- [x] **QR-DP.** Complete the
      `packages/llm-providers/src/openai-compatible/completion/openai-compatible-completion-language-model.ts`
      decomposition manually: move the zod response schemas (46 lines) to
      `openai-compatible-completion-schema.ts` and the pure request-body builder
      (`buildOpenAICompatibleCompletionArgs`, 119 lines) to
      `openai-compatible-completion-args.ts`, importing both from the original
      path. The parent keeps the class + doGenerate/doStream and decreases from
      415 to 281 lines; llm-providers typecheck passes with 0 errors, the
      llm-providers suite passes 79/0 with 145 assertions, all four workspace
      typechecks pass, and the inventory decreases from 185 to 184 with no
      exemption or rebaseline.
- [x] **QR-DQ.** Complete the
      `packages/design-systems/src/parser.ts` decomposition manually: move the
      pure token/record helper cluster (regexes, `sha256`, `asRecord`,
      `asStringRecord`, `normalizeNestedRecord`, `sortRecord`,
      `normalizeTokens`, `collectFonts`, `inferTargets`, `inferId`,
      `inferDisplayName` — 168 lines) to `parse-helpers.ts`, imported by the
      original path. The parent keeps `parseDesignSystemSource` +
      `normalizeDesignSystemSource` and decreases from 325 to 172 lines;
      design-systems typecheck passes with 0 errors, the design-systems suite
      passes 19/0 with 68 assertions, and the inventory decreases from 184 to
      183 with no exemption or rebaseline.
- [x] **QR-DR.** Complete the
      `packages/agent-runtime/src/echo/design-contract.ts` decomposition
      manually: move the pure scanner helpers (constants + predicates +
      per-category scanners — 279 lines) to `design-contract-scan.ts`, imported
      by the original path. The parent keeps `runDesignContractScanner` and
      decreases from 393 to 130 lines; agent-runtime typecheck passes with 0
      errors, the focused design-contract suite passes 9/0 with 21 assertions,
      the full agent-runtime suite passes 1112/0 with 2936 assertions, all four
      workspace typechecks pass, and the inventory decreases from 183 to 182
      with no exemption or rebaseline.
- [x] **QR-DS.** Complete the `packages/database/src/service.ts` domain split
      manually: extract the shared statement machinery (`prepare`,
      `parseStoredJson`, `requireRow`, `statementCache`) to `sqlite.ts` (41
      lines), the session CRUD + cyclic-safe serializer to `sessions.ts` (126
      lines), and the message-history + cost-tracking CRUD to `history.ts`
      (113 lines), re-exporting the full public surface from the original
      `service.ts` path so `@savant-code/database/service` consumers
      (db-storage, local-agent-registry) are unchanged. The parent keeps
      agent-template + FID-document CRUD and decreases from 374 to 122 lines;
      database typecheck passes with 0 errors, the database suite passes 16/0
      with 43 assertions, all four workspace typechecks pass, and the
      inventory decreases from 182 to 181 with no exemption or rebaseline.
- [x] **QR-DT.** Complete the `packages/agent-runtime/src/context-compactor.ts`
      pass extraction manually: move the Layer-2 micro-compact pass +
      `buildCompactedToolValue` to `context-compactor/micro-compact.ts` (154
      lines) and the Layer-4 reactive-compact pass to
      `context-compactor/reactive-compact.ts` (121 lines), parameterized by
      the class fields they read; the class delegates and re-exports
      `buildCompactedToolValue` from the original path. The parent keeps the
      constructor, thresholding, anti-thrash scoring, and circuit-breaker
      methods and decreases from 476 to 264 lines; agent-runtime typecheck
      passes with 0 errors, the focused compactor suites pass 17/0 with 38
      assertions, the full agent-runtime suite passes 1112/0 with 2936
      assertions, all four workspace typechecks pass, and the inventory
      decreases from 181 to 180 with no exemption or rebaseline.
- [x] **QR-DU.** Complete the
      `packages/agent-runtime/src/templates/strings.ts` placeholder-injector
      extraction manually: move the `toInject` placeholder map + lazy resolver
      closures + `formatFallbackModelInfo` to
      `templates/placeholder-injectors.ts` (173 lines,
      `buildPlaceholderInjectors` parameterized by the fields it reads), with
      `formatFallbackModelInfo` re-exported from the original path. The parent
      keeps `formatPrompt` (now a delegation) + `getAgentPrompt` and decreases
      from 347 to 220 lines; agent-runtime typecheck passes with 0 errors, the
      focused strings suite passes 11/0 with 36 assertions, the full
      agent-runtime suite passes 1112/0 with 2936 assertions, all four
      workspace typechecks pass, and the inventory      decreases from 180 to 179
      with no exemption or rebaseline.
- [x] **QR-DV.** Complete the `common/src/tools/sequential-thinking.ts` type
      extraction manually: move the six public type declarations
      (`ThoughtData`, `ThoughtSnapshotEntry`, `ThoughtSessionStatus`,
      `ThoughtSessionSnapshot`, `ThoughtProcessResult`,
      `ThinkerFinalArtifact` — 99 lines) to `sequential-thinking-types.ts`,
      imported and re-exported from the original path so consumers
      (thought-session-store, thinker-convergence-gate, the focused test) are
      unchanged. The parent keeps `SessionStateError`, the `ThoughtSession`
      class, and `thinkerFinalArtifactToJSONValue` and decreases from 341 to
      269 lines; common typecheck passes with 0 errors, the common suite
      passes 624/0 with 1722 assertions, all four workspace typechecks pass,
      and the inventory decreases from 179 to 178 with no exemption or
      rebaseline.
- [x] **QR-DW.** Complete the
      `common/src/templates/agent-validation/validate.ts` extraction manually:
      move `validateSingleAgent` (184 lines) to
      `agent-validation/validate-single.ts`, imported and re-exported from the
      original path so consumers (the barrel, sdk impl/database/agent.ts, the
      registry test's spyOn) are unchanged. The parent keeps
      `DynamicAgentValidationError`, `collectAgentIds`, and `validateAgents`
      and decreases from 333 to 156 lines; common typecheck passes with 0
      errors, the common suite passes 624/0 with 1722 assertions, all four
      workspace typechecks pass, and the inventory decreases from 178 to 177
      with no exemption or rebaseline.
- [x] **QR-DX.** Complete the `cli/src/components/login-modal.tsx` split
      manually: move the callbacks + ref-wiring cluster to
      `cli/src/hooks/use-login-modal-actions.ts` (123 lines, a
      `useLoginModalActions` hook reading/writing the login store directly)
      and the post-enter URL section JSX to
      `cli/src/components/login-url-section.tsx` (148 lines, a
      `LoginUrlSection` component with its own copy-button hover state). The
      parent keeps the store wiring, responsive layout, logo, and the
      remaining render sections and decreases from 450 to 272 lines; CLI
      typecheck passes with 0 errors, targeted ESLint passes, the full CLI
      suite passes 3260/0 with 9001 assertions, and the inventory decreases
      from 177 to 176 with no exemption or rebaseline.
- [x] **QR-DY.** Complete the
      `packages/knowledge-graph/src/export/universe-builder.ts` extraction
      manually: move the pure helpers (`stableHash`, `regionPath`, `regionId`,
      `folderId`, `buildHierarchy`) plus the force-directed relaxation loop
      (`relaxRegions`) to `export/universe-helpers.ts` (132 lines). The parent
      keeps `buildUniverse` and decreases from 377 to 270 lines;
      knowledge-graph typecheck passes with 0 errors, the knowledge-graph
      suite passes 50/0 with 138 assertions, all four workspace typechecks
      pass, and the inventory decreases from 176 to 175 with no exemption or
      rebaseline.
- [x] **QR-DZ.** Complete the
      `cli/src/components/savant-free-landing-screen.tsx` state-hook
      extraction manually: move the entire derived-state + hooks wiring
      (logo mode, ads, streak, session-quota counters, reset-timer effect)
      to `cli/src/hooks/use-savant-free-landing-state.ts` (221 lines),
      returning the values the render needs. The parent keeps the props + JSX
      and decreases from 398 to 252 lines; CLI typecheck passes with 0
      errors, targeted ESLint passes, the full CLI suite passes 3260/0 with
      9001 assertions, and the inventory decreases from 175 to 174 with no
      exemption or rebaseline.
- [x] **QR-EA.** Complete the
      `packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts`
      file-IO extraction manually: move the types
      (`CheckpointFileEntry`, `TurnCheckpoint`, `TurnSummary`),
      `CHECKPOINT_RETENTION`, `checkpointFilePath`, `prune`, `listTurns`, and
      `getTurn` to `checkpoint-files.ts` (139 lines), imported + re-exported
      from the original path. The parent keeps the in-memory turn buffers and
      open/capture/close/restore/fork flows and decreases from 416 to 296
      lines; agent-runtime typecheck passes with 0 errors, the focused
      checkpoint-store suite passes 18/0 with 35 assertions, the full
      agent-runtime suite passes 1112/0 with 2936 assertions, all four
      workspace typechecks pass, and the inventory decreases from 174 to 173
      with no exemption or rebaseline.
- [x] **QR-EB.** Complete the `packages/knowledge-graph/src/update.ts` scan
      phase extraction manually: move the enumeration/stale-delete/
      hash-compare/parse preparation (steps 1–4) plus the infra constants and
      `mapWithConcurrency` to `update-scan.ts` (231 lines,
      `scanIndexState` returning the scan state + prefilled stats). The parent
      keeps the DB-write phases (upsert, edges rebuild, Louvain clustering)
      and decreases from 407 to 242 lines; knowledge-graph typecheck passes
      with 0 errors, the knowledge-graph suite passes 50/0 with 138
      assertions, all four      workspace typechecks pass, and the inventory decreases from 173 to 172
      with no exemption or rebaseline.
- [x] **QR-EC.** Complete the
      `cli/src/components/savant-ui/easter-egg-logo.tsx` overlay split
      manually: move the constants, `useSidebarWidth`, the bubble/chrome
      styles, and the four display overlays (`NagBubble`, `GlitchOverlay`,
      `TakeoverOverlay`, `FrozenBubble`) to
      `easter-egg-overlay-components.tsx` (275 lines), imported + re-exported
      from the original path so consumers (app.tsx, right-sidebar.tsx, the
      focused test) are unchanged. The parent keeps the context/provider,
      the `EasterEggOverlays` dispatcher, and `EasterEggLogo` and decreases
      from 428 to 124 lines; CLI typecheck passes with 0 errors, targeted
      ESLint passes, the full CLI suite passes 3260/0 with 9001 assertions,
      and the inventory decreases from 172 to 171 with no exemption or
      rebaseline.
- [x] **QR-ED.** Complete the `cli/src/hooks/use-savant-free-session.ts`
      landing-restart probe extraction manually: move the `restart('landing')`
      fire-and-forget metadata probe to
      `use-savant-free-session/landing-restart.ts` (59 lines,
      `runLandingRestart(ctx)` with an explicit `token`/`signal`/`isStale`/
      `apply` contract). The parent decreases from 330 to 294 lines; CLI
      typecheck passes with 0 errors, targeted ESLint and Prettier pass, the
      full CLI suite passes 3242/0 with 9001 assertions, and the inventory
      decreases from 170 to 169 with no exemption or rebaseline.
- [x] **QR-EE.** Complete the `cli/src/commands/design.ts` decomposition
      manually: move the pure authoring helpers + seed + resource mapping to
      `design-authoring-input.ts` (159 lines), the question catalog to
      `design-authoring-questions.ts` (123 lines), and the interactive
      `authorInteractively` flow to `design-authoring.ts` (205 lines), keeping
      the `DESIGN_COMMANDS` / `isDesignCreateIntent` /
      `handleDesignCreateIntent` public surface on the original path. The
      parent decreases from 632 to 190 lines; CLI typecheck passes with 0
      errors, targeted ESLint/Prettier pass, the repo's own focused router
      suites pass 20/0, the full CLI suite passes 3260 tests / 18 skipped /
      0 failed with 9001 assertions, and the inventory decreases from 173 to
      172 with no exemption or rebaseline. Operator decisions recorded:
      `cli/src/constants/savant-logo.ts` (921, dead code) is skipped and
      recorded out-of-scope; the stale `/export` logo comment is recorded
      only.
- [x] **QR-FF.** Complete the
      `cli/src/commands/export-conversation/template-css-part2.ts`
      decomposition manually: split the 332-line `EXPORT_CSS_PART_2` CSS
      constant at the Drive-Report boundary into `template-css-part2a.ts`
      (221 lines: prose, rows, blocks, attachments, footer) and
      `template-css-part2b.ts` (116 lines: FID-2026-0818-006/007 sections +
      media query), rewriting the original path as an 8-line concatenating
      facade so the `template.ts` import is unchanged. A pre/post-edit
      length + SHA-256 probe confirms the concatenated constant is
      byte-for-byte identical (`len=7056`, same hash). CLI typecheck passes
      with 0 errors, targeted ESLint/Prettier pass, the focused
      export-conversation suite passes 6/0, the full CLI suite passes
      3260 tests / 18 skipped / 0 failed with 9001 assertions, and the
      inventory decreases from 172 to 171 with no exemption or rebaseline.
- [x] **QR-GG.** Complete the
      `cli/src/commands/graph-export/universe-app-script.ts` decomposition
      manually: split the 1617-line `UNIVERSE_APP_SCRIPT` static payload at
      top-level function-declaration boundaries into eight sub-modules
      (`universe-app-script-a.ts` … `-h.ts`, 237/178/155/294/193/279/175/142
      lines), rewriting the original path as a 32-line concatenating facade
      so the `html-sections.ts` import is unchanged. A pre/post-edit length
      + SHA-256 probe confirms the assembled payload is byte-for-byte
      identical (`len=82450`, same hash). CLI typecheck passes with 0
      errors, targeted ESLint/Prettier pass, the full CLI suite passes
      3260 tests / 18 skipped / 0 failed with 9001 assertions (the
      standalone graph-export run trips a pre-existing tree-sitter
      `c_sharp_tags.scm` isolation artifact in `packages/code-map` — green
      in the full suite), and the inventory decreases from 171 to 170 with
      no exemption or rebaseline.
- [x] **QR-HH.** Complete the `cli/src/components/chat-input-bar.tsx`
      decomposition manually: extract the `Theme` + `ChatInputBarProps`
      contract to `chat-input-bar-types.ts` (65 lines), the ask-user form
      branch to `chat-input-bar-ask-user.tsx` (116), the Law-2 drive-
      confirmation branch to `chat-input-bar-drive-confirm.tsx` (55), and
      the compact/normal render branches to `chat-input-bar-compact.tsx`
      (177) and `chat-input-bar-normal.tsx` (209) behind
      `Pick<ChatInputBarProps, …>` contracts with verbatim JSX and callback
      bodies. The parent keeps the orchestration and decreases from 615 to
      281 lines; the `ChatInputBar` export and its `chat-bottom-panel.tsx`
      consumer are unchanged. CLI typecheck passes with 0 errors, targeted
      ESLint/Prettier pass, the full CLI suite passes 3260 tests / 18
      skipped / 0 failed with 9001 assertions, and the inventory decreases
      from 170 to 169 with no exemption or rebaseline.
- [x] **QR-II.** Complete the `cli/src/components/multiline-input.tsx`
      decomposition manually: move the keyboard/stdin wiring cluster (four
      specialized key handlers, the stdin-parser timeout effect, and the
      main `useKeyboard` delegation) verbatim to
      `multiline-input/use-multiline-keyboard.ts` (177 lines) behind a
      `UseMultilineKeyboardParams` contract, with editing-callback types
      flowing through `ReturnType<typeof useInputEditing>`. The parent
      keeps state/refs, sticky column, the imperative handle,
      editing/paste/scroll hooks, layout, and render and decreases from
      360 to 262 lines; the `MultilineInput` / `MultilineInputHandle` /
      `CURSOR_CHAR` public surface is unchanged. CLI typecheck passes with
      0 errors, targeted ESLint/Prettier pass, the full CLI suite passes
      3260 tests / 18 skipped / 0 failed with 9001 assertions, and the
      inventory decreases from 169 to 168 with no exemption or rebaseline.
- [ ] **QR-IJ.** Decompose the remaining production files discovered by the
      2026-08-21 full inventory (hidden in the quality report's +118 tail;
      `universe-css.ts` measured 14 and is compliant): `scripts/public-release.ts`
      (2952), `common/src/constants/savant-free-models.ts` (855),
      `packages/agent-runtime/src/tools/tool-executor/native.ts` (851),
      `packages/agent-runtime/src/echo/enforcement.ts` (753),
      `scripts/protocol-copies.ts` (731),
      `common/src/templates/initial-agents-dir/types/agent-definition.ts`
      (515), `packages/agent-runtime/src/run-agent-step/loop-iteration.ts`
      (497), `packages/agent-runtime/src/tools/stream-parser.ts` (496),
      `scripts/validation-manifest.ts` (477),
      `common/src/types/session-state.ts` (477),
      `common/src/templates/initial-agents-dir/types/tools.ts` (454),
      `packages/agent-runtime/src/run-agent-step/loop-context.ts` (437),
      `packages/agent-runtime/src/run-agent-step/loop.ts` (428),
      `cli/src/utils/analytics/state.ts` (411),
      `scripts/generate-protocol-bundle.ts` (410),
      `sdk/src/impl/llm/stream.ts` (398),
      `packages/agent-runtime/src/run-agent-step/step.ts` (397),
      `scripts/learnings-references.ts` (378), and
      `packages/agent-runtime/src/tools/tool-executor/custom.ts` (376), plus
      any further files in the report tail. Sensitivities: public-release.ts
      is the release engine; the initial-agents-dir templates are serialized
      copies synced with generated `.agents/` dirs (deliberately passed over
      in QR-CG); the agent-runtime files are the most-FID'd core runtime
      paths. Operator decision 2026-08-21: record the inventory and stop;
      production-versus-tests ordering to be decided when work resumes.
- [ ] **QR-Q.** Execute the remaining manual decomposition batches sequentially.
      Every target must be read, mapped, edited, re-read, tested, and call-graph
      audited before the next target; no batch may be hidden by rebaselining or an
      exemption. Current live inventory: 168 violations.

## Out-of-scope issues discovered

- [OPEN-OUT-OF-SCOPE] **Desktop planning FID metadata** — the pre-existing
  `FID-2026-0820-001` through `FID-2026-0820-006` records currently fail repository
  structure/attribution validation (23 total findings). This quality-remediation task
  does not rewrite those unrelated planning records.
- [OPEN-OUT-OF-SCOPE] **Historical attribution terms in SCOPE.md** — older completed-task
  records contain prior role/product attribution language. This FID review does not
  rewrite historical records; normalization requires a separate operator decision.
- [OPEN-OUT-OF-SCOPE] **savant-free e2e test suite** — `bun test e2e/tests/`
  fails for reasons unrelated to the Phase 0 upgrade: (1)
  `getSavantFreeBinaryPath()` returns `cli/bin/savant-free` without `.exe` on
  Windows (the binary is `savant-free.exe`); (2) a `SavantFreeSession` export
  is missing from the e2e utils. The `SAVANT_FREE_MODE=true` build compiles
  (binary produced) — only the test harness is broken. Fixing it is a separate
  task, not Phase 0.
- [OPEN-OUT-OF-SCOPE] **Interactive Phase 0 acceptance** (tmux smoke in WSL,
  Windows Terminal visual pass, ConHost guard check) cannot be run in this
  headless session — deferred to operator/runtime verification before FID-003
  closes.
- [OPEN-OUT-OF-SCOPE] **Dead `cli/src/constants/savant-logo.ts` asset** (921
  lines, quality violation) — `SAVANT_LOGO_PNG_BASE64` has zero production
  consumers; `/export` branding uses `CHARACTER_LOGO_DATA_URI` via
  `export-conversation/branding.ts` instead. Operator decision 2026-08-20:
  skip this file for now (no delete, no split, no re-wire). The asset remains
  recoverable from `art/savant-logo.png` and git history.
- [OPEN-OUT-OF-SCOPE] **Stale logo claim in `export-conversation.ts` header
  comment** — line 8 states the report is branded with the real Savant logo
  embedded as base64, but the implementation uses the character logo
  (FID-2026-0807-009 alignment). Operator decision 2026-08-20: record only;
  the comment is not corrected in this program.
