# SCOPE — Open Work Register

This register lists active work only. On closure, remove the item and its write
targets; retain evidence in the changelog, archived FID and session summary.
Every active FID and agenda task must be registered here. Machine-readable
targets grant write authority only for the corresponding open item.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override ECHO laws, credential
handling or repository boundaries.

## Open items

- [ ] **FID-2026-1015-006. Post-cutoff recurrence continuation.**
      Operator renewed execution on 2026-10-16: recover incident evidence,
      reproduce failures and complete causal repairs. The retained spills do
      contain the URLs and command details previously called missing. Native
      diagnostics, HTML selection, search parsing and cleanup proofs are now
      converged for implementation under this owning FID.
      Local repairs and all 19 declared gates pass. Eight classes have explicit
      active ownership; the recurrence allocation probe reports zero issues.
      **Blocker:** sanitized provider rejection/schema details and exact failing
      URLs are absent from capture; class repair also requires real exposure
      across the 14-day/three-session observation window. Input is pending.
      Historical waivers and immutable failure rows remain unchanged.
      **Automation level: 3.**

- [ ] **FID-2026-1012-022. Open-work master plan (build order + status board).**
      Savant-Free retirement and four-pillar hardening are committed at
      001e36c6 and d71b9065; both children are archived. Final root tests pass
      9,203/23 skip/0 fail (9,226 ran). The census is 606 records / 59 stable
      classes;
      eight post-cutoff classes continue under active FID-2026-1015-006.
      **Blocker:** the continuation's replay/exposure requirements and T175's
      pending scope decision. No observation or production repair is fabricated.
      **Automation level: 3.**

- [ ] **T175. Sweep control-manifest authorship + control-armed re-run.**
      The operator answered "agree" to a draft for review. Delivered:
      `docs/design/provider-reference-review-2026-10-15.md`, with exact-model
      reference candidates, separate no-reference/inconclusive labels, and an
      operator-managed credential-epoch proposal. Zero live calls and no new
      spending are authorized by this draft.
      **Blocker:** the concrete review
      asks whether live comparisons should remain separate from coordinator
      closure; requiring a live run also needs selected references and a numeric
      quota/spending cap. The question is pending, not inferred from silence.
      **Automation level: 1.**

- [ ] **Local v0.0.36 development line.**
      Local commits and automatic normal fast-forward pushes to `main` are
      permitted under the standing operator authority recorded below.
      Publication remains release-only. The attribution pre-push hook and its
      verification gates remain active. The operator answered "no need to gate"
      on 2026-10-15: publication does not gate this coordinator's closure.
      Normal push was attempted but blocked: earlier outgoing restoration
      commit a707aa89 reintroduces five vendor binaries above the hook's
      2 MB scan cap. The cap and history remain intact; no bypass was used.
      Resolved mechanically under FID-2026-1016-002: identity-pinned
      exemptions (path + git blob id) pass exactly the five required
      vendored binaries; every unpinned or swapped-content over-cap blob
      still fails closed. Push not yet re-attempted.
      **Automation level: 3.**

- [ ] **Lessons-pipeline recurrence review and feature routing.** Audit the raw
      experience traces, recurrence/dedup outputs, learnings, agenda, and
      lesson-to-skill routing for repeated actionable classes. Record evidence,
      rank feature candidates, and implement the first approved candidate with
      its declared verification gates. Preserve the locked clean-Linux scratch
      artifact and do not alter that blocked work item.
      **Automation level: 3.**

- [ ] **T194. Linked-checkout retrofit reconnaissance before any FID.**
      Retrofitting the git-worktree idea against Savant rather than adopting the intake
      report: all 192 `resources/` repositories classified, mechanics extracted with
      file:line from real implementations, each mechanic checked against what Savant
      already has (Law 7/13), a state-surface map (per-checkout versus shared, including
      the governance ledgers `dev/experiences/**`, `dev/LEARNINGS.md`, `dev/agenda.md`,
      `.agents/skills/.quarantine/**` and `SCOPE.md` itself), a failure catalog, and a
      measurement plan for the G9 trigger. No FID is authored until the record is
      complete. Method is bounded per-repository probing: recursive sweeps of
      `resources/` exceed the search tool's execution cap (measured).
      **Automation level: 3.**

