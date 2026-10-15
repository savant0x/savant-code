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

- [x] **Documentation lifecycle reconciliation (2026-10-14).** Audited every
      active FID against implementation and gate evidence; `CHANGELOG.md` coverage
      and the archived-FID closure guard both pass. No active record satisfied
      closure, so no FID was archived and no false closure entry was added. The
      pending register is recorded in
      `dev/session-summaries/2026-10-14-fid-lifecycle-reconciliation.md`.
      **Automation level: 3.**

## Full active-FID completion directive (2026-10-14)

The operator directed completion of all actual pending work in every active FID and
granted automation level 3. The five continuing class-program records are
`FID-2026-1012-017`, `-021`, `-022`, `-023`, and `-024`;
the approved-resume record is closed and archived. Execute the continuing records
in dependency order, implement every automatable
step, run each declared gate, close and archive every record whose ground truth and
gates support closure, and leave only specifically evidenced operator or external
constraints active. **Automation level: 3.**

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

**Parity-gateway-probes acceptance ruling (2026-10-12, retained authority):**
the deliverable is registry expansion, not dev-held credentials — users bring
their own keys. Keyless acceptance is surface-verified; the inference leg belongs
to the user's key under the recorded narrowing of the runbook's real-request step.
The 2026-10-14 `devoverride` additionally limits Tier 1 picker catalogs to
coding-harness-compatible chat/text rows and excludes non-chat modality rows.
The completed Tier 1 parity wave is committed locally as `f6ce2109` and archived
under `dev/fids/archive/`; its probe evidence is in
`docs/design/provider-parity-review-2026-10-12.md` and the 2026-10-14 FID-folder
audit report. The completed probe item grants no continuing write authority.

### Harness and process

- [ ] **Repository validator execution boundary (found 2026-10-14).** The hard
      `bun run validate:repository` command produced no validator output in two
      attempts; the external PowerShell runner returned
      `Unknown: ChildProcess.kill` after its 120-second and 300-second limits.
      The repository validator builds its complete issue set before printing and
      active FID gates run synchronously without an internal timeout, so no
      repository defect is established by this observation. **Blocker:** the
      external command runner did not complete the hard gate. **Automation level: 2.**

- [x] **FID-2026-1014-001. The read-only guard refused legitimate reads and
      still carried a closed security FID's unfixed waiver.** Operator direction 2026-10-14
      ("Audit whether any current refusal rule is too broad — a legitimate read-only command the
      guard rejects — and fix what you find", plus the standing position that a harness must not
      refuse the operator: Q23). Measured with a 56-command read-only corpus: **5 false refusals**
      (the POSIX null sink `2>/dev/null` in three spellings, stdin redirection `< file` in two)
      while the EHEL classifier already treats `/dev/null` as a non-mutation target. Fixed
      (strip-then-rescan; corpus false positives now **0**). The same pass found the inverse: the
      HEAD module carried the **pre-SEC-3 whole-segment waiver**, accepting
      `cat .env > /tmp/exfil.txt 2>&1`, `echo $(whoami) 2>&1` and `ls; rm x 2>&1` through a tool
      that is deliberately not phase-gated. Restored to spec and its promised suite delivered.
      **The under-breadth class is reported, not closed** — the guard is a denylist, not a
      boundary: `git push`, `git clean -fd`, `git stash pop`, `find | xargs rm`, and on a second
      probe `bun -e "…"`, `bun x <pkg>`, `bun run release:public`, `deno eval "…"`,
      `find . -delete` and `kill -9 1` are all allowed. Closing them means adding refusals, which
      is the operator's call (Q23). **Automation level: 3.** **Closed + archived 2026-10-14**
      (`1fd828b9`, `2aa5bab4`); the blocked step above stays registered under **Q23**.

- [x] **FID-2026-1014-003. No agent may be attributed — one rule, three enforcement points, no
      exception.** Operator direction 2026-10-14: *"the rule is firm. NEVER allow co-attribution,
      there should not even be an escape hatch"* / *"it's 100% forbidden from any coding agent to
      tag my repo"*. Measured before: the rule existed in **two divergent copies** (a bash `grep`
      in the hook and `WATERMARK_PATTERNS` in the pre-push scan), naming two identities; the hook
      **advertised** the `--no-verify` bypass in its own failure text; a session summary invited
      footer removal "per the operator's own co-author policy"; and **no CI layer existed**. Now:
      one module (`scripts/attribution-guard.ts`), three layers (hook, pre-push range scan, CI),
      fail-closed on every unusable input, whole-history scan exit 0. Amended the 2026-10-02
      summary; left a dated amendment rather than a silent rewrite.
      **Blocker (operator):** the CI job must be marked a **required status check** in branch
      protection or it cannot block a merge — only the operator can set that.
      **Automation level: 3.** **Closed + archived 2026-10-14** (`346ecaff` the rule + hook + CI,
      `77d3be67` the repository-gate wiring); the branch-protection action above stays the
      operator's.

