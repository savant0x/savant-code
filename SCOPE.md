# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID, session summary, and
learnings. Never use `[x]`, `deferred`, or `out of scope` as a disposition.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling, or repository boundaries. Operator approval applies only where a
recorded decision or external dependency requires it.

## Open items

- [ ] **Local v0.0.36 development line.** `v0.0.35` shipped on 2026-10-11 (GitHub
      release published, npm `latest` = 0.0.35), which made this item's previous
      text — publish 189 local commits for v0.0.35 — stale; it is replaced here.
      Operator ruling 2026-10-12 (Q1/Q2): bump to 0.0.36 system-wide, do **not**
      cut the release today, keep every post-release commit local on `main`, and
      let it accumulate under `## 0.0.36` until the cut is called. Local commits
      are permitted without asking; pushing `main` stays release-only. The bump
      landed in this pass (`VERSION`, the 17 synchronized manifests,
      `protocol.config.yaml` project.version, `bun.lock`, the four desktop
      surfaces, the CHANGELOG heading with its callout, and the documented
      version surfaces; `version:check` PASS).
      **Automation level: 3.**

- [ ] **Session-end review replays the skill-lifecycle log forever.** Measured
      2026-10-13 while routing the review's patterns: `.savant/skill-lifecycle-events.jsonl`
      holds 18 events, all stamped 2026-10-12T21:42:19 (one `draft_created` then 17
      `draft_failed` inside 105 ms, every one for the same skill
      `library-complete-needs-a-named-consumer`), and
      `scripts/session-end-notices.ts` → `skillLifecycleReportLines` claims the
      `'cli'` surface cursor and **never acknowledges** it, so every session-end
      review re-prints the same lines (plus `… 8 more`). `bun run lessons:to-skills`
      today reports 0 candidates and appends 0 events, so the burst is historical,
      not live.
      **Blocker:** which surface owns the acknowledgement decides where the
      operator first sees a skill draft on the trust surface — the headless review
      (whose stdout is a transcript, so it would ack) or the interactive notice at
      `cli/src/components/skill-lifecycle-notice.tsx`, which acks today. Acking in
      the review suppresses the TUI's display; not acking keeps the replay. That is
      an operator-facing visibility decision on the self-improving harness's trust
      contract, so it is presented rather than chosen. **Automation level: 1.**

- [ ] **T186. Two registered workspaces sit outside every typecheck and test
      chain.** `package.json` registers 15 workspaces, but the root `typecheck`
      and `test` chains each cover 13; `savant-free` (17 tracked TS/TSX files,
      including `savant-free/cli/build.ts` and its e2e suites) and
      `scripts/tmux` (11 tracked TS/TSX files under `tmux-viewer/`) have no leg,
      and neither workspace declares a `typecheck` script. The doc surfaces
      asserting "all 13 workspaces" were corrected this pass to state the real
      coverage.
      **Operator direction 2026-10-12 (Q13):** since `savant-free` is being
      removed, the correct path is (1) land the T122 removal — workspace
      registration, CLI surface, release tooling and e2e suites — under its own
      FID, then (2) add the remaining `scripts/tmux` leg, at which point the
      chains cover every registered workspace. Until the removal lands the
      coverage note above stays accurate as written.
      **Blocker:** adding a leg changes the fail-closed release gate battery
      (`protocol.config.yaml` `type_check`/`test` plus the root scripts), and the
      removal is operator-owned under T122. **Automation level: 1.**

- [ ] **T187. Remaining skills carry no `version` frontmatter.** Operator
      authorization 2026-10-12 (Q8): the five named skills — `release-workflow`,
      `savant-design`, `savant-design-systems`, `savant-motion`,
      `startup-playbook` — now carry `version: 0.1.0`, taking `skills:check` from
      35 to 30 warnings. The rule still fires for the six `coding-*` language
      skills, and the original count was itself understated: the remaining
      version warnings are not five but the whole hand-written set. Finishing
      them needs the same explicit operator authorization, because
      `.agents/skills/**` is the operator-only release surface (`/skills trust`).
      **Automation level: 1.**

### Providers and routing

