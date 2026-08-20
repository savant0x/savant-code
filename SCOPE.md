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

## Out-of-scope issues discovered

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