- [ ] **T122. Savant-Free removal.** Operator direction 2026-10-12 (Q12/Q5):
      the savant-free flag/feature is to be removed rather than repaired. The
      known failing integration remains open under the removal decision, and the
      aggregate `ci` leg stays red by design until the removal lands. Removal
      spans the workspace registration, the CLI surface, agents, common, docs,
      release tooling and the e2e suites, and needs its own FID.
      **Automation level: 1** until the operator calls it.

### Learnings store: boot-read and lifecycle (review 2026-10-12)

Historical review: `docs/design/learnings-boot-loading-and-lifecycle-review.md`.
All seven Lane V artifact records (`FID-2026-1012-010` through `-016`) closed and
were archived on 2026-10-13. The generated bounded boot digest, enforced ledger
ceiling, shared live/retired locator, evidence checks, canonical rule targeting,
and pipeline gates are implemented; `6b847099`, `3e0fab27`, and `ca1f359d` carry
the implementation and recovery work. Their closure evidence lives in the
archived records and CHANGELOG. These completed artifact repairs do not establish
production class repair; the six failure-class lanes remain active.

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

- [ ] **FID-2026-1012-022. Open-work master plan (build order + status board).** Sequenced the
      **original 24 open register items** (2026-10-12) — fifteen records and nine tasks — into three
      chains with declared dependencies, exit gates, automation levels and blockers, plus the census
      that gives every failure class an owner (68 classes / 559 records across six lanes). Children:
      `-010`…`-021`, `-023`, `-024`; Chain C tasks get children drafted at wave start. Not gateable
      itself; closes only when every child is closed and the closing pass re-runs the allocation.
      Its current status board reflects seven active records after Chain B, QOL, and Q25 child-lane archival.
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

**Q25 child-lane closure 2026-10-14:** FID-2026-1012-018, FID-2026-1012-019,
and FID-2026-1012-020 are closed and archived under their named waivers. Their
deterministic implementation gates are green; no production class repair or
qualified observation is claimed. FID-2026-1012-017 remains active because its
four post-fix classes are rejected by the recurrence gate.