- [ ] **T119. Provider live-list probes (no purchase).** Operator ruling
      2026-10-12 (Q15): no provider is funded — providers are tested over free
      endpoints, and a provider the operator has stated as added is already
      confirmed live and real; what remains is a live model-list probe. That
      withdraws the previous "needs an operator-provided paid xKiro account"
      blocker. **Measured 2026-10-13:** all 25 remote registry endpoints return
      HTTP 200 model catalogs, using stored keys for the 14 key-gated endpoints.
      Local Ollama and account-specific Cloudflare remain separate boundaries.
      Counts and endpoint evidence are in the learning-remediation session summary;
      no inference, purchase or provider-parity edit was performed.
      **Automation level: 3** for the probe.

- [ ] **T175. Sweep control-manifest authorship + control-armed re-run.**
      Open remainder of archived `FID-2026-1007-016`: the seam is built, but
      verdicts need the operator-owned `<provider>/<family>` control manifest,
      a funded control-armed re-run, ToS comfort for scaled dual-model
      probing, a probe-budget number, the no-control verdict-naming ruling,
      and a credential-epoch rotation source. Design is in archived
      `FID-2026-1007-016` Loops 2 and 4.
      **Blocker:** operator manifest content, funding, ToS, budget, naming,
      and rotation source — all external to the repository.
      **Operator response 2026-10-12 (Q16):** "need more info first" — each of
      the six inputs has to be explained concretely, with the decision it gates,
      before it can be answered. The explanation is written up in
      `dev/operator-decisions.md` (Q16) and the question stays open.
      **Automation level: 1** (no agent action; operator-owned until then).

- [ ] **T171. Harvested-candidate auto-wire.** Open remainder of archived
      `FID-2026-1008-002` phase 2 and `FID-2026-1008-004` item C, option 2.
      Reuse the discovery wizard prefill when selecting a discovery-only
      provider; design is in archived `FID-2026-1008-004` Loop 4.
      **Blocker:** operator ruling on the stricter verdict gate (exclude
      `open-relay`) and consent shape (inline wizard with Enter per step
      versus one confirmation).
      **Operator response 2026-10-12 (Q17):** "no clue what this even is, are
      these stale?" — the item is re-derived against the current
      `cli/src/utils/provider-wizard-discovery.ts` and
      `cli/src/chat/use-chat-pickers.ts` before the question is asked again.
      **Re-derived 2026-10-13:** explicit `/provider add <host>` already uses
      the prefill and per-step consent; picker selection delegates to provider
      setup and has no discovery-prefill branch. The existing discovery suite
      is in `cli/src/commands/__tests__/` (15 PASS), not `utils/__tests__/`.
      The picker change still requires the recorded verdict/consent ruling.
      **Automation level: 1.**

- [ ] **T173. KiosAPI window-table rows for five exact feed ids.**
      Open remainder of archived `FID-2026-1008-001`: `gpt-oss-20b`,
      `claude-haiku-4-5-20251001`, `llama-3.2-11b-vision-instruct`,
      `deepseek-v4-pro-0813`, `codex-auto-review` have no fallback row and
      retain the conservative 200k default.
      **Blocker:** vendor-published window values for these exact ids;
      the previous public-source search did not establish them.
      **Operator direction 2026-10-12 (Q18):** always live probe — establish the
      values by probing the vendor rather than by a public-source search.
      **Live-probed 2026-10-13:** pricing returns 80 rows, including four exact
      targets but no window fields; the authenticated model list returns 28 rows
      with no window fields and none of the five exact target ids. The fifth
      target is absent from pricing too. Vendor window evidence remains missing;
      no fallback value was inferred or changed.
      **Automation level: 3** for the probe.

- [ ] **T62-followups.** TokenHarbor needs a free-cell identity re-run after
      its allowance resets; TokenRouter self-identification needs an operator
      top-up. **Blocker:** provider credits/keys. **Automation level: 1.**