- [ ] **MarsAI provider (FID-2026-1016-004).** Operator request: add MarsAI as
      a built-in gateway provider — `https://marsai.click/v1`,
      OpenAI-compatible, credential `MARSAI_API_KEY`. The operator dashboard
      census (2026-10-16, console-verified) supplies the 14-id free-tier
      roster — every Model ID carries the `marsai/` slug, so dispatch keeps
      the full id (`idTransform: 'keep'`, the openrouter shape). The live
      /v1/models probe remains blocked from this network (DNS hijack + TLS
      reset; true records via DoH 104.21.63.63 / 172.67.143.237): 10 ids get
      cross-gateway-sourced window rows; 4 stay documented no-row (auto-free,
      cat-jam-free, and the two tier1-only ids — flagged for a ruling).
      **Automation level: 3.**

## Recorded operator dispositions (2026-10-15)

The verbatim source is `dev/fids/answers.md`; the durable decision record is
FID-2026-1015-002. These dispositions supersede the previous register holds.

- T171: dropped::operator-approved 2026-10-15 — "keep as is".
- T173: current conservative KiosAPI defaults accepted — "its fine, close it as done".
  No vendor-published or newly measured context windows are claimed.
- T62-followups: dropped::operator-approved 2026-10-15 — "no need to check".
  No fresh availability or funding verification is claimed.
- Q23 routing decision and attribution branch-protection requirement:
  dropped::operator-approved 2026-10-15 — "disregard these, im not doing ci".
  Existing local guards remain effective.
- T186: scripts/tmux is now wired into ordinary and release typecheck/test
  chains; its typecheck and four offline tests pass. Savant-Free registration
  is removed, leaving 14 registered workspaces with a leg in each root chain.
- T187: all six coding skills now have `version: 0.1.0`, per "agree";
  skills:check reports zero repository errors and 24 warnings.
- Standing normal-main push authority and T191: committed at 98375762.
- T192/T193: transcript retained under dev/scratchpad/archive/ (1,304,054 bytes);
  receipt retained under dev/scratchpad/active/ (1,144 bytes). Root clutter is
  cleared; the intake report passes Markdown lint. No artifact was deleted.

## Machine-readable scope targets

Operator authorization: completion at automation level 3, renewed 2026-10-15;
specific removal and skill metadata approvals are in answers.md. Governance
artifacts required by ECHO retain their gate-level exemptions.

- FID-2026-1015-006: `sdk/**`, `packages/agent-runtime/**`,
  `packages/llm-providers/**`, `common/**`,
  `scripts/experiences-*.ts`, `dev/experiences/**`, `dev/fids/**`, `SCOPE.md`,
  `dev/session-summaries/**`

- FID-2026-1012-022: `dev/fids/**`, `SCOPE.md`, `docs/design/**`,
  `dev/experiences/**`, `dev/agenda.md`
- FID-2026-1016-004: `common/**`, `cli/**`, `sdk/**`, `docs/**`,
  `README.md`, `README.zh-CN.md`, `.env.example`, `CHANGELOG.md`, `SCOPE.md`,
  `dev/fids/**`, `dev/session-summaries/**`
- Release-0.0.36: `VERSION`, `package.json`, `agents/package.json`,
  `cli/package.json`, `cli/release/package.json`, `common/package.json`,
  `common/src/constants/protocol-bundle.generated.ts`, `desktop/package.json`,
  `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/Cargo.toml`,
  `desktop/src-tauri/Cargo.lock`, `evals/package.json`,
  `scripts/tmux/package.json`, `sdk/package.json`, `packages/**/package.json`,
  `bun.lock`, `protocol.config.yaml`, `README.md`, `README.zh-CN.md`,
  `ARCHITECTURE.md`, `CHANGELOG.md`, `docs/**`, `SCOPE.md`, `dev/agenda.md`,
  `dev/operator-decisions.md`, `dev/fids/**`, `dev/feature-pipeline/**`,
  `dev/session-summaries/**`, `scripts/version-docs.ts`,
  `scripts/version-docs-drift.test.ts`, `.agents/skills/**/SKILL.md`
- T175: `docs/design/provider-reference-review-2026-10-15.md`
- T194: `docs/design/**`, `dev/research/**`, `dev/scratchpad/**`, `dev/fids/**`,
  `dev/task-id-ledger.json`, `SCOPE.md`
- Lessons-pipeline: `dev/experiences/**`, `dev/LEARNINGS.md`, `dev/agenda.md`,
  `dev/idea-shelf/**`, `dev/wiki/**`, `scripts/experiences-*.ts`,
  `scripts/lessons-*.ts`, `.agents/skills/.quarantine/**`, and
  `dev/session-summaries/**`