- [ ] **FID-2026-1012-021. Nothing closes the loop from recurrence to fix.** RC5 → E5: the
      machinery that turns a recurring class into an owned repair, asserts the class stopped, and
      only then writes the lesson. Must not wire its coverage check before 017–020 have owners.
      Verified machinery: coverage, qualified lesson-last ordering, idempotent proposed
      FID drafting. Actual observation keeps closure open. The operator lifted
      the no-commit hold on 2026-10-13; the held work landed at `2a34e558`.
      **Automation level: 2** (drafting a defect FID is automatable; approving one is the
      operator's).

- [ ] **FID-2026-1012-023. Command execution has no reliability contract.** RC6 — **13 classes /
      27 records**: nine timeout budgets (10 s … 2400 s) discovered one turn at a time, and an
      abort recorded under `run_readonly_command` whose message names `run_terminal_command` → E6.
      **Verification history:** the sequential validator previously showed
      intermittent Windows process-fixture failures under shared machine load.
      The 2026-10-14 audit's live `validate:repository` rerun passes; production
      timeout/abort observation remains the closure condition. No background
      process was terminated by this audit.
      **Automation level: 3.**

- [ ] **FID-2026-1012-024. Failure classes have no horizon.** RC7 — **7 classes / 36 records**
      whose old wrapper stopped on 2026-09-09; this does not prove repair. Deep probes find later
      differently worded failures, uncaptured exit-code/nested errors and overbroad expectedness.
      Investigate all seven before any disposition → E7. **Automation level: 3.**

### Build orders (formalized as FIDs 2026-10-07)

The build order for the seven active records and the remaining register tasks
lives in the master record `FID-2026-1012-022` (`### Work order` for the
schedule, `### Status board` for current state), so there is exactly one place an automation run can
be pointed at. Its three chains: **A**, the failure-class lanes (`-024` → `-023`; `-024` →
`-017`/`-018`/`-019`/`-020`; then `-021`); **B**, the completed learnings-store artifact lane
(all seven records archived on 2026-10-13); **C**, the register
tasks (`T122` → `T186`, plus `T119`, `T173`, `T171`, `T175`, `T62-followups`, `T187` and the local
`0.0.36` development line). Every edge is declared as `**Depends On:**` metadata on the child, so the
ledger validates the graph and rejects a cycle. Chain C items run under child FIDs drafted at their
wave start; the operator-gated items — the `0.0.36` cut, `T122`, `T186`, `T171`'s ruling, `T175`,
`T62`'s credits and `T187` — are named in the master's "What stops for you", and nothing automates
past them.

The QOL coordinator and Waves 1–4 are also registered above and in the master's
status board. Their source implementation is present; committing and recording
closure evidence is the next lifecycle work, not re-implementing the waves.

## Machine-readable scope targets

Operator authorization: complete the master program at automation level 3 (2026-10-12).
The planning review is complete; implementation, verification and local commits are authorized.
Evidence and per-record Loop 2 corrections are in
`docs/design/perfection-loop-2026-10-12.md`. Additional implementation test/probe surfaces named
there must be covered by the owning item's targets before source writes begin.
Completed items retain evidence in their archived records; every unresolved item
and its remaining operator/external-input holds stay active.

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
     finished days ago. Evict the line in the pass that closes the item. -->

- FID-2026-1012-017: `sdk/src/impl/llm/**`, `sdk/src/run/**`,
  `sdk/src/__tests__/tool-argument-budget.test.ts`,
  `common/src/types/contracts/llm.ts`, `common/src/util/tool-argument-budget.ts`,
  `common/src/util/__tests__/experience-classes.test.ts`,
  `packages/agent-runtime/src/run-agent-step/**`,
  `packages/agent-runtime/src/tools/stream-parser/**`,
  `packages/agent-runtime/src/tools/handlers/tool/**`, `common/src/tools/params/tool/**`
- FID-2026-1012-021: `scripts/experiences-dedup.ts`, `scripts/experiences-recurrence*.ts`,
  `scripts/experiences-learning-order.ts`, `scripts/experiences-repair-drafts.ts`,
  `scripts/experiences-probe.ts`, `scripts/__tests__/experiences-class-horizon.test.ts`,
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
  `sdk/src/__tests__/command-execution-cancellation-identity.test.ts`,
  `packages/agent-runtime/src/tools/**`, `packages/agent-runtime/src/run-agent-step/**`,
  `packages/agent-runtime/src/hooks/**`, `common/src/types/contracts/**`,
  `common/src/types/experience.ts`, `common/src/util/command-execution.ts`,
  `common/src/util/experience-classes.ts`, `common/src/tools/params/tool/**`,
  `dev/experiences/class-owners.json`, `cli/src/headless-control-plane.ts`,
  `cli/src/chat/keyboard.ts`, `cli/src/commands/defs/core.ts`,
  `cli/src/hooks/helpers/send-message-lifecycle.ts`,
  `cli/src/server/gateway/run-lifecycle.ts`,
  `cli/src/__tests__/headless-control.test.ts`
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
- T175: (no write surface — operator-owned)
- T171: `cli/src/utils/provider-wizard-discovery.ts`,
  `cli/src/chat/use-chat-pickers.ts`,
  `cli/src/chat/__tests__/model-picker-activation.test.ts`,
  `cli/src/utils/__tests__/provider-wizard-discovery.test.ts`
- T173: `common/src/constants/context-window-table-kiosapi.ts`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- T122: (no write surface — operator-owned)
- FID-2026-1014-001: `packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts` (consumer),
  `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts`,
  `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-redirect-waiver.test.ts`,
  `packages/agent-runtime/src/echo/enforcement/helpers.ts`
- FID-2026-1014-003: `scripts/attribution-guard.ts`,
  `scripts/__tests__/attribution-guard.test.ts`, `scripts/pre-push-scan.ts`
  (re-export only), `.githooks/commit-msg`,
  `.github/workflows/attribution-guard.yml`,
  `dev/session-summaries/2026-10-02-0223-fid-003-batch1-implementation.md`
- T186: (no write surface — blocked on the T122 savant-free removal)
- T187: (no write surface — operator-owned skills surface)