- [x] **Parity-gateway-probes. Gateway + Tier 1 surface probes for the
      provider-parity program.** Measured 2026-10-12 (probes under
      `scripts/providers/audit-probes/`): Kilo public keyless (200, 391 rows,
      inference round-trip proven); OpenCode public (200, 83 rows live) but
      free-tier product-locked (403); Tier 1 swept (2 public, 14 key-gated, 2
      no-surface). **Operator ruling 2026-10-12:** the deliverable is registry
      expansion, not dev-held credentials — users bring their own keys;
      keyless acceptance is surface-verified, inference leg deferred to the
      user's key (recorded narrowing of the runbook's real-request step).
      Evidence: `docs/design/provider-parity-review-2026-10-12.md`;
      additions are `FID-2026-1012-026`. **Automation level: 3.**

### Harness and process

- [ ] **Task-id reuse hazard (found 2026-10-13).** The register evicts an item on closure and the
      repository keeps no record of the numbers it has issued, so a retired id can be reallocated to
      unrelated work with nothing left to notice it. Measured: `T188` names the 2026-10-11
      install-independent undeclared-import guard in
      `dev/fids/archive/FID-2026-1011-004-install-independent-undeclared-import-guard.md:1` and in
      `dev/session-summaries/2026-10-11-undeclared-import-guard-t188.md:1`, while the register no
      longer holds that item — this pass allocated `T188`–`T190` from the register's visible maximum
      and had to evict all three on closure so that one id would not carry two meanings.
      **Blocker:** the disposition is a design decision the register cannot make for itself — either
      the register keeps a retired-id ledger, or task ids gain a date epoch so reuse is impossible.
      Both change a governance surface the operator owns (`SCOPE.md` plus the `scope.*` validators),
      and the second would renumber live items. Presented, not decided unilaterally.
      **Automation level: 1.**

- [ ] **T122. Savant-Free removal.** Operator direction 2026-10-12 (Q12/Q5):
      the savant-free flag/feature is to be removed rather than repaired. The
      known failing integration remains open under the removal decision, and the
      aggregate `ci` leg stays red by design until the removal lands. Removal
      spans the workspace registration, the CLI surface, agents, common, docs,
      release tooling and the e2e suites, and needs its own FID.
      **Automation level: 1** until the operator calls it.

### Learnings store: boot-read and lifecycle (review 2026-10-12)

Full review: `docs/design/learnings-boot-loading-and-lifecycle-review.md`. The ledger is a
boot-read artifact (`agents/savant/system-prompt.ts:117` reads it 0-EOF in every mode) at
77,195 chars / 1,174 lines — 23% under the 100,000-char read boundary that once truncated it
at boot (`CHANGELOG.md:3464`) and 26 lines under a retirement cap no gate enforces. Seven
records own the repairs; each carries its evidence and its feature in the review's §3/§4. All seven are
children of the remediation master `FID-2026-1012-022` as **Lane V** — the artifact, the operator's
line of sight to it, and the pipeline's targeting. Operator ruling 2026-10-12: they are kept, because
the ledger's value is real only if it is visible and it is not hidden; they are not a substitute for a
class fix, and the six programme lanes are.

### Failure-class remediation program (master `FID-2026-1012-022`, 2026-10-12)

The ledger's purpose is dog-fooding: each entry records a real failure so the class can be
fixed. The classes are measured from the mechanical capture
(`dev/experiences/raw-traces.jsonl`: **559 records / 68 classes / 195 sessions**, 2026-08-24 →
2026-10-12, 27 classes at the repo's own ≥3-session bar; the instrument — `toolName` + the first 70
characters of the error line — and its slice-sensitivity table are in `FID-2026-1012-022` §Evidence)
and cross-checked against the ledger's coverage. Matrix and root causes:
`docs/design/learnings-root-cause-matrix.md`. One **master** record holds the census and the
per-class allocation — **every one of the 68 classes has exactly one owning child, 559 of 559
records, zero unassigned** — and each child declares a recurrence assertion instead of a one-off
verification, so the ledger records what was fixed, not what failed. All twelve records dated
2026-10-12 (`-010` … `-021`) are children of the master, as are the two added with it (`-023`,
`-024`); class-lane closure requires investigated causes, reliable capture and exercised observation,
while artifact/machinery children close on their own committed gates. All seven old wrapper classes
remain unresolved: age and missing records do not establish dormancy. The pipeline keeps running,
with FID-024 owning capture/expectedness corrections and FID-014 owning class-to-rule targeting.

- [ ] **FID-2026-1012-022. Open-work master plan (build order + status board).** Sequences **all 24
      open register items** — the fifteen active records and the nine tasks without one — into three
      chains with declared dependencies, exit gates, automation levels and blockers, plus the census
      that gives every failure class an owner (68 classes / 559 records across six lanes). Children:
      `-010`…`-021`, `-023`, `-024`; Chain C tasks get children drafted at wave start. Not gateable
      itself; closes only when every child is closed and the closing pass re-runs the allocation.
      Pointing an automation run at this record **is** the operating instruction. **Automation level: 3.**

- [ ] **FID-2026-1012-017. The incomplete-arguments class has never been fixed at its
      source.** RC1 — **18 classes / 193 records** (35% of the capture; nine tools, 40+ sessions,
      16 of them dated today) → E1. Learned 2026-08-16, and its lesson was retired out of the boot
      read on 2026-10-12 while the class still fired. **Automation level: 3.**
      **Loop 6 (2026-10-13):** the remaining half is the provider-side rejection. The rejection now
      names the field the schema refused (only the issue path/code/expected — never the payload), and a
      repeated part of one call-out steers once instead of once per part; no ledger row is dropped.
      Measured: the 20 post-fix rows are one response's parts (17 the same tool, tail pair 10 ms apart),
      so a class's row count is an upper bound on occurrences. The four classes that are still firing
      stay open and the fifteen others stay unobserved, not clean.

- [ ] **FID-2026-1012-018. read_url is the top recorded class, covered by no lesson and no
      owner.** RC2 — **11 classes / 181 records** (404 114×/18 sessions, plus 403, 401, 429, 405,
      503, extraction, oversize, private-address and DNS shapes; ledger coverage zero) → E2.
      **Automation level: 3.**

- [ ] **FID-2026-1012-019. Three tools degrade silently, breaking a rule the ledger already
      states.** RC3 — **6 classes / 50 records**: a missing research key, a missing ripgrep binary
      in two class shapes, an exit-0/zero-match search and two ripgrep argument failures, all
      indistinguishable from "found nothing" → E3. **Automation level: 3.**

- [ ] **FID-2026-1012-020. Edit-path friction is reported, not diagnosed.** RC4 — **13 classes /
      72 records** (`str_replace` mismatch, no-op, patch failure, multi-occurrence, readonly;
      `apply_patch` path failures; `list_directory`) → E4. **Automation level: 3.**

- [ ] **FID-2026-1012-021. Nothing closes the loop from recurrence to fix.** RC5 → E5: the
      machinery that turns a recurring class into an owned repair, asserts the class stopped, and
      only then writes the lesson. Must not wire its coverage check before 017–020 have owners.
      Verified machinery: coverage, qualified lesson-last ordering, idempotent proposed
      FID drafting. Actual observation and the no-commit hold keep closure open.
      **Automation level: 2** (drafting a defect FID is automatable; approving one is the
      operator's).

- [ ] **FID-2026-1012-023. Command execution has no reliability contract.** RC6 — **13 classes /
      27 records**: nine timeout budgets (10 s … 2400 s) discovered one turn at a time, and an
      abort recorded under `run_readonly_command` whose message names `run_terminal_command` → E6.
      **Automation level: 3.**

- [ ] **FID-2026-1012-024. Failure classes have no horizon.** RC7 — **7 classes / 36 records**
      whose old wrapper stopped on 2026-09-09; this does not prove repair. Deep probes find later
      differently worded failures, uncaptured exit-code/nested errors and overbroad expectedness.
      Investigate all seven before any disposition → E7. **Automation level: 3.**

### Build orders (formalized as FIDs 2026-10-07)

The build order for **every open item in this register** — the fifteen active records and the nine
tasks that carry none — lives in the master record `FID-2026-1012-022` (`### Work order` for the
schedule, `### Status board` for current state), so there is exactly one place an automation run can
be pointed at. Its three chains: **A**, the failure-class lanes (`-024` → `-023`; `-024` →
`-017`/`-018`/`-019`/`-020`; then `-021`); **B**, the learnings-store artifact — Lane V (`-011` and
`-014` first, then `-012`, `-013` and `-010`, then `-016`, with `-015` last); **C**, the register
tasks (`T122` → `T186`, plus `T119`, `T173`, `T171`, `T175`, `T62-followups`, `T187` and the local
`0.0.36` development line). Every edge is declared as `**Depends On:**` metadata on the child, so the
ledger validates the graph and rejects a cycle. Chain C items run under child FIDs drafted at their
wave start; the operator-gated items — the `0.0.36` cut, `T122`, `T186`, `T171`'s ruling, `T175`,
`T62`'s credits and `T187` — are named in the master's "What stops for you", and nothing automates
past them.

## Machine-readable scope targets

Operator authorization: complete the master program at automation level 3 (2026-10-12).
The planning review is complete; implementation, verification and local commits are authorized.
Evidence and per-record Loop 2 corrections are in
`docs/design/perfection-loop-2026-10-12.md`. Additional implementation test/probe surfaces named
there must be covered by the owning item's targets before source writes begin. Every original
work item remains active, including the recorded level-1 consolidation and external-input holds.

<!-- FID-2026-1001-003 step 5a: per-item write targets for the Law 2 gate
     (operator-approved 2026-10-02, "present before writing" honored). Each
     line maps a register item to the paths its approved work may touch.
     No pattern = non-covering, fail-closed. Items with no write surface
     (operator-only actions) carry none. Governance surfaces the protocol
     itself mandates are GATE-LEVEL exemptions (operator ruling 2026-10-02),
     deliberately not register items.

     Only OPEN items carry a line here. A completed item's authority must
     leave with the item: while its globs remain, `loadScopeArtifact` grants
     them to every write, so "present before act" is satisfied by work that
     finished days ago. Evict the     line in the pass that closes the item. -->

- FID-2026-1012-017: `sdk/src/impl/llm/**`, `sdk/src/run/**`,
  `sdk/src/__tests__/tool-argument-budget.test.ts`,
  `common/src/types/contracts/llm.ts`, `common/src/util/tool-argument-budget.ts`,
  `common/src/util/__tests__/experience-classes.test.ts`,
  `packages/agent-runtime/src/run-agent-step/**`,
  `packages/agent-runtime/src/tools/stream-parser/**`,
  `packages/agent-runtime/src/tools/handlers/tool/**`, `common/src/tools/params/tool/**`
- FID-2026-1012-018: `sdk/src/tools/read-url/**`, `sdk/src/__tests__/read-url*.test.ts`,
  `common/src/tools/params/tool/**`
- FID-2026-1012-019: `packages/agent-runtime/src/llm-api/**`, `sdk/src/native/**`,
  `packages/agent-runtime/src/tools/**`, `common/src/constants/**`,
  `common/src/util/capability-notice.ts`, `common/src/util/__tests__/capability-notice.test.ts`,
  `common/src/util/experience-classes.ts`, `sdk/src/tools/code-search/**`,
  `sdk/src/__tests__/code-search-flags.test.ts`,
  `sdk/src/__tests__/capability-preflight.test.ts`,
  `sdk/src/__tests__/ripgrep-path-fallback.test.ts`,
  `sdk/src/run/agent-runtime-impl.ts`, `sdk/src/impl/agent-runtime.ts`,
  `common/src/types/contracts/agent-runtime.ts`,
  `packages/agent-runtime/src/run-agent-step/loop-context.ts`,
  `packages/agent-runtime/src/run-agent-step/capability-preflight.ts`,
  `packages/agent-runtime/src/run-agent-step/__tests__/capability-preflight.test.ts`
- FID-2026-1012-020: `packages/agent-runtime/src/process-str-replace.ts`,
  `packages/agent-runtime/src/edit-diagnostics.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/**`,
  `packages/agent-runtime/src/__tests__/process-str-replace*.test.ts`,
  `packages/agent-runtime/src/__tests__/edit-diagnostics.test.ts`, `sdk/src/run/**`
- FID-2026-1012-021: `scripts/experiences-dedup.ts`, `scripts/experiences-recurrence.ts`,
  `scripts/experiences-learning-order.ts`, `scripts/experiences-repair-drafts.ts`,
  `scripts/learnings-validation.ts`,
  `scripts/__tests__/experiences-learning-order.test.ts`,
  `scripts/__tests__/experiences-repair-drafts.test.ts`,
  `scripts/experiences-coverage.ts`, `scripts/hygiene.ts`, `scripts/lessons-to-skills.ts`,
  `scripts/lesson-feature-pipeline.ts`, `scripts/session-end-review.ts`,
  `scripts/validate-repository.ts`, `scripts/__tests__/experiences-coverage.test.ts`,
  `dev/agenda.md`, `dev/experiences/**`, `package.json`,
  `docs/design/learnings-root-cause-matrix.md`
- FID-2026-1012-022: `dev/fids/**`, `SCOPE.md`, `docs/design/**`, `dev/experiences/**`,
  `dev/agenda.md`
- FID-2026-1012-023: `sdk/src/tools/run-terminal-command.ts`, `sdk/src/run-state/**`,
  `sdk/src/run/tool-call.ts`, `sdk/src/__tests__/command-execution-contract.test.ts`,
  `sdk/src/__tests__/run-terminal-command.test.ts`,
  `packages/agent-runtime/src/tools/**`, `packages/agent-runtime/src/run-agent-step/**`,
  `packages/agent-runtime/src/hooks/**`, `common/src/types/contracts/**`,
  `common/src/types/experience.ts`, `common/src/util/command-execution.ts`,
  `common/src/util/experience-classes.ts`, `common/src/tools/params/tool/**`,
  `dev/experiences/class-owners.json`
- FID-2026-1012-024: `common/src/types/experience.ts`, `common/src/util/experiences.ts`,
  `common/src/util/experience-*.ts`, `common/src/util/__tests__/experience-*.test.ts`,
  `packages/agent-runtime/src/hooks/**`, `packages/agent-runtime/src/tools/tool-executor/**`,
  `packages/agent-runtime/src/tools/stream-parser.ts`,
  `packages/agent-runtime/src/tools/stream-parser/**`,
  `packages/agent-runtime/test/setup-test-isolation.ts`, `common/src/types/hooks.ts`,
  `protocol.config.yaml`, `scripts/experiences*.ts`, `scripts/__tests__/experiences*.test.ts`,
  `scripts/session-end-review.ts`, `dev/experiences/**`
- Release-0.0.36: `VERSION`, `package.json`, `agents/package.json`,
  `cli/package.json`, `cli/release/package.json`, `common/package.json`,
  `common/src/constants/protocol-bundle.generated.ts`, `desktop/package.json`,
  `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/Cargo.toml`,
  `desktop/src-tauri/Cargo.lock`, `evals/package.json`,
  `savant-free/package.json`, `savant-free/cli/release/package.json`,
  `scripts/tmux/package.json`, `sdk/package.json`, `packages/**/package.json`,
  `bun.lock`, `protocol.config.yaml`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/**`, `SCOPE.md`, `dev/agenda.md`,
  `dev/operator-decisions.md`, `dev/fids/**`, `dev/feature-pipeline/**`,
  `dev/session-summaries/**`, `scripts/version-docs.ts`,
  `scripts/version-docs-drift.test.ts`, `.agents/skills/**/SKILL.md`
- T119: `.env.local`, `docs/providers.md`,
  `dev/session-summaries/2026-10-03-provider-*.md`,
  `dev/scratchpad/active/provider-catalogs-2026-10-03/**`,
  `dev/scratchpad/active/provider-integration-*`
- T175: (no write surface — operator-owned)
- T171: `cli/src/utils/provider-wizard-discovery.ts`,
  `cli/src/chat/use-chat-pickers.ts`,
  `cli/src/chat/__tests__/model-picker-activation.test.ts`,
  `cli/src/utils/__tests__/provider-wizard-discovery.test.ts`
- T173: `common/src/constants/context-window-table-kiosapi.ts`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- Parity-gateway-probes: `scripts/providers/audit-probes/**`, `docs/design/provider-parity-review-2026-10-12.md`, `SCOPE.md`
- T122: (no write surface — operator-owned)
- T186: (no write surface — blocked on the T122 savant-free removal)
- T187: (no write surface — operator-owned skills surface)
